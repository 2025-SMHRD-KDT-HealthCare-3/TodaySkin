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


logger = logging.getLogger(__name__)


# ========== LLM 설정 ==========
_llm = ChatOpenAI(model="gpt-5.4-mini", max_tokens=500)


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
1. 보유하지 않은 카테고리의 제품을 우선 추천하세요.
2. 보유한 카테고리라도 피부 타입과 점수에 맞지 않는 성분이면 교체를 추천하세요.
   - 예) 지성 피부인데 오일 성분 토너 → 오일프리 토너로 교체 추천
   - 예) 여드름 점수 낮은데 보습 세럼만 있음 → 살리실산 세럼으로 교체 추천
3. 주요성분의 기능을 분석하여 추천 이유를 작성하세요.
   (예: 히알루론산 → 보습, 살리실산 → 여드름 개선, 나이아신아마이드 → 미백/모공)
4. 점수가 낮은 항목일수록 해당 케어에 특화된 성분의 제품을 우선 추천하세요.
5. 카테고리별로 1~2개씩 추천하세요.
6. 반드시 아래 JSON 형식으로만 응답하세요. JSON 외의 텍스트는 절대 포함하지 마세요.

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
    """화장품 목록을 AI 프롬프트용 텍스트로 변환"""
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
    """
    화장품 추천 생성
    - req: 사용자 요청 객체 (skin_type, 점수, 후보 목록, 보유 카테고리 포함)
    - 보유하지 않은 카테고리 우선 → 성분 기반 추천
    - JSON 파싱 실패 시 에러를 raise하여 글로벌 핸들러로 전달
    """
    candidate_types = set(c["cos_type"] for c in (req.cosmetic_candidates or []))
    owned = set(req.owned_categories or [])
    missing_types = candidate_types - owned

    # 모든 카테고리 보유 시 빈 추천 반환
    if not missing_types and owned:
        return {
            "status": "success",
            "data": {
                "recommendations": [],
                "message": "모든 카테고리의 화장품을 보유하고 있습니다."
            }
        }

    candidates_text = _format_cosmetics_for_ai(req.cosmetic_candidates)

    result = _chain.invoke({
        "skin_type": req.skin_type or "정보 없음",
        "acne_score": req.acne_score,
        "pore_score": req.pore_score,
        "missing_categories": ", ".join(missing_types) if missing_types else "없음",
        "owned_categories": ", ".join(owned) if owned else "없음",
        "candidates": candidates_text,
    })

    # LLM 응답 JSON 파싱
    raw = result.content.strip()
    raw = re.sub(r"```json|```", "", raw).strip()
    parsed = json.loads(raw)

    return {
        "status": "success",
        "data": {
            "recommendations": parsed.get("recommendations", [])
        }
    }