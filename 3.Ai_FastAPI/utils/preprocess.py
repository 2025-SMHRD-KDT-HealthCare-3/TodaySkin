# 이미지 전처리 파일
# 비율 유지 리사이즈: 얼굴 비율 왜곡 방지, CLAHE: 피부 특징 대비 보정, 노이즈 제거: 잡음이 모공/피부결로 오인되는 것 완화

# 임시
import cv2
import numpy as np

def resize_with_aspect_ratio(img, target_size=640):
    h, w = img.shape[:2]
    scale = target_size / max(h, w)
    new_w = int(w * scale)
    new_h = int(h * scale)

    resized = cv2.resize(img, (new_w, new_h))

    canvas = np.zeros((target_size, target_size, 3), dtype=np.uint8)
    y_offset = (target_size - new_h) // 2
    x_offset = (target_size - new_w) // 2

    canvas[y_offset:y_offset + new_h, x_offset:x_offset + new_w] = resized
    return canvas

def apply_clahe(img):
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    l2 = clahe.apply(l)

    merged = cv2.merge((l2, a, b))
    result = cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)
    return result

def denoise_image(img):
    return cv2.fastNlMeansDenoisingColored(img, None, 5, 5, 7, 21)

def preprocess_image(img):
    if img is None:
        raise ValueError("유효한 이미지가 아닙니다.")

    img = resize_with_aspect_ratio(img, target_size=640)
    img = apply_clahe(img)
    img = denoise_image(img)
    return img