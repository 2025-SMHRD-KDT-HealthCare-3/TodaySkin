import os
import base64
import threading
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

import cv2
import numpy as np
from ultralytics import YOLO

# 공통 전처리 / 점수 계산 유틸
from utils.preprocess import preprocess_image
from utils.score_utils import calculate_skin_score

logger = logging.getLogger(__name__)

# 현재 파일 위치 기준으로 Ai_FastAPI 루트 경로 계산
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ==================================
# 모델 경로
# ==================================
# best1.pt : 여드름(acne) 전용 모델
# best2.pt : 모공(pore) 전용 모델
# - best2 내부 클래스명이 scar여도 서비스에서는 pore로 취급
ACNE_MODEL_PATH = os.path.join(BASE_DIR, "model", "best1.pt")
PORE_MODEL_PATH = os.path.join(BASE_DIR, "model", "best2.pt")

# ==================================
# 추론 설정
# ==================================
# CONF_THRES:
# - confidence threshold
# - 낮출수록 더 민감하게 많이 잡음
# IOU_NMS:
# - NMS 중복 제거 기준
# - 너무 높으면 겹친 박스가 많이 남고
# - 너무 낮으면 군집성 acne가 너무 많이 합쳐질 수 있음
CONF_THRES = 0.1
IOU_NMS = 0.35

# ==================================
# YOLO 모델 싱글톤
# ==================================
# 서버 실행 중 모델을 1회만 메모리에 올리고 재사용
# 모델별 락을 분리해서 첫 로딩 시 서로 덜 막히도록 구성
_acne_model: YOLO | None = None
_pore_model: YOLO | None = None
_acne_model_lock = threading.Lock()
_pore_model_lock = threading.Lock()


def _get_acne_model() -> YOLO:
    """
    여드름 모델 싱글톤 로더
    """
    global _acne_model

    if _acne_model is not None:
        return _acne_model

    with _acne_model_lock:
        if _acne_model is None:
            if not os.path.exists(ACNE_MODEL_PATH):
                raise FileNotFoundError(f"여드름 모델 파일을 찾을 수 없습니다: {ACNE_MODEL_PATH}")
            _acne_model = YOLO(ACNE_MODEL_PATH)
            logger.info("Acne 모델 로딩 완료: %s", ACNE_MODEL_PATH)

    return _acne_model


def _get_pore_model() -> YOLO:
    """
    모공 모델 싱글톤 로더
    """
    global _pore_model

    if _pore_model is not None:
        return _pore_model

    with _pore_model_lock:
        if _pore_model is None:
            if not os.path.exists(PORE_MODEL_PATH):
                raise FileNotFoundError(f"모공 모델 파일을 찾을 수 없습니다: {PORE_MODEL_PATH}")
            _pore_model = YOLO(PORE_MODEL_PATH)
            logger.info("Pore 모델 로딩 완료: %s", PORE_MODEL_PATH)

    return _pore_model


