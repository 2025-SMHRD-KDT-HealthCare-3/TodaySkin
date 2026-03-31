# 3.Ai_FastAPI/utils/score_utils.py
# 점수 계산하는 파일
# 여드름: 개수 + confidence => 여드름은 개수와 confidence가 직관적 핵심
# 모공: 개수 + 영역 크기 => 모공은 개수보다 영역감도 중요
# 최종 점수: 여드름 0.7 + 모공 0.3 => 최종 점수는 여드름을 더 비중 있게 보되, 모공도 반영
# 사용자 체감과 관리 우선순위를 반영한 가중합 설계

from typing import Any

# =========================
# 점수 정책
# - 점수가 높을수록 피부 상태가 좋음
# - 여드름: count 중심 + confidence 보조
# - 모공: count + area_ratio(박스 면적 / 전체 이미지 면적) 반영
# - total_score: 여드름 0.7 + 모공 0.3 가중합
# =========================

ACNE_WEIGHT = 0.7
PORE_WEIGHT = 0.3

ACNE_CONF_WEIGHT = 0.5

PORE_COUNT_WEIGHT = 0.5
PORE_AREA_WEIGHT = 5000.0
# area_ratio는 매우 작은 값이라 스케일을 키워 반영


def _safe_avg(values: list[float]) -> float:
    """리스트 평균. 비어있으면 0.0 반환."""
    if not values:
        return 0.0
    return sum(values) / len(values)


def _clamp_score(score: float) -> int:
    """0~100 범위 정수로 보정."""
    return max(0, min(100, round(score)))


def _calculate_acne_severity(count: int, confidences: list[float]) -> float:
    """
    여드름 심각도 계산
    - count 중심
    - confidence는 보조
    """
    if count == 0:
        return 0.0

    avg_conf = _safe_avg(confidences)
    return round(count + (avg_conf * ACNE_CONF_WEIGHT), 4)


def _calculate_pore_severity(count: int, area_ratios: list[float]) -> float:
    """
    모공 심각도 계산
    - count 반영
    - 평균 area_ratio 반영
    """
    if count == 0:
        return 0.0

    avg_area_ratio = _safe_avg(area_ratios)

    return round(
        (count * PORE_COUNT_WEIGHT) + (avg_area_ratio * PORE_AREA_WEIGHT),
        4
    )


def _acne_severity_to_score(severity: float) -> int:
    """여드름 심각도 -> 점수"""
    if severity <= 0:
        return 100
    elif severity <= 1.5:
        return 85
    elif severity <= 3:
        return 70
    elif severity <= 5:
        return 55
    elif severity <= 7:
        return 40
    elif severity <= 10:
        return 25
    elif severity <= 14:
        return 10
    else:
        return 0


def _pore_severity_to_score(severity: float) -> int:
    """모공 심각도 -> 점수"""
    if severity <= 0:
        return 100
    elif severity <= 1.5:
        return 90
    elif severity <= 3:
        return 80
    elif severity <= 5:
        return 65
    elif severity <= 7:
        return 50
    elif severity <= 9:
        return 35
    elif severity <= 12:
        return 20
    else:
        return 0


def calculate_skin_score(analysis_result: dict[str, Any]) -> dict[str, Any]:
    """
    추론 결과를 받아 피부 점수를 계산합니다.
    """
    acne = analysis_result.get("acne", {})
    pore = analysis_result.get("pore", {})

    acne_count = int(acne.get("count", 0) or 0)
    pore_count = int(pore.get("count", 0) or 0)

    acne_confidences = acne.get("confidences") or []
    pore_area_ratios = pore.get("area_ratios") or []

    acne_severity = _calculate_acne_severity(acne_count, acne_confidences)
    pore_severity = _calculate_pore_severity(pore_count, pore_area_ratios)

    acne_score = _acne_severity_to_score(acne_severity)
    pore_score = _pore_severity_to_score(pore_severity)

    total_score = _clamp_score(
        (acne_score * ACNE_WEIGHT) + (pore_score * PORE_WEIGHT)
    )

    return {
        "acne_score": acne_score,
        "pore_score": pore_score,
        "total_score": total_score,
    }