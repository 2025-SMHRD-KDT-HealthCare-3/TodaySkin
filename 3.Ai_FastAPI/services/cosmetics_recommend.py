# ──────────────────────────────────────────────
# 화장품 추천 서비스 (cosmetic_recommend_service.py)
# - 사용자 피부 점수 + 루틴에 빠진 카테고리 기반 맞춤 추천
# - 후보 화장품 목록 내에서만 성분 분석 기반 추천
# - JSON 형식으로 응답 → 프론트 추천 탭에 표시
# ──────────────────────────────────────────────

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import json
import re
import logging

load_dotenv()
logger = logging.getLogger(__name__)

# ── LLM 설정 ──
# 추천은 JSON 정확도가 중요하므로 성능 좋은 모델 사용
llm = ChatOpenAI(model="gpt-5.4-mini", max_tokens=500)


def format_cosmetics_for_ai(cosmetics: list) -> str:
    """
    후보 화장품 리스트를 프롬프트에 주입할 텍스트로 변환
    - cosmetics: [{ cos_name, cos_brand, cos_type, cos_ingredient }, ...]
    """
    if not cosmetics:
        return "없음"
    lines = []
    for c in cosmetics:
        lines.append(
            f"- 제품명: {c['cos_name']} / 브랜드: {c['cos_brand']} / "
            f"유형: {c['cos_type']} / 주요성분: {c['cos_ingredient']}"
        )
    return "\n".join(lines)


def recommend_cosmetics(req):
    """
    화장품 추천 생성
    - req: 요청 객체 (skin_type, acne_score, pore_score,
           owned_categories, cosmetic_candidates 포함)
    - 모든 카테고리를 보유한 경우 추천하지 않고 빈 배열 반환
    """
    try:
        # ── 모든 카테고리 보유 시 추천 불필요 ──
        # owned_categories: 사용자 루틴에 이미 있는 카테고리 목록 (예: ["스킨", "에센스"])
        # cosmetic_candidates 의 cos_type 종류와 비교하여 빠진 카테고리가 없으면 스킵
        candidate_types = set(c["cos_type"] for c in (req.cosmetic_candidates or []))
        owned = set(req.owned_categories or [])
        missing_types = candidate_types - owned

        if not missing_types:
            return {
                "status": "success",
                "data": {
                    "recommendations": [],
                    "message": "모든 카테고리의 화장품을 보유하고 있습니다."
                }
            }

        # ── 후보 목록 포맷팅 ──
        candidates_text = format_cosmetics_for_ai(req.cosmetic_candidates)

        # ── 프롬프트 ──
        prompt = ChatPromptTemplate.from_template(
            """당신은 화장품 성분 분석 기반 추천 어드바이저입니다.
            성분표를 분석하여 사용자의 피부 상태에 가장 적합한 화장품을 추천합니다.

[사용자 피부 정보]
- 피부 타입: {skin_type}
- 여드름 점수: {acne_score}점 (80+ 매우좋음 / 60~79 양호 / 40~59 관리필요 / 40 미만 집중관리)
- 모공 점수: {pore_score}점 (80+ 매우좋음 / 60~79 양호 / 40~59 관리필요 / 40 미만 집중관리)

[사용자가 보유하지 않은 카테고리]
{missing_categories}

[추천 후보 화장품 목록]
{candidates}

[추천 규칙]
1. 위 목록 안에서만 추천하세요. 목록에 없는 제품은 절대 추천하지 마세요.
2. 사용자가 보유하지 않은 카테고리의 제품만 추천하세요.
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

        # ── 체인 실행 ──
        chain = prompt | llm
        result = chain.invoke({
            "skin_type": req.skin_type or "정보 없음",
            "acne_score": req.acne_score,
            "pore_score": req.pore_score,
            "missing_categories": ", ".join(missing_types),
            "candidates": candidates_text,
        })

        # ── JSON 파싱 ──
        # GPT가 간혹 ```json 블록으로 감싸는 경우 제거
        raw = result.content.strip()
        raw = re.sub(r"```json|```", "", raw).strip()
        parsed = json.loads(raw)

        return {
            "status": "success",
            "data": {
                "recommendations": parsed.get("recommendations", [])
            }
        }

    except json.JSONDecodeError:
        logger.error("화장품 추천 JSON 파싱 실패")
        return {
            "status": "error",
            "data": {"message": "추천 결과 파싱에 실패했습니다. 다시 시도해주세요."}
        }

    except Exception as e:
        logger.error(f"화장품 추천 오류: {e}")
        return {
            "status": "error",
            "data": {"message": "화장품 추천 중 오류가 발생했습니다."}
        }