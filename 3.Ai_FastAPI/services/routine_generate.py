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
from services.cosmetic_vector_search import search_cosmetic_candidates, fetch_user_cosmetics


logger = logging.getLogger(__name__)


# ========== LLM 설정 ==========
# 루틴 JSON이 복잡하므로 토큰 넉넉하게
_llm = ChatOpenAI(model="gpt-4o", max_tokens=1500)


# ========== 프롬프트 템플릿 ==========
_prompt = ChatPromptTemplate.from_template(
    """당신은 사용자의 피부 데이터를 기반으로 최상의 결과를 만들어내는 전문 에스테티션입니다.
단순히 화장품을 나열하는 것이 아니라, 사용자의 피부 상태에 맞춘 '체계적인 관리 프로그램'을 설계하는 것이 당신의 목표입니다.

[필독 - 처리 순서 및 규칙]
1. [이름 규칙 엄수] 모든 화장품 이름은 [보유 화장품] 및 [추천 후보 화장품 DB]에 있는 이름과 띄어쓰기, 대소문자까지 토씨 하나 틀리지 않게 똑같이 작성하세요. 목록에 없는 이름은 절대 사용하지 마세요.
2. [보유 제품 우선] 보유 화장품 중 현재 피부 상태에 적합한 것이 있다면 해당 단계에 최우선 배치합니다.
3. [부적합 시 교체] 보유 화장품이 피부 상태(점수)에 부적합할 경우에만 후보 DB에서 최적의 제품을 선택하세요.
4. [중복 금지] 아침/저녁 각 루틴 내에서 같은 유형(예: 토너 2개)의 제품은 절대 중복될 수 없습니다.

[루틴 설계 상세 규칙]
1. [세안 고정] 
   - 아침 1단계: 반드시 cos_name: "물 세안"으로 고정하세요.
   - 저녁 1단계: 보유/후보 중 가장 적합한 세안 제품(오일, 폼, 워터 등)을 선택하세요.

2. [단계 순서 엄수] 
   - [세안 -> 토너/패드 -> 세럼/앰플 -> 크림 -> 선케어(아침)] 순서를 따르며 필요한 단계만 구성하세요.

3. [단계 수 조절] 
   - 피부 상태에 따라 꼭 필요한 단계만 구성하며, 불필요하면 억지로 채우지 마세요.
   - 아침/저녁 루틴: 각각 최소 2단계, 최대 6단계
   - 스페셜 케어: 최소 1단계, 최대 3단계

4. [부적합 시 교체] 보유 화장품의 성분을 반드시 분석하세요.
     추천 후보 목록({cosmetic_candidates})에 완벽히 적합한 제품이 없더라도, 
     반드시 목록 내에 존재하는 제품 중에서만 선택하세요. 
     절대로 새로운 제품 이름을 창조하거나 기능을 이름으로 쓰지 마세요.
   - 지성 피부: 미네랄오일, 라놀린, 코코넛오일, 페트롤라툼 등 
     고유분 성분이 포함된 제품은 반드시 후보 DB에서 교체하세요.
   - 건성 피부: 살리실산, AHA/BHA 등 각질 제거 성분이 강한 제품은 교체하세요.
   - 복합성 피부: T존은 지성, U존은 건성 기준으로 판단하세요.
   - 여드름 점수 40 미만: 살리실산, 티트리, 나이아신아마이드 성분 제품으로 교체하세요.
   - 모공 점수 40 미만: 나이아신아마이드, 징크 성분 제품으로 교체하세요.
   - 위 조건에 해당하면 반드시 후보 DB에서 적합한 제품으로 교체하고 
     recommend_reason에 교체 이유를 성분 기반으로 설명하세요.

5. [스페셜 케어 가이드] 
    - 매일 하는 루틴이 아닌, **일주일에 1~2회만 실행하는 특별 관리 가이드**를 제안하세요.
    - 사용자의 **여드름 점수({acne_score})와 모공 점수({pore_score}) 중 더 낮은(나쁜) 점수를 기록한 항목**을 최우선 케어 대상으로 선정하세요. 점수가 비슷하다면 피부 타입({skin_type})에 가장 시급한 관리를 선택합니다.
    - 특정 제품을 추천하지 말고, **집에서 활용 가능한 도구(스팀 타월, 화장솜, 냉찜질팩 등)나 구체적인 관리 기법**을 활용한 행동 지침을 작성하세요. (예: 스팀 타월을 이용한 모공 이완 후 딥클렌징, 화장솜을 활용한 부분 진정 팩 등)
    - **반드시 cos_name: null** 로 작성하세요.
    - description: "[주 1~2회 권장] 구체적인 관리 방법 (1~2문장으로 상세히)"
    - recommend_reason: 현재 사용자의 특정 점수가 낮은 이유와 이 관리(도구 활용 포함)가 생리학적으로 왜 필요한지 연결하여 설명하세요.

[사용자 정보]
- 나이/성별: {age}세 / {gender}
- 피부타입: {skin_type} (여드름 점수: {acne_score}, 모공 점수: {pore_score})

2주차 챌린지 정보
{week2_prompt}

[보유 화장품 목록]
{user_cosmetics}

[추천 후보 화장품 DB]
{cosmetic_candidates}

반드시 아래 JSON 형식으로만 응답하세요. JSON 외의 설명이나 텍스트는 절대 포함하지 마세요.
{{
    "morning": [
        {{ "order": 1, "cos_name": "이름", "description": "사용 방법 또는 안내(1문장)", "recommend_reason": null }}
    ],
    "evening": [
        {{ "order": 1, "cos_name": "이름", "description": "사용 방법 또는 안내(1문장)", "recommend_reason": null }}
    ],
    "special": [
        {{ "order": 1, "cos_name": null, "description": "관리 방법 가이드(1문장)", "recommend_reason": "방법이 필요한 이유" }}
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
    # 벡터 검색으로 화장품 자동 조회
    user_cosmetics = fetch_user_cosmetics(req.user_no)
    cosmetic_candidates = search_cosmetic_candidates(
        skin_type=req.skin_type,
        acne_score=req.acne_score,
        pore_score=req.pore_score,
        user_cosmetics=user_cosmetics,
        top_k=25
    )

    def _format(cosmetics):
        if not cosmetics:
            return "없음"
        return "\n".join(
            f"- {c['cos_name']} / {c['cos_brand']} / {c['cos_type']} / {c['cos_ingredient']}"
            for c in cosmetics
        )
    #  후보군 데이터 포맷 함수 수정
    def _format_candidates(cosmetics):
        if not cosmetics:
            return "없음"
        # 후보군은 성분을 빼고 이름/브랜드/타입만 전달해서 토큰 절약!
        return "\n".join(
            f"- {c['cos_name']} / {c['cos_brand']} / {c['cos_type']}"
            for c in cosmetics
        )

    #  보유 제품은 성분 분석이 필요하므로 성분 포함
    def _format_owned(cosmetics):
        if not cosmetics:
            return "없음"
        return "\n".join(
            f"- {c['cos_name']} / {c['cos_brand']} / {c['cos_type']} / {c['cos_ingredient']}"
            for c in cosmetics
        )

    week2_prompt = _build_week2_prompt(req)
    """
    스킨케어 루틴 생성
    - req: 요청 객체 (age, gender, skin_type, 점수, 챌린지 정보, 화장품 목록 포함)
    - 14일 챌린지 2주차(8일차)에는 1주차 결과 반영하여 재설계
    - 에러 발생 시 글로벌 핸들러로 전달 (main.py)
    """

    result = _chain.invoke({
        "age": req.age or "정보 없음",
        "gender": "남성" if req.gender == "M" else "여성" if req.gender == "F" else "정보 없음",
        "skin_type": req.skin_type or "정보 없음",
        "acne_score": req.acne_score,
        "pore_score": req.pore_score,
        "chal_type": req.chal_type,
        "week": req.week,
        "user_cosmetics": _format_owned(user_cosmetics),    
        "cosmetic_candidates": _format_candidates(cosmetic_candidates),
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