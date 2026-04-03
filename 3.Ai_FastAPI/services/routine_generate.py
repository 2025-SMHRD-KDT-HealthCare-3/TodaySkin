# ──────────────────────────────────────────────
# * 루틴 생성 서비스 (routine_generate.py)
# - 사용자 피부 점수 + 보유 화장품 + 후보 DB 기반 루틴 설계
# - 아침/저녁/스페셜 3파트 구성
# - 14일 챌린지 8일차(2주차)에는 1주차 결과 기반 재설계
# - JSON 형식 응답
# ──────────────────────────────────────────────


import json
import re
import logging

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate


logger = logging.getLogger(__name__)


# ========== LLM 설정 ==========
# 루틴 JSON이 복잡하므로 토큰 넉넉하게
_llm = ChatOpenAI(model="gpt-5.4-mini", max_tokens=1000)


# ========== 프롬프트 템플릿 ==========
_prompt = ChatPromptTemplate.from_template(
    """당신은 스킨케어 루틴 설계 어드바이저입니다.
사용자의 피부 상태와 보유 화장품을 고려하여 아침/저녁/스페셜 루틴을 설계합니다.

[사용자 기본 정보]
- 나이: {age}세
- 성별: {gender}

[사용자 피부 정보]
- 피부 타입: {skin_type}
- 여드름 점수: {acne_score}점 (80+ 매우좋음 / 60~79 양호 / 40~59 관리필요 / 40 미만 집중관리)
- 모공 점수: {pore_score}점 (80+ 매우좋음 / 60~79 양호 / 40~59 관리필요 / 40 미만 집중관리)

[챌린지 정보]
- 챌린지 유형: {chal_type}일 챌린지
- 현재 주차: {week}주차

[보유 화장품]
{user_cosmetics}

[추천 후보 화장품 DB]
{cosmetic_candidates}

{week2_prompt}

[루틴 설계 규칙]
0. [필독 - 이름 규칙] 화장품 이름은 반드시 추천 후보 화장품 DB에 있는 이름과
   띄어쓰기, 대소문자까지 토씨 하나 틀리지 않게 똑같이 작성하세요.
   목록에 없는 화장품은 절대 추천하지 마세요.

1. [필독 - 세안 고정]
   - 아침 루틴 1단계는 반드시 cos_name: "물 세안" 으로 고정하세요.
   - 저녁 루틴 1단계는 반드시 cos_name: "오일 클렌저" 또는 "폼 클렌저"로 고정하세요.
   - 세안 다음 단계부터 토너, 세럼 등 케어 제품을 구성하세요.

2. 나이, 성별, 피부 타입, 점수를 종합적으로 고려하여 루틴을 설계하세요.
   - 20대는 피지 조절과 트러블 케어 위주
   - 30대 이상은 안티에이징과 보습 강화
   - 남성은 피부 두께가 두껍고 유분이 많음을 고려
   - 여성은 호르몬 변화에 따른 피부 민감도 고려

3. 보유 화장품을 최대한 활용하세요.

4. 보유 화장품으로 부족한 단계는 추천 후보 DB에서 선택하세요.

5. [단계 수] 피부 상태와 보유 화장품에 따라 필요한 단계만 구성하세요.
   - 단계가 필요 없으면 억지로 채우지 마세요.
   - 아침/저녁 각각 최소 1단계, 최대 6단계
   - 스페셜은 최소 1단계, 최대 3단계

6. [화장품 없는 단계] 보유 화장품도 없고 추천 후보 DB에도 없는 단계는
   일반적인 방법 대신 아래 형식으로 작성하세요.
   - cos_name: null
   - description: "이 단계에는 [추천 화장품 유형]이 필요해요. [추천 이유]"
   - recommend_reason: "[성분/기능 기반 추천 이유]"

7. [스페셜 케어] 주 1~2회 하는 집중 케어예요.
   - 반드시 아침/저녁 루틴과 완전히 다른 제품으로만 구성하세요.
   - 아침/저녁에 사용한 제품은 스페셜에 절대 포함하지 마세요.
   - 스페셜 케어는 반드시 아래 유형에서만 선택하세요:
     * 마스크팩 (클레이팩, 시트팩, 수면팩)
     * 각질제거 (스크럽, 필링젤, 고마쥐)
     * 앰플 집중 케어
     * 딥클렌징
   - 보유 화장품 중 위 유형에 해당하는 제품 우선 활용
   - 없으면 추천 후보 DB에서 찾고
   - 그것도 없으면 cos_name: null 로 하고
     description에 필요한 제품 유형과 이유를 안내하세요.

8. 반드시 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.

{{
    "morning": [
        {{
            "order": 1,
            "cos_name": "화장품 이름 또는 null",
            "description": "사용 방법 설명 또는 필요한 화장품 안내 (1문장)",
            "recommend_reason": "화장품 없는 단계일 때만 추천 이유 작성, 있으면 null"
        }}
    ],
    "evening": [
        {{
            "order": 1,
            "cos_name": "화장품 이름 또는 null",
            "description": "사용 방법 설명 또는 필요한 화장품 안내 (1문장)",
            "recommend_reason": "화장품 없는 단계일 때만 추천 이유 작성, 있으면 null"
        }}
    ],
    "special": [
        {{
            "order": 1,
            "cos_name": "화장품 이름 또는 null",
            "description": "주 1~2회 스페셜 케어 방법 (1문장)",
            "recommend_reason": "화장품 없는 단계일 때만 추천 이유 작성, 있으면 null"
        }}
    ]
}}""")

