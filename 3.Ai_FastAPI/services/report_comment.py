from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import json
import re

load_dotenv()

llm = ChatOpenAI(model="gpt-4o-mini", max_tokens=500) 

def generate_daily_comment(req):
    try:
        acne_change = req.acne_score - req.prev_acne_score
        pore_change = req.pore_score - req.prev_pore_score
        total_change = req.total_score - req.prev_total_score


        # 변화량 텍스트 변환 (+ / - 표시)
        def format_change(val):
            if val > 0:
                return f"+{val:.1f} (개선)"   # ✅ 올라가면 개선
            elif val < 0:
                return f"{val:.1f} (악화)"    # ✅ 내려가면 악화
            else:
                return "0 (변화없음)"



        prompt = ChatPromptTemplate.from_template("""
당신은 15년 경력의 피부 관리 전문가이자 동기부여 코치입니다.
매일 고객의 피부 변화 데이터를 분석하고 긍정적인 피드백으로
꾸준한 피부 관리를 도와온 전문가입니다.
아래 사용자의 오늘 피부 데이터를 바탕으로 한줄 코멘트를 작성해주세요.

[사용자 피부 정보]
- 피부 타입: {skin_type}

[오늘 피부 점수]
- 여드름 점수: {acne_score}점 (0~100, 높을수록 좋음)
- 모공 점수: {pore_score}점 (0~100, 높을수록 좋음)
- 종합 점수: {total_score}점 (0~100, 높을수록 좋음)
                                                  
[이전 대비 변화량]
- 여드름: {acne_change}
- 모공: {pore_change}
- 종합: {total_change}

아래 규칙을 반드시 지켜주세요.
1. 반드시 1문장으로만 작성해주세요.
2. 점수 변화를 반드시 반영해서 작성해주세요.
3. 점수가 올라갔으면 칭찬, 점수가 내려갔으면 따뜻한 격려 톤으로 작성해주세요.
4. 반드시 아래 JSON 형식으로만 응답해주세요. 다른 텍스트는 절대 포함하지 마세요.

{{
    "line_comment": "한줄 코멘트 내용"
}}
""")

        chain = prompt | llm
        result = chain.invoke({
            "skin_type": req.skin_type if req.skin_type else "정보 없음",
            "acne_score": req.acne_score,
            "pore_score": req.pore_score,
            "total_score": req.total_score,
            "acne_change": format_change(acne_change),
            "pore_change": format_change(pore_change),
            "total_change": format_change(total_change),
           
        })

        # JSON 파싱
        raw = result.content.strip()
        raw = re.sub(r"```json|```", "", raw).strip()
        parsed = json.loads(raw)

        return {
            "status": "success",
            "data": {
                # 백엔드가 받아서 DAILY_REPORTS 테이블에 저장
                "line_comment": parsed.get("line_comment", "")
            }
        }

    except json.JSONDecodeError:
        return {
            "status": "error",
            "data": {"message": "코멘트 파싱에 실패했습니다. 다시 시도해주세요."}
        }

    except Exception as e:
        return {
            "status": "error",
            "data": {"message": "코멘트 생성 중 오류가 발생했습니다."}
        }