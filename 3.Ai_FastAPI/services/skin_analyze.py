# 3.Ai_FastAPI/services/skin_analyze.py
# YOLO 분석하는 파일

import os
import base64
import threading
import cv2
from ultralytics import YOLO
from utils.preprocess import preprocess_image
from utils.score_utils import calculate_skin_score

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "model", "best.pt")

SEVERITY_THRESHOLDS = (5, 15)

_model: YOLO | None = None
_model_lock = threading.Lock()


def get_model() -> YOLO:
    """
    YOLO 모델을 싱글톤으로 1회만 로드합니다.
    멀티스레드 환경에서 중복 로드를 방지합니다.
    """
    global _model

    if _model is not None:
        return _model

    with _model_lock:
        if _model is None:
            if not os.path.exists(MODEL_PATH):
                raise FileNotFoundError(f"YOLO 모델 파일을 찾을 수 없습니다: {MODEL_PATH}")
            _model = YOLO(MODEL_PATH)

    return _model


def _parse_results(results, image_width: int, image_height: int) -> dict:
    """
    YOLO 추론 결과를 여드름/모공 별로 파싱합니다.

    클래스 인덱스:
        0 = acne
        1 = pore

    모공은 count + area_ratio(박스 면적 / 전체 이미지 면적)를 함께 반환합니다.
    """
    if image_width <= 0 or image_height <= 0:
        raise ValueError("유효하지 않은 이미지 크기입니다.")

    acne_confidences = []
    pore_confidences = []
    pore_area_ratios = []

    image_area = float(image_width * image_height)

    for result in results:
        if result.boxes is None:
            continue

        for box in result.boxes:
            cls = int(box.cls.item())
            conf = float(box.conf.item())

            if cls == 0:
                acne_confidences.append(round(conf, 4))

            elif cls == 1:
                pore_confidences.append(round(conf, 4))

                x1, y1, x2, y2 = box.xyxy[0].tolist()
                box_width = max(0.0, x2 - x1)
                box_height = max(0.0, y2 - y1)
                box_area = box_width * box_height
                area_ratio = box_area / image_area

                pore_area_ratios.append(round(area_ratio, 6))

    return {
        "acne": {
            "count": len(acne_confidences),
            "confidences": acne_confidences,
        },
        "pore": {
            "count": len(pore_confidences),
            "confidences": pore_confidences,
            "area_ratios": pore_area_ratios,
        },
    }


def _severity_label(count: int) -> str:
    if count < SEVERITY_THRESHOLDS[0]:
        return "mild"
    elif count < SEVERITY_THRESHOLDS[1]:
        return "moderate"
    return "severe"


def analyze_skin_from_path(file_path: str) -> dict:
    """
    Node 라우터가 JSON으로 전달한 절대경로 기준으로 이미지를 분석합니다.
    Node에서 path.resolve()로 절대경로를 전송하므로 경로 보정이 필요 없습니다.
    Node와 FastAPI가 같은 파일시스템을 공유하는 환경에서 동작합니다.
    """
    try:
        if not os.path.isabs(file_path):
            raise ValueError("절대경로가 아닙니다.")

        if not os.path.exists(file_path):
            raise FileNotFoundError(f"이미지 파일을 찾을 수 없습니다: {file_path}")

        original_img = cv2.imread(file_path)
        if original_img is None:
            raise ValueError("이미지를 읽을 수 없습니다.")

        processed_img = preprocess_image(original_img.copy())
        image_height, image_width = processed_img.shape[:2]

        model = get_model()
        results = model(processed_img, verbose=False)

        if not results:
            raise ValueError("YOLO 추론 결과가 비어 있습니다.")

        annotated_img = results[0].plot()
        success, buffer = cv2.imencode(
            ".jpg",
            annotated_img,
            [int(cv2.IMWRITE_JPEG_QUALITY), 85]
        )
        if not success:
            raise ValueError("분석 결과 이미지를 JPEG로 인코딩하지 못했습니다.")

        processed_image_base64 = base64.b64encode(buffer).decode("utf-8")

        analysis_result = _parse_results(results, image_width, image_height)
        acne_count = analysis_result["acne"]["count"]
        pore_count = analysis_result["pore"]["count"]

        scores = calculate_skin_score(analysis_result)

        return {
            "acne_score": scores["acne_score"],
            "pore_score": scores["pore_score"],
            "total_score": scores["total_score"],
            "processed_image_base64": processed_image_base64,
            "detections": {
                "acne_count": acne_count,
                "acne_severity": _severity_label(acne_count),
                "pore_count": pore_count,
                "pore_severity": _severity_label(pore_count),
                "affected_areas": [],
            },
        }

    except Exception as e:
        raise RuntimeError(f"피부 분석 중 오류 발생: {str(e)}") from e