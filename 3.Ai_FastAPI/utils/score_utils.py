# 3.Ai_FastAPI/utils/score_utils.py
# 점수 계산하는 파일
# 여드름: 개수 + confidence => 여드름은 개수 중심, confidence는 보조
# 모공: 겹침 제거한 전체 탐지 영역 비율(union_area_ratio) 중심 + count는 보조
# 최종 점수: 여드름 0.7 + 모공 0.3
# 사용자 체감과 현재 탐지 방식(큰 박스 + 겹침 가능)을 반영한 연속 점수 방식

from typing import Any

# =========================
# 점수 정책
# - 점수가 높을수록 피부 상태가 좋음
# - 여드름: count 중심 + confidence 보조
# - 모공: union_area_ratio 중심 + count 보조
# - total_score: 여드름 0.7 + 모공 0.3 가중합
# =========================
ACNE_WEIGHT = 0.7
PORE_WEIGHT = 0.3

# =========================
# 여드름 점수 계수
# - ACNE_COUNT_PENALTY: 여드름 1개당 7점 감점
# - ACNE_CONF_PENALTY: confidence 보조 감점
#   → avg_conf 0.8 기준 약 6.4점 추가 감점
# =========================
ACNE_COUNT_PENALTY = 7.0
ACNE_CONF_PENALTY = 8.0

# =========================
# 모공 점수 계수
# - 현재 모공 탐지는 큰 박스 + 겹침이 있을 수 있으므로
#   avg_area_ratio / sum(area_ratios) 대신 union_area_ratio 사용
# - PORE_COUNT_PENALTY: count는 아주 약하게만 반영
# - PORE_UNION_AREA_PENALTY:
#   union_area_ratio 0.03 -> 36점 감점
#   union_area_ratio 0.05 -> 60점 감점
# =========================
PORE_COUNT_PENALTY = 0.5
PORE_UNION_AREA_PENALTY = 1200.0


def _safe_avg(values: list[float]) -> float:
    """리스트 평균. 비어있으면 0.0 반환."""
    if not values:
        return 0.0
    return sum(values) / len(values)


def _clamp_score(score: float) -> int:
    """0~100 범위 정수 점수로 보정."""
    return max(0, min(100, round(score)))


def _calculate_acne_score(count: int, confidences: list[float]) -> int:
    """
    여드름 점수 계산
    - count가 많을수록 감점
    - confidence가 높을수록 보조 감점
    - 점수가 높을수록 피부 상태가 좋음

    점수 분포 예시 (avg_conf=0.8 기준):
        0개  -> 100점
        1개  ->  87점
        3개  ->  73점
        5개  ->  59점
        7개  ->  45점
        10개 ->  24점
        15개 ->   0점
    """
    if count <= 0:
        return 100

    avg_conf = _safe_avg(confidences)
    count_penalty = count * ACNE_COUNT_PENALTY
    conf_penalty = avg_conf * ACNE_CONF_PENALTY
    raw_score = 100 - count_penalty - conf_penalty

    return _clamp_score(raw_score)


def _calculate_pore_score(count: int, union_area_ratio: float) -> int:
    """
    모공 점수 계산
    - union_area_ratio가 클수록 크게 감점 (중심)
    - count는 아주 약하게 보조 감점
    - 점수가 높을수록 피부 상태가 좋음

    현재 모델은 큰 박스/겹침 박스가 나올 수 있어
    '개별 모공 수'보다 '실제로 얼마나 넓은 영역이 탐지되었는지'를
    더 중요하게 반영합니다.

    점수 분포 예시:
    1) count = 3, union_area_ratio = 0.02
       -> 100 - (3 * 0.5) - (0.02 * 1200)
       -> 100 - 1.5 - 24
       -> 약 74점

    2) count = 5, union_area_ratio = 0.04
       -> 100 - (5 * 0.5) - (0.04 * 1200)
       -> 100 - 2.5 - 48
       -> 약 50점

    3) count = 8, union_area_ratio = 0.06
       -> 100 - (8 * 0.5) - (0.06 * 1200)
       -> 100 - 4 - 72
       -> 약 24점
    """
    if count <= 0 or union_area_ratio <= 0:
        return 100

    count_penalty = count * PORE_COUNT_PENALTY
    area_penalty = union_area_ratio * PORE_UNION_AREA_PENALTY
    raw_score = 100 - count_penalty - area_penalty

    return _clamp_score(raw_score)


def calculate_skin_score(analysis_result: dict[str, Any]) -> dict[str, Any]:
    """
    추론 결과를 받아 피부 점수를 계산합니다.

    analysis_result 예시:
    {
        "acne": {
            "count": 3,
            "confidences": [0.82, 0.76, 0.91]
        },
        "pore": {
            "count": 4,
            "confidences": [0.80, 0.77, 0.73, 0.81],
            "union_area_ratio": 0.035
        }
    }
    """
    acne = analysis_result.get("acne", {})
    pore = analysis_result.get("pore", {})

    acne_count = int(acne.get("count", 0) or 0)
    pore_count = int(pore.get("count", 0) or 0)

    acne_confidences = acne.get("confidences") or []
    pore_union_area_ratio = float(pore.get("union_area_ratio", 0.0) or 0.0)

    acne_score = _calculate_acne_score(acne_count, acne_confidences)
    pore_score = _calculate_pore_score(pore_count, pore_union_area_ratio)

    total_score = _clamp_score(
        (acne_score * ACNE_WEIGHT) + (pore_score * PORE_WEIGHT)
    )

    return {
        "acne_score": acne_score,
        "pore_score": pore_score,
        "total_score": total_score,
    }