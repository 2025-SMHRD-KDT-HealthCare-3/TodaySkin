"""
이미지 전처리 모듈

바이트 데이터를 YOLO에서 사용 가능한 OpenCV BGR 이미지로 변환합니다.

역할:
- 업로드된 바이트 데이터를 OpenCV BGR 이미지로 변환
- EXIF 방향 보정
- 이미지 유효성 검증
- 얼굴 감지 후 신뢰 가능한 경우에만 크롭 (실패/불안정 시 원본 유지)
- 큰 이미지만 비율 유지 축소
- 필요 시에만 약한 CLAHE 적용

실서비스용 원칙:
- 실제 피부 정보를 최대한 덜 건드린다
- 작은 이미지를 억지로 키우지 않는다
- 모공/여드름 질감 손상을 줄인다
- 얼굴 크롭은 "감지되면 무조건"이 아니라 "조건을 만족할 때만" 적용한다
"""


import os
import logging
import tempfile
import shutil
from io import BytesIO

import cv2
import numpy as np
from PIL import Image, ImageOps


logger = logging.getLogger(__name__)

# ============================================================
# 상수 설정
# ============================================================

MAX_SIZE = 1280
MIN_IMAGE_SIZE = 64

CLAHE_CLIP_LIMIT = 1.5
CLAHE_BRIGHTNESS_THRESHOLD = 180

# 얼굴 크롭 관련 설정
FACE_PAD_RATIO = 0.20              # 얼굴 박스 기준 여백 비율 (20%)
MIN_FACE_AREA_RATIO = 0.08         # 얼굴이 전체 이미지 면적의 최소 8% 이상일 때만 크롭
MAX_EDGE_TOUCH_RATIO = 0.02        # 얼굴이 가장자리에 너무 붙어 있으면 크롭하지 않음
MIN_CROP_SIZE = 160                # 크롭 결과 최소 크기
FACE_DETECT_SCALE_FACTOR = 1.1
FACE_DETECT_MIN_NEIGHBORS = 5


# ======================================================================================
# 얼굴 감지기 초기화 (모듈 로딩 시 1회)
# - OpenCV C++이 한글 경로를 읽지 못하는 문제 우회
# - cv2 패키지 내 XML을 시스템 임시 폴더(영문 경로)로 복사 후 로드
# - tempfile.gettempdir()은 `C:\Users\SMHRD-\AppData\Local\Temp` 같은 경로를 반환
# - 작업 흐름 : 서버 시작 → Python이 utils/XML을 Temp 폴더로 복사 (한글 경로 → 영문 경로)
#              → OpenCV가 Temp 폴더의 XML 로드 → 성공
# ======================================================================================

_cascade_src = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
_cascade_tmp = os.path.join(tempfile.gettempdir(), 'haarcascade_frontalface_default.xml')

# 임시 폴더에 없으면 복사 (Python은 한글 경로 복사 가능)
if not os.path.exists(_cascade_tmp):
    shutil.copy2(_cascade_src, _cascade_tmp)

_face_cascade = cv2.CascadeClassifier(_cascade_tmp)


# ============================================================
# 이미지 변환 · 검증
# ============================================================

def bytes_to_cv2_image(image_bytes: bytes | bytearray) -> np.ndarray:
    """
    업로드된 바이트 데이터를 OpenCV BGR 이미지로 변환합니다.
    - EXIF 방향 보정 포함
    - PIL로 디코딩 후 OpenCV BGR로 변환
    """
    if not isinstance(image_bytes, (bytes, bytearray)):
        raise TypeError(
            f"bytes 또는 bytearray 타입이 필요합니다. 입력된 타입: {type(image_bytes).__name__}"
        )

    if not image_bytes:
        raise ValueError("빈 이미지 데이터입니다.")

    try:
        pil_img = Image.open(BytesIO(image_bytes))
        pil_img = ImageOps.exif_transpose(pil_img)  # EXIF 방향 보정
        pil_img = pil_img.convert("RGB")
    except Exception as e:
        raise ValueError(
            f"이미지 디코딩 실패. 데이터 크기: {len(image_bytes)} bytes. "
            f"손상된 파일이거나 지원하지 않는 형식일 수 있습니다. 원인: {e}"
        ) from e

    img_rgb = np.array(pil_img)
    if img_rgb.size == 0:
        raise ValueError("디코딩된 이미지가 비어 있습니다.")

    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
    return img_bgr


