# 3.Ai_FastAPI/utils/score_utils.py
# 점수 계산 파일
#
# 점수 철학:
# - 점수가 높을수록 피부 상태가 좋음
# - 여드름: 개수(count) 중심 + confidence 보조
# - 모공: union_area_ratio 중심 + count 보조
# - 총점: 여드름 0.7 + 모공 0.3
#
# 개선점:
# - 기존 선형 감점은 탐지 수가 많아질 때 너무 급격히 0점에 가까워짐
# - log 스케일을 사용해 감점 증가폭을 완만하게 만듦

import math
from typing import Any

# ==================================
# 최종 가중치
# ==================================
# 여드름 점수를 더 중요하게 반영

ACNE_WEIGHT = 0.7
PORE_WEIGHT = 0.3

# =========================
# 여드름 점수 계수
# 기존 선형 감점 문제:
#   count=15 → 100 - (15 * 7.0) = 0점 (너무 가혹)
# 개선: log1p 스케일로 완만하게 감점
#   count=1  → log1p(1)  * 20 ≈  13.9  → score ≈ 86
#   count=5  → log1p(5)  * 20 ≈  35.8  → score ≈ 64
#   count=15 → log1p(15) * 20 ≈  55.5  → score ≈ 44
#   count=30 → log1p(30) * 20 ≈  68.0  → score ≈ 32
#   count=50 → log1p(50) * 20 ≈  78.4  → score ≈ 22
# =========================
# count는 log1p(count)로 감점
# avg confidence는 보조 감점

ACNE_COUNT_LOG_SCALE = 20.0
ACNE_CONF_PENALTY = 8.0

# =========================
# 모공 점수 계수
# 기존 선형 감점 문제:
#   union_area_ratio=0.084 → 100 - (0.084 * 1200) = 0점 (흔한 수준에서 0점)
# 개선: log1p 스케일 적용
#   ratio=0.01  → log1p(0.01  * 500) * 25 ≈  29.3  → score ≈ 71
#   ratio=0.05  → log1p(0.05  * 500) * 25 ≈  84.7  → score ≈ 38 (보정 후)
#   ratio=0.084 → log1p(0.084 * 500) * 25 ≈  97.5  → score ≈ 20 (보정 후)
#   ratio=0.20  → log1p(0.20  * 500) * 25 ≈ 119.5  → clamp 0
# =========================
# union_area_ratio는 먼저 증폭 후 log1p 적용
# count는 약하게만 반영

PORE_AREA_LOG_SCALE = 500.0
PORE_AREA_LOG_WEIGHT = 25.0
PORE_COUNT_PENALTY = 0.3


def _safe_avg(values: list[float]) -> float:
    """
    평균 계산 헬퍼
    - 빈 리스트면 0.0 반환
    """
    if not values:
        return 0.0
    return sum(values) / len(values)


def _clamp_score(score: float) -> int:
    """
    점수를 0~100 범위 정수로 보정
    """
    return max(0, min(100, round(score)))


def _calculate_acne_score(count: int, confidences: list[float]) -> int:
    """
    여드름 점수 계산

    로직:
    - 여드름 개수가 많을수록 감점
    - confidence가 높을수록 탐지가 더 확실하므로 보조 감점
    - log1p(count)를 써서 count 증가에 따른 감점이 너무 가혹하지 않게 조절
    """
    if count <= 0:
        return 100

    avg_conf = _safe_avg(confidences)

    # count 감점: log 스케일
    count_penalty = math.log1p(count) * ACNE_COUNT_LOG_SCALE

    # confidence 감점: 보조
    conf_penalty = avg_conf * ACNE_CONF_PENALTY

    return _clamp_score(100 - count_penalty - conf_penalty)


def _calculate_pore_score(count: int, union_area_ratio: float) -> int:
    """
    모공 점수 계산

    로직:
    - union_area_ratio가 클수록 감점
    - count는 보조로만 약하게 감점
    - log1p(ratio * scale)를 써서 흔한 수준의 ratio에서
      점수가 너무 빨리 0점이 되는 문제를 완화
    """
    if count <= 0 or union_area_ratio <= 0:
        return 100

    # area 감점: ratio를 먼저 증폭한 뒤 log1p 적용
    area_penalty = math.log1p(union_area_ratio * PORE_AREA_LOG_SCALE) * PORE_AREA_LOG_WEIGHT

    # count 감점: 약하게만 반영
    count_penalty = count * PORE_COUNT_PENALTY

    return _clamp_score(100 - area_penalty - count_penalty)


def calculate_skin_score(analysis_result: dict[str, Any]) -> dict[str, Any]:
    """
    추론 결과를 받아 최종 점수 계산

    입력 예시:
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

    # 개별 점수 계산
    acne_score = _calculate_acne_score(acne_count, acne_confidences)
    pore_score = _calculate_pore_score(pore_count, pore_union_area_ratio)

    # 최종 점수 = 가중합
    total_score = _clamp_score(
        (acne_score * ACNE_WEIGHT) + (pore_score * PORE_WEIGHT)
    )

    return {
        "acne_score": acne_score,
        "pore_score": pore_score,
        "total_score": total_score,
    }