def _score_to_severity(score: int) -> str:
    """
    점수를 사용자 표시용 severity 문자열로 변환
    - 점수가 높을수록 상태가 좋음
    """
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
    박스들의 union area ratio 계산

    이유:
    - 모공 박스는 서로 많이 겹칠 수 있음
    - 단순 면적 합(sum)으로 계산하면 겹친 영역이 중복 계산됨
    - 그래서 mask를 만들어 실제 차지한 전체 영역 비율을 계산
    """
    if image_width <= 0 or image_height <= 0:
        raise ValueError("유효하지 않은 이미지 크기입니다.")

    if not boxes_xyxy:
        return 0.0

    # 이미지 크기와 같은 mask 생성
    mask = np.zeros((image_height, image_width), dtype=np.uint8)

    for x1, y1, x2, y2 in boxes_xyxy:
        # 이미지 범위를 벗어나지 않도록 좌표 보정
        x1 = max(0, min(image_width, int(round(x1))))
        y1 = max(0, min(image_height, int(round(y1))))
        x2 = max(0, min(image_width, int(round(x2))))
        y2 = max(0, min(image_height, int(round(y2))))

        if x2 <= x1 or y2 <= y1:
            continue

        # 박스 영역을 1로 칠함
        mask[y1:y2, x1:x2] = 1

    union_area = int(mask.sum())
    image_area = image_width * image_height

    return round(union_area / float(image_area), 6)


def _collect_acne_results(results) -> dict:
    """
    best1.pt 결과 파싱

    전제:
    - best1.pt는 acne 전용 모델
    - 따라서 검출된 박스는 모두 acne로 취급
    """
    acne_confidences: list[float] = []

    for result in results:
        if result.boxes is None:
            continue

        for box in result.boxes:
            conf = float(box.conf.item())
            acne_confidences.append(round(conf, 4))

    return {
        "count": len(acne_confidences),
        "confidences": acne_confidences,
    }


def _collect_pore_results(results, image_width: int, image_height: int) -> dict:
    """
    best2.pt 결과 파싱

    전제:
    - best2.pt는 pore 전용 모델
    - 내부 클래스명이 scar여도 서비스 결과에서는 pore로 사용
    """
    if image_width <= 0 or image_height <= 0:
        raise ValueError("유효하지 않은 이미지 크기입니다.")

    pore_confidences: list[float] = []
    pore_boxes_xyxy: list[tuple[float, float, float, float]] = []

    for result in results:
        if result.boxes is None:
            continue

        for box in result.boxes:
            conf = float(box.conf.item())
            x1, y1, x2, y2 = box.xyxy[0].tolist()

            pore_confidences.append(round(conf, 4))
            pore_boxes_xyxy.append((x1, y1, x2, y2))

    union_area_ratio = _calculate_union_area_ratio(
        pore_boxes_xyxy,
        image_width,
        image_height,
    )

    return {
        "count": len(pore_confidences),
        "confidences": pore_confidences,
        "union_area_ratio": union_area_ratio,
    }


def _run_acne_inference(processed_img: np.ndarray):
    """
    여드름 모델 추론
    ThreadPoolExecutor에서 실행하기 위한 분리 함수
    """
    model = _get_acne_model()
    return model(processed_img, conf=CONF_THRES, iou=IOU_NMS, verbose=False)


def _run_pore_inference(processed_img: np.ndarray):
    """
    모공 모델 추론
    ThreadPoolExecutor에서 실행하기 위한 분리 함수
    """
    model = _get_pore_model()
    return model(processed_img, conf=CONF_THRES, iou=IOU_NMS, verbose=False)


def _run_parallel_inference(processed_img: np.ndarray) -> tuple:
    """
    acne / pore 모델을 병렬 추론

    장점:
    - 순차 실행보다 응답 시간이 줄어들 수 있음
    - 두 모델을 동시에 돌리고 둘 다 끝나면 반환
    """
    acne_results = None
    pore_results = None

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = {
            executor.submit(_run_acne_inference, processed_img): "acne",
            executor.submit(_run_pore_inference, processed_img): "pore",
        }

        for future in as_completed(futures):
            label = futures[future]
            try:
                result = future.result()
            except Exception as exc:
                raise RuntimeError(f"{label} 모델 추론 중 오류 발생: {exc}") from exc

            if label == "acne":
                acne_results = result
            else:
                pore_results = result

    return acne_results, pore_results


def _draw_detections(
    image: np.ndarray,
    acne_results,
    pore_results,
) -> np.ndarray:
    """
    두 모델 탐지 결과를 하나의 이미지에 시각화

    색상:
    - acne: 빨간색
    - pore: 파란색
    """
    annotated = image.copy()

    # ---------- acne 박스 그리기 ----------
    for result in acne_results:
        if result.boxes is None:
            continue

        for box in result.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            conf = float(box.conf.item())
            label = f"acne {conf:.2f}"

            cv2.rectangle(annotated, (x1, y1), (x2, y2), (0, 0, 255), 2)
            cv2.putText(
                annotated,
                label,
                (x1, max(y1 - 8, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 0, 255),
                2,
                cv2.LINE_AA,
            )

    # ---------- pore 박스 그리기 ----------
    for result in pore_results:
        if result.boxes is None:
            continue

        for box in result.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0].tolist())
            conf = float(box.conf.item())
            label = f"pore {conf:.2f}"

            cv2.rectangle(annotated, (x1, y1), (x2, y2), (255, 0, 0), 2)
            cv2.putText(
                annotated,
                label,
                (x1, max(y1 - 8, 20)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 0, 0),
                2,
                cv2.LINE_AA,
            )

    return annotated


def analyze_skin_from_path(file_path: str) -> dict:
    """
    피부 분석 메인 함수

    전체 흐름:
    1. 절대경로 검증
    2. 이미지 읽기
    3. 전처리
    4. acne / pore 병렬 추론
    5. 결과 파싱
    6. 점수 계산
    7. 결과 이미지(base64) 생성
    8. Node가 쓰기 좋은 JSON 반환
    """
    # ---------- 경로 검증 ----------
    if not os.path.isabs(file_path):
        raise ValueError("절대경로가 아닙니다.")

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"이미지 파일을 찾을 수 없습니다: {file_path}")

    # ---------- 이미지 읽기 ----------
    original_img = cv2.imread(file_path)
    if original_img is None:
        raise ValueError("이미지를 읽을 수 없습니다.")

    # ---------- 전처리 ----------
    processed_img = preprocess_image(original_img.copy())
    if processed_img is None:
        raise ValueError("전처리 결과 이미지가 비어 있습니다.")

    image_height, image_width = processed_img.shape[:2]

    # ---------- 병렬 추론 ----------
    acne_results, pore_results = _run_parallel_inference(processed_img)

    # ---------- 결과 파싱 ----------
    acne_result = _collect_acne_results(acne_results)
    pore_result = _collect_pore_results(pore_results, image_width, image_height)

    analysis_result = {
        "acne": acne_result,
        "pore": pore_result,
    }

    # ---------- 점수 계산 ----------
    scores = calculate_skin_score(analysis_result)

    # ---------- 결과 이미지 시각화 ----------
    annotated_img = _draw_detections(processed_img, acne_results, pore_results)

    # OpenCV 이미지를 jpg 바이트로 인코딩
    success, buffer = cv2.imencode(
        ".jpg",
        annotated_img,
        [int(cv2.IMWRITE_JPEG_QUALITY), 85],
    )
    if not success:
        raise ValueError("분석 결과 이미지를 JPEG로 인코딩하지 못했습니다.")

    # Node에서 저장하기 쉽도록 base64 문자열로 변환
    processed_image_base64 = base64.b64encode(buffer).decode("utf-8")

    # ---------- 최종 응답 ----------
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
        "raw_data": {
            "acne_confidences": analysis_result["acne"]["confidences"],
            "pore_confidences": analysis_result["pore"]["confidences"],
            "pore_union_area_ratio": analysis_result["pore"]["union_area_ratio"],
        },
    }