def validate_image(img: np.ndarray) -> None:
    """
    이미지 유효성 검증
    - np.ndarray 여부
    - 빈 이미지 여부
    - BGR 3채널 여부
    - 최소 해상도 여부
    """
    if img is None or not isinstance(img, np.ndarray):
        raise TypeError(
            f"np.ndarray 타입이 필요합니다. 입력된 타입: {type(img).__name__}"
        )

    if img.size == 0:
        raise ValueError("빈 이미지입니다.")

    if len(img.shape) != 3 or img.shape[2] != 3:
        raise ValueError(f"BGR 3채널 이미지가 아닙니다: shape={img.shape}")

    h, w = img.shape[:2]
    if h < MIN_IMAGE_SIZE or w < MIN_IMAGE_SIZE:
        raise ValueError(
            f"이미지가 너무 작습니다: {w}x{h} (최소 {MIN_IMAGE_SIZE}x{MIN_IMAGE_SIZE})"
        )


# ============================================================
# 얼굴 크롭
# ============================================================

def _get_unreliable_face_reason(
    img_shape: tuple[int, int, int],
    x: int,
    y: int,
    w: int,
    h: int
) -> str | None:
    """
    얼굴 박스가 실서비스용 크롭에 적합하지 않으면 사유를 문자열로 반환합니다.
    적합하면 None을 반환합니다.

    검사 항목:
    - 얼굴 면적이 전체 이미지 대비 너무 작은지
    - 얼굴 박스가 이미지 가장자리에 붙어 있는지 (상하좌우)
    """
    img_h, img_w = img_shape[:2]
    img_area = img_h * img_w
    face_area = w * h

    # 얼굴 면적 비율 검사
    face_area_ratio = face_area / img_area
    if face_area_ratio < MIN_FACE_AREA_RATIO:
        return (
            f"face_too_small:"
            f" face_area_ratio={face_area_ratio:.4f}"
            f" < min_ratio={MIN_FACE_AREA_RATIO:.4f}"
        )

    # 가장자리 접촉 검사
    edge_margin_x = int(img_w * MAX_EDGE_TOUCH_RATIO)
    edge_margin_y = int(img_h * MAX_EDGE_TOUCH_RATIO)

    if x <= edge_margin_x:
        return f"face_touches_left_edge: x={x}, edge_margin_x={edge_margin_x}"

    if y <= edge_margin_y:
        return f"face_touches_top_edge: y={y}, edge_margin_y={edge_margin_y}"

    if (x + w) >= (img_w - edge_margin_x):
        return f"face_touches_right_edge: right={x + w}, limit={img_w - edge_margin_x}"

    if (y + h) >= (img_h - edge_margin_y):
        return f"face_touches_bottom_edge: bottom={y + h}, limit={img_h - edge_margin_y}"

    return None


def crop_face(img: np.ndarray, pad_ratio: float = FACE_PAD_RATIO) -> np.ndarray:
    """
    얼굴 영역을 감지하여, 신뢰 가능한 경우에만 크롭합니다.

    동작 방식:
    1. 얼굴 감지 실패 → 원본 반환
    2. 여러 얼굴 감지 시 → 가장 큰 얼굴 선택
    3. 얼굴 박스가 너무 작거나 가장자리에 붙어 있으면 → 원본 반환
    4. 크롭 결과가 너무 작으면 → 원본 반환
    5. 조건 통과 시에만 얼굴 크롭 적용
    """
    if img is None or not isinstance(img, np.ndarray):
        raise TypeError(
            f"np.ndarray 타입이 필요합니다. 입력된 타입: {type(img).__name__}"
        )

    if img.size == 0:
        raise ValueError("빈 이미지입니다.")

    if pad_ratio < 0:
        raise ValueError("pad_ratio는 0 이상이어야 합니다.")

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    faces = _face_cascade.detectMultiScale(
        gray,
        scaleFactor=FACE_DETECT_SCALE_FACTOR,
        minNeighbors=FACE_DETECT_MIN_NEIGHBORS,
        minSize=(MIN_IMAGE_SIZE, MIN_IMAGE_SIZE)
    )

    # 1. 얼굴 감지 실패 → 원본 유지
    if len(faces) == 0:
        logger.info(
            "[crop_face] fallback_to_original reason=no_face_detected "
            "image_shape=%s",
            img.shape
        )
        return img

    # 2. 가장 큰 얼굴 선택
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])

    # 3. 얼굴 박스 신뢰도 검사 실패 → 원본 유지
    unreliable_reason = _get_unreliable_face_reason(img.shape, x, y, w, h)
    if unreliable_reason is not None:
        logger.info(
            "[crop_face] fallback_to_original reason=%s "
            "image_shape=%s face_box=(x=%d,y=%d,w=%d,h=%d)",
            unreliable_reason,
            img.shape,
            x, y, w, h
        )
        return img

    img_h, img_w = img.shape[:2]

    # 4. 여백 포함한 크롭 영역 계산
    pad_x = int(w * pad_ratio)
    pad_y = int(h * pad_ratio)

    x1 = max(0, x - pad_x)
    y1 = max(0, y - pad_y)
    x2 = min(img_w, x + w + pad_x)
    y2 = min(img_h, y + h + pad_y)

    cropped = img[y1:y2, x1:x2]

    # 5. 크롭 결과 검증
    if cropped.size == 0:
        logger.warning(
            "[crop_face] fallback_to_original reason=empty_cropped_result "
            "image_shape=%s face_box=(x=%d,y=%d,w=%d,h=%d) "
            "crop_box=(x1=%d,y1=%d,x2=%d,y2=%d)",
            img.shape,
            x, y, w, h,
            x1, y1, x2, y2
        )
        return img

    crop_h, crop_w = cropped.shape[:2]
    if crop_h < MIN_CROP_SIZE or crop_w < MIN_CROP_SIZE:
        logger.info(
            "[crop_face] fallback_to_original reason=crop_too_small "
            "cropped_shape=%s min_crop_size=%d "
            "face_box=(x=%d,y=%d,w=%d,h=%d)",
            cropped.shape,
            MIN_CROP_SIZE,
            x, y, w, h
        )
        return img

    logger.info(
        "[crop_face] crop_applied "
        "image_shape=%s cropped_shape=%s "
        "face_box=(x=%d,y=%d,w=%d,h=%d) "
        "crop_box=(x1=%d,y1=%d,x2=%d,y2=%d)",
        img.shape,
        cropped.shape,
        x, y, w, h,
        x1, y1, x2, y2
    )
    return cropped