# ========== 체인 구성 ==========
_chain = _prompt | _llm


# ========== 2주차 재설계 프롬프트 생성 ==========

def _build_week2_prompt(req) -> str:
    """14일 챌린지 2주차일 때만 재설계 지침 반환, 아니면 빈 문자열"""
    if req.chal_type != 14 or req.week != 2:
        return ""

    return f"""[2주차 루틴 재설계 지침]
1주차 대비 아래 사항을 반영하세요.
- 종합 점수 변화: {req.total_score_change}점
  → 점수 하락 시 해당 부위 집중 케어 추가 / 상승 시 현재 방향 유지하며 한 단계 업그레이드
- 1주차 루틴 준수율: {req.compliance_rate}%
  → 50% 미만이면 단계를 줄여 간소화 / 80% 이상이면 단계 추가 가능"""


# ========== 루틴 생성 ==========

def generate_routine(req):
    """
    스킨케어 루틴 생성
    - req: 요청 객체 (age, gender, skin_type, 점수, 챌린지 정보, 화장품 목록 포함)
    - 14일 챌린지 2주차(8일차)에는 1주차 결과 반영하여 재설계
    - 에러 발생 시 글로벌 핸들러로 전달 (main.py)
    """
    week2_prompt = _build_week2_prompt(req)

    result = _chain.invoke({
        "age": req.age or "정보 없음",
        "gender": "남성" if req.gender == "M" else "여성" if req.gender == "F" else "정보 없음",
        "skin_type": req.skin_type or "정보 없음",
        "acne_score": req.acne_score,
        "pore_score": req.pore_score,
        "chal_type": req.chal_type,
        "week": req.week,
        "user_cosmetics": req.user_cosmetics or "없음",
        "cosmetic_candidates": req.cosmetic_candidates or "없음",
        "week2_prompt": week2_prompt,
    })

    # LLM 응답 JSON 파싱 — ```json 블록 제거 후 파싱
    raw = result.content.strip()
    raw = re.sub(r"```json|```", "", raw).strip()
    routine = json.loads(raw)

    return {
        "status": "success",
        "data": {
            "routine": {
                "morning": routine.get("morning", []),
                "evening": routine.get("evening", []),
                "special": routine.get("special", []),
            }
        }
    }