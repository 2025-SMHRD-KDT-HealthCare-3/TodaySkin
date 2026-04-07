# ──────────────────────────────────────────────
# * 화장품 추천 서비스 (cosmetics_recommend.py)
# - 사용자 피부 상태 + 성분 분석 기반 맞춤 화장품 추천
# - LangChain + OpenAI API 활용
# - 보유하지 않은 카테고리 우선 추천
# ──────────────────────────────────────────────

import json
import re
import logging

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from services.cosmetic_vector_search import search_cosmetic_candidates, fetch_user_cosmetics

logger = logging.getLogger(__name__)

# ========== LLM 설정 ==========
_llm = ChatOpenAI(model="gpt-4o", max_tokens=500)

# ========== 프롬프트 템플릿 ==========
_prompt = ChatPromptTemplate.from_template(
    """당신은 화장품 성분 분석 기반 추천 어드바이저입니다.
성분표를 분석하여 사용자의 피부 상태에 가장 적합한 화장품을 추천합니다.

[사용자 기본 정보]
- 나이: {age}세
- 성별: {gender}

[사용자 피부 정보]
- 피부 타입: {skin_type}
- 여드름 점수: {acne_score}점 (80+ 매우좋음 / 60~79 양호 / 40~59 관리필요 / 40 미만 집중관리)
- 모공 점수: {pore_score}점 (80+ 매우좋음 / 60~79 양호 / 40~59 관리필요 / 40 미만 집중관리)

[사용자가 보유하지 않은 카테고리]
{missing_categories}

[사용자가 보유한 카테고리]
{owned_categories}

[추천 후보 화장품 목록]
{candidates}

[추천 규칙]
0. [필독] 화장품 이름은 반드시 추천 후보 목록에 있는 이름과
   띄어쓰기, 대소문자까지 토씨 하나 틀리지 않게 똑같이 작성하세요.
   목록에 없는 화장품은 절대 추천하지 마세요.
1. 나이와 성별을 고려해서 추천하세요.
   - 20대: 트러블/피지 케어 성분 우선
   - 30대 이상: 안티에이징/보습 성분 우선
   - 남성: 가벼운 제형 위주
   - 여성: 호르몬 변화 고려한 진정 성분
2. 보유하지 않은 카테고리의 제품을 우선 추천하세요.
3. 보유한 카테고리라도 피부 타입과 점수에 맞지 않는 성분이면 교체를 추천하세요.
   - 예) 지성 피부인데 오일 성분 토너 → 오일프리 토너로 교체 추천
   - 예) 여드름 점수 낮은데 보습 세럼만 있음 → 살리실산 세럼으로 교체 추천
4. 주요성분의 기능을 분석하여 추천 이유를 작성하세요.
   (예: 히알루론산 → 보습, 살리실산 → 여드름 개선, 나이아신아마이드 → 미백/모공)
5. 점수 구간에 따라 추천 우선순위를 정하세요.
   - 40 미만 (집중관리): 해당 케어 특화 성분 제품만 추천
   - 40~59 (관리필요): 해당 케어 성분 포함 제품 우선 추천
   - 60 이상 (양호/좋음): 현재 상태 유지 성분 추천
6. 카테고리별로 1~2개씩 추천하세요.
7. 반드시 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.

{{
    "recommendations": [
        {{
            "cos_name": "제품명",
            "cos_brand": "브랜드명",
            "cos_type": "제품유형",
            "reason": "추천 이유 (성분 기반 1~2문장)"
        }}
    ]
}}""")

# ========== 체인 구성 ==========
_chain = _prompt | _llm

# ========== 헬퍼 함수 ==========
def _format_cosmetics_for_ai(cosmetics: list) -> str:
    if not cosmetics:
        return "없음"
    lines = []
    for c in cosmetics:
        lines.append(
            f"- 제품명: {c['cos_name']} / 브랜드: {c['cos_brand']} / "
            f"유형: {c['cos_type']} / 주요성분: {c['cos_ingredient']}"
        )
    return "\n".join(lines)

# ========== 화장품 추천 ==========
def recommend_cosmetics(req):
    user_cosmetics = fetch_user_cosmetics(req.user_no)
    cosmetic_candidates = search_cosmetic_candidates(
        skin_type=req.skin_type,
        acne_score=req.acne_score,
        pore_score=req.pore_score,
        user_cosmetics=user_cosmetics,
        top_k=10
    )

    candidate_types = set(c["cos_type"] for c in cosmetic_candidates)
    owned = set(c["cos_type"] for c in user_cosmetics)
    missing_types = candidate_types - owned

    if not missing_types and owned:
        return {
            "status": "success",
            "data": {
                "recommendations": [],
                "message": "모든 카테고리의 화장품을 보유하고 있습니다."
            }
        }

    candidates_text = _format_cosmetics_for_ai(cosmetic_candidates)

    result = _chain.invoke({
        "age": req.age or "정보 없음",                                                          # ✅ 추가
        "gender": "남성" if req.gender == "M" else "여성" if req.gender == "F" else "정보 없음", # ✅ 추가
        "skin_type": req.skin_type or "정보 없음",
        "acne_score": req.acne_score,
        "pore_score": req.pore_score,
        "missing_categories": ", ".join(missing_types) if missing_types else "없음",
        "owned_categories": ", ".join(owned) if owned else "없음",
        "candidates": candidates_text,
    })

    raw = result.content.strip()
    raw = re.sub(r"```json|```", "", raw).strip()
    parsed = json.loads(raw)

    return {
        "status": "success",
        "data": {
            "recommendations": parsed.get("recommendations", [])
        }
    }