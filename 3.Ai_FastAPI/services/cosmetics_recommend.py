from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import json
import re

load_dotenv()

llm = ChatOpenAI(model="gpt-4o", max_tokens=1500)

# cos_ingredient, cos_function 추가
def format_cosmetics_for_ai(cosmetics: list) -> str:
    if not cosmetics:
        return "없음"
    lines = []
    for c in cosmetics:
        lines.append(
            f"- 제품명: {c['cos_name']} / 브랜드: {c['cos_brand']} / "
            f"유형: {c['cos_type']} / 주요성분: {c['cos_ingredient']} / "

        )
    return "\n".join(lines)

def recommend_cosmetics(req):
    try:
        candidates_text = format_cosmetics_for_ai(req.cosmetic_candidates)

        

        prompt = ChatPromptTemplate.from_template("""
당신은 15년 경력의 코스메틱 성분 분석 전문가이자 피부 관리 컨설턴트입니다.
성분표만 보고도 제품의 효능과 피부 적합성을 정확히 판단할 수 있으며,
수많은 고객의 피부 타입에 맞는 화장품을 추천해온 전문가입니다.
아래 사용자 피부 정보를 바탕으로 최적의 화장품을 추천해주세요.

[사용자 피부 정보]
- 피부 타입: {skin_type}
- 여드름 점수: {acne_score}점 (0~100, 높을수록 좋음)
- 모공 점수: {pore_score}점 (0~100, 높을수록 좋음)
- 종합 점수: {total_score}점 (0~100, 높을수록 좋음)

[추천 가능한 화장품 목록]
{candidates}

아래 규칙을 반드시 지켜주세요.
1. 위 목록 안에서만 추천해주세요. 목록에 없는 제품은 절대 추천하지 마세요.
2. 주요성분을 분석해서 해당 성분의 기능을 직접 파악해서 추천해주세요.
   - 예) 히알루론산 → 보습, 살리실산 → 여드름 개선, 나이아신아마이드 → 미백/모공
3. 여드름/모공 점수가 낮을수록 해당 케어에 특화된 성분을 우선 추천해주세요.
4. 카테고리(유형)별로 1~2개씩 추천해주세요.
5. 반드시 아래 JSON 형식으로만 응답해주세요. 다른 텍스트는 절대 포함하지 마세요.

{{
    "recommendations": [
        {{
            "cos_name": "제품명",
            "cos_brand": "브랜드명",
            "cos_type": "제품유형",
            "reason": "추천 이유 (성분 기반으로 기능 분석해서 설명)"
        }}
    ]
}}
""")

        chain = prompt | llm
        result = chain.invoke({
            "skin_type": req.skin_type if req.skin_type else "정보 없음",
            "acne_score": req.acne_score,
            "pore_score": req.pore_score,
            "total_score": req.total_score,
            "candidates": candidates_text
        })

        # JSON 파싱
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
        return {
            "status": "error",
            "data": {"message": "추천 결과 파싱에 실패했습니다. 다시 시도해주세요."}
        }

    except Exception as e:
        return {
            "status": "error",
            "data": {"message": "화장품 추천 중 오류가 발생했습니다."}
        }