# ============================================================
# 리사이즈 · CLAHE
# ============================================================

def resize_if_needed(img: np.ndarray, max_size: int = MAX_SIZE) -> np.ndarray:
    """
    큰 이미지만 비율 유지 축소합니다.
    - 작은 이미지는 확대하지 않음
    - 긴 변이 max_size를 초과하는 경우에만 축소
    """
    if img is None or not isinstance(img, np.ndarray):
        raise TypeError(
            f"np.ndarray 타입이 필요합니다. 입력된 타입: {type(img).__name__}"
        )

    if img.size == 0:
        raise ValueError("빈 이미지입니다.")

    if max_size <= 0:
        raise ValueError("max_size는 1 이상의 정수여야 합니다.")

    h, w = img.shape[:2]
    long_side = max(h, w)

    if long_side <= max_size:
        return img

    scale = max_size / long_side
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))

    resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
    return resized


def apply_clahe(img: np.ndarray, clip_limit: float = CLAHE_CLIP_LIMIT) -> np.ndarray:
    """
    LAB 색공간의 L 채널에만 CLAHE를 적용합니다.
    단, 평균 밝기가 임계값을 초과하면 스킵하여 불필요한 과장을 방지합니다.
    """
    if img is None or not isinstance(img, np.ndarray):
        raise TypeError(
            f"np.ndarray 타입이 필요합니다. 입력된 타입: {type(img).__name__}"
        )

    if img.size == 0:
        raise ValueError("빈 이미지입니다.")

    if clip_limit <= 0:
        raise ValueError("clip_limit은 0보다 커야 합니다.")

    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    # 이미 충분히 밝은 이미지는 CLAHE 적용 안 함
    if float(l.mean()) > CLAHE_BRIGHTNESS_THRESHOLD:
        return img

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
    l2 = clahe.apply(l)

    merged = cv2.merge((l2, a, b))
    result = cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)
    return result


# ============================================================
# 메인 전처리 파이프라인
# ============================================================

def preprocess_image(
    img: np.ndarray,
    use_clahe: bool = True,
    use_face_crop: bool = True
) -> np.ndarray:
    """
    YOLO 피부 분석용 전처리 파이프라인

    순서:
        1. 입력 검증
        2. 얼굴 크롭 (신뢰 가능한 경우에만 적용, 아니면 원본 유지)
        3. 큰 이미지만 비율 유지 축소
        4. CLAHE 적용 (use_clahe=True일 때, 밝은 이미지는 자동 스킵)

    Args:
        img: OpenCV BGR 이미지
        use_clahe: True면 조명 불균일 보정 적용 (기본값: True)
        use_face_crop: True면 안전장치 통과 시 얼굴 크롭 (기본값: True)
    """
    validate_image(img)

    if use_face_crop:
        img = crop_face(img)

    img = resize_if_needed(img)

    if use_clahe:
        img = apply_clahe(img)

    return img