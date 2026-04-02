# ──────────────────────────────────────────────
# * 피부 이미지 분석 서비스 (skin_analyze.py)
# - YOLO 모델로 여드름/모공 탐지
# - 전처리 → 추론 → 점수 산출 → 결과 이미지 생성
# - Node에서 절대경로로 이미지를 전달받아 분석
# ──────────────────────────────────────────────


import os
import base64
import threading
import logging

import cv2
import numpy as np
from ultralytics import YOLO
from utils.preprocess import preprocess_image
from utils.score_utils import calculate_skin_score


logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(BASE_DIR, "model", "best.pt")

# ========== YOLO 모델 싱글톤 ==========
# 멀티스레드 환경에서 중복 로드 방지

_model: YOLO | None = None
_model_lock = threading.Lock()


def _get_model() -> YOLO:
    """YOLO 모델을 싱글톤으로 1회만 로드"""
    global _model

    if _model is not None:
        return _model

    with _model_lock:
        if _model is None:
            if not os.path.exists(MODEL_PATH):
                raise FileNotFoundError(f"YOLO 모델 파일을 찾을 수 없습니다: {MODEL_PATH}")
            _model = YOLO(MODEL_PATH)

    return _model


# ========== 헬퍼 함수 ==========


def _score_to_severity(score: int) -> str:
    """점수를 severity 라벨로 변환 (점수가 높을수록 좋은 상태)"""
    if score >= 80:
        return "mild"
    elif score >= 50:
        return "moderate"
    return "severe"



def _calculate_union_area_ratio(
    boxes_xyxy: list[tuple[float, float, float, float]],
    image_width: int,
    image_height: int,
) -> float:
    """
     * 여러 박스의 겹침을 제거한 union area ratio 계산
        - 방식: 이미지 크기의 mask를 만들고 각 박스를 1로 칠한 뒤
        - 1인 픽셀 수 / 전체 픽셀 수로 계산 → 겹치는 영역을 한 번만 계산
        - 현재처럼 큰 박스/겹침 박스가 있는 탐지 결과에 적합
    """
    if image_width <= 0 or image_height <= 0:
        raise ValueError("유효하지 않은 이미지 크기입니다.")

    if not boxes_xyxy:
        return 0.0

    mask = np.zeros((image_height, image_width), dtype=np.uint8)

    for x1, y1, x2, y2 in boxes_xyxy:
        x1 = max(0, min(image_width, int(round(x1))))
        y1 = max(0, min(image_height, int(round(y1))))
        x2 = max(0, min(image_width, int(round(x2))))
        y2 = max(0, min(image_height, int(round(y2))))

        if x2 <= x1 or y2 <= y1:
            continue

        mask[y1:y2, x1:x2] = 1

    union_area = int(mask.sum())
    image_area = image_width * image_height

    return round(union_area / float(image_area), 6)


def _parse_results(results, image_width: int, image_height: int) -> dict:
    """
    * YOLO 추론 결과를 여드름/모공별로 파싱
    - 클래스 인덱스: 0 = acne, 1 = pore
    - 모공은 큰 박스/겹침이 있을 수 있어 union_area_ratio로 계산
    """

    if image_width <= 0 or image_height <= 0:
        raise ValueError("유효하지 않은 이미지 크기입니다.")

    acne_confidences = []
    pore_confidences = []
    pore_boxes_xyxy = []

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
                pore_boxes_xyxy.append((x1, y1, x2, y2))

    union_area_ratio = _calculate_union_area_ratio(
        pore_boxes_xyxy, image_width, image_height
    )

    return {
        "acne": {
            "count": len(acne_confidences),
            "confidences": acne_confidences,
        },
        "pore": {
            "count": len(pore_confidences),
            "confidences": pore_confidences,
            "union_area_ratio": union_area_ratio,
        },
    }


# ========== 메인 분석 함수 ==========


def analyze_skin_from_path(file_path: str) -> dict:
    """
    * 이미지 파일 경로를 받아 피부 분석 수행
    * 흐름: 경로 검증 → 이미지 읽기 → 전처리 → YOLO 추론 → 점수 산출 → 결과 이미지 생성
     - Node에서 path.resolve()로 절대경로를 전송
     - Node와 FastAPI가 같은 파일시스템을 공유하는 환경에서 동작
     - 에러 발생 시 글로벌 핸들러로 전달 (main.py)
    """

    # 경로 검증
    if not os.path.isabs(file_path):
        raise ValueError("절대경로가 아닙니다.")

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"이미지 파일을 찾을 수 없습니다: {file_path}")

    # 이미지 읽기
    original_img = cv2.imread(file_path)
    if original_img is None:
        raise ValueError("이미지를 읽을 수 없습니다.")

    # 전처리 (얼굴 크롭 → 리사이즈 → CLAHE)
    processed_img = preprocess_image(original_img.copy())
    if processed_img is None:
        raise ValueError("전처리 결과 이미지가 비어 있습니다.")

    image_height, image_width = processed_img.shape[:2]

    # YOLO 추론
    model = _get_model()
    results = model(processed_img, verbose=False)
    if not results:
        raise ValueError("YOLO 추론 결과가 비어 있습니다.")

    # 결과 파싱 + 점수 산출
    analysis_result = _parse_results(results, image_width, image_height)
    scores = calculate_skin_score(analysis_result)

    # 결과 이미지 생성 (바운딩박스 포함)
    annotated_img = results[0].plot()
    success, buffer = cv2.imencode(
        ".jpg", annotated_img,
        [int(cv2.IMWRITE_JPEG_QUALITY), 85]
    )
    if not success:
        raise ValueError("분석 결과 이미지를 JPEG로 인코딩하지 못했습니다.")

    processed_image_base64 = base64.b64encode(buffer).decode("utf-8")

    return {
        "acne_score": scores["acne_score"],
        "pore_score": scores["pore_score"],
        "total_score": scores["total_score"],
        "processed_image_base64": processed_image_base64,
        "detections": {
            "acne_count": analysis_result["acne"]["count"],
            "acne_severity": _score_to_severity(scores["acne_score"]),
            "pore_count": analysis_result["pore"]["count"],
            "pore_severity": _score_to_severity(scores["pore_score"]),
            "affected_areas": [],
        },
    }