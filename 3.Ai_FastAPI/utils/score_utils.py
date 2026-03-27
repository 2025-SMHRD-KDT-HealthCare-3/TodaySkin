# 점수 계산하는 파일
# 여드름: 개수 + confidence => 여드름은 개수와 confidence가 직관적 핵심
# 모공: 개수 + 영역 크기 => 모공은 개수보다 영역감도 중요
# 최종 점수: 여드름 0.6 + 모공 0.4 => 최종 점수는 여드름을 더 비중 있게 보되, 모공도 반영
# 사용자 체감과 관리 우선순위를 반영한 가중합 설계

def clamp_score(x: float, min_v: int = 0, max_v: int = 100) -> float:
    return max(min_v, min(max_v, round(float(x), 2)))

def calculate_acne_score(acne_count: int, acne_conf_mean: float) -> float:
    return clamp_score(acne_count * 6 + acne_conf_mean * 30)

def calculate_pore_score(pore_count: int, pore_area_sum: float) -> float:
    return clamp_score(pore_count * 4 + pore_area_sum / 500)

def calculate_total_score(acne_score: float, pore_score: float) -> float:
    return clamp_score(acne_score * 0.6 + pore_score * 0.4)