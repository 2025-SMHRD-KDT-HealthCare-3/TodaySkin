"""
이미지 전처리 모듈

바이트 데이터를 YOLO에서 사용 가능한 OpenCV BGR 이미지로 변환합니다.
- 비율 유지 리사이즈: 얼굴 비율 왜곡 방지
- CLAHE: 피부 특징 대비 보정
- 노이즈 제거: 잡음이 모공/피부결로 오인되는 것 완화
"""

# 3.Ai_FastAPI/utils/preprocess.py

import numpy as np
import cv2

RESIZE_TARGET = 640
CLAHE_CLIP_LIMIT = 2.0
CLAHE_BRIGHTNESS_THRESHOLD = 180
DENOISE_KERNEL = (3, 3)


def bytes_to_cv2_image(image_bytes: bytes | bytearray) -> np.ndarray:
    if not isinstance(image_bytes, (bytes, bytearray)):
        raise TypeError(f"bytes 또는 bytearray 타입이 필요합니다. 입력된 타입: {type(image_bytes).__name__}")
    if not image_bytes:
        raise ValueError("빈 이미지 데이터입니다.")

    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError(
            f"이미지 디코딩 실패. "
            f"데이터 크기: {len(image_bytes)} bytes. "
            f"손상된 파일이거나 OpenCV에서 지원하지 않는 형식일 수 있습니다."
        )
    if img.size == 0:
        raise ValueError("디코딩된 이미지가 비어 있습니다.")

    return img


def resize_with_aspect_ratio(img: np.ndarray, target_size: int = RESIZE_TARGET) -> np.ndarray:
    if img is None or not isinstance(img, np.ndarray):
        raise TypeError(f"np.ndarray 타입이 필요합니다. 입력된 타입: {type(img).__name__}")
    if img.size == 0:
        raise ValueError("빈 이미지입니다.")
    if target_size <= 0:
        raise ValueError("target_size는 1 이상의 정수여야 합니다.")

    h, w = img.shape[:2]
    scale = target_size / max(h, w)
    new_w = max(1, int(w * scale))
    new_h = max(1, int(h * scale))

    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    canvas = np.full((target_size, target_size, 3), 114, dtype=np.uint8)
    y_offset = (target_size - new_h) // 2
    x_offset = (target_size - new_w) // 2
    canvas[y_offset:y_offset + new_h, x_offset:x_offset + new_w] = resized

    return canvas


def apply_clahe(img: np.ndarray, clip_limit: float = CLAHE_CLIP_LIMIT) -> np.ndarray:
    if img is None or not isinstance(img, np.ndarray):
        raise TypeError(f"np.ndarray 타입이 필요합니다. 입력된 타입: {type(img).__name__}")
    if img.size == 0:
        raise ValueError("빈 이미지입니다.")
    if clip_limit <= 0:
        raise ValueError("clip_limit은 0보다 커야 합니다.")

    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    if l.mean() > CLAHE_BRIGHTNESS_THRESHOLD:
        return img

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
    l2 = clahe.apply(l)

    merged = cv2.merge((l2, a, b))
    return cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)


def denoise_image(img: np.ndarray) -> np.ndarray:
    if img is None or not isinstance(img, np.ndarray):
        raise TypeError(f"np.ndarray 타입이 필요합니다. 입력된 타입: {type(img).__name__}")
    if img.size == 0:
        raise ValueError("빈 이미지입니다.")
    return cv2.GaussianBlur(img, DENOISE_KERNEL, 0)


def preprocess_image(img: np.ndarray) -> np.ndarray:
    if img is None or not isinstance(img, np.ndarray):
        raise TypeError(f"np.ndarray 타입이 필요합니다. 입력된 타입: {type(img).__name__}")

    img = resize_with_aspect_ratio(img)
    img = apply_clahe(img)
    img = denoise_image(img)
    return img