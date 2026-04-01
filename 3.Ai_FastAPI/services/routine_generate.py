from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import json
import re

load_dotenv()
llm = ChatOpenAI(model="gpt-4o", max_tokens=2000)

def generate_routine(req):
    try:
        # 8일차 여부 판단
        is_week2 = req.chal_type == 14 and req.week == 2

        prompt = ChatPromptTemplate.from_template("""
당신은 15년 경력의 피부과 전문의이자 스킨케어 루틴 전문가입니다.
수천 명의 환자를 상담하며 피부 타입별, 나이별, 성별에 따른
맞춤형 스킨케어 루틴을 설계해온 전문가입니다.
아래 사용자 정보를 바탕으로 최적의 스킨케어 루틴을 추천해주세요.

[사용자 기본 정보]
- 나이: {age}세
- 성별: {gender}

[사용자 피부 정보]
- 피부 타입: {skin_type}
- 여드름 점수: {acne_score}점 (0~100, 높을수록 좋음)
- 모공 점수: {pore_score}점 (0~100, 높을수록 좋음)
- 종합 점수: {total_score}점 (0~100, 높을수록 좋음)

[챌린지 정보]
- 챌린지 유형: {chal_type}일 챌린지
- 현재 주차: {week}주차

[보유 화장품]
{user_cosmetics}

[추천 가능한 화장품 DB 목록]
{cosmetic_candidates}

{week2_prompt}

아래 규칙을 반드시 지켜주세요.
1. 나이와 성별에 따른 피부 특성을 반드시 고려해주세요.
   - 20대는 피지 조절과 트러블 케어 위주
   - 30대 이상은 안티에이징과 보습 강화
   - 남성은 피부 두께가 두껍고 유분이 많음을 고려
   - 여성은 호르몬 변화에 따른 피부 민감도 고려
2. 보유 화장품이 있으면 최대한 활용해주세요.
3. 보유 화장품이 부족한 단계는 추천 가능한 화장품 DB 목록에서 추천해주세요.
4. 둘 다 없으면 피부 타입에 맞는 일반적인 방법을 알려주세요. (cos_name은 null)
5. 반드시 아래 JSON 형식으로만 응답해주세요. 다른 텍스트는 절대 포함하지 마세요.

{{
    "morning": [
        {{"order": 1, "cos_name": "화장품 이름 또는 null", "description": "사용 방법 설명"}}
    ],
    "evening": [
        {{"order": 1, "cos_name": "화장품 이름 또는 null", "description": "사용 방법 설명"}}
    ],
    "special": [
        {{"order": 1, "cos_name": "화장품 이름 또는 null", "description": "사용 방법 설명"}}
    ]
}}
""")

        # 8일차 추가 프롬프트 내용
        week2_prompt = ""
        if is_week2:
            week2_prompt = f"""
[2주차 루틴 재설계 지침]
이 사용자는 14일 챌린지 8일차로 2주차 루틴을 새로 설계해야 합니다.
1주차 루틴 대비 아래 사항을 반드시 반영해주세요.

1. 점수 변화 반영
   - 1주차 대비 종합 점수: {req.total_score_change}점 변화
   - 점수가 낮아졌으면 (-) 해당 부위에 더 특화된 집중 케어 루틴 추가
   - 점수가 높아졌으면 (+) 현재 루틴 유지하되 한 단계 업그레이드

2. 루틴 준수율 반영
   - 1주차 루틴 준수율: {req.compliance_rate}%
   - 준수율 50% 미만이면 단계를 줄이고 더 간단한 루틴으로 변경
   - 준수율 80% 이상이면 더 전문적인 루틴으로 업그레이드
"""

        chain = prompt | llm
        result = chain.invoke({
            "age": req.age if req.age else "정보 없음",
            "gender": "남성" if req.gender == "M" else "여성" if req.gender == "F" else "정보 없음",
            "skin_type": req.skin_type if req.skin_type else "정보 없음",
            "acne_score": req.acne_score,
            "pore_score": req.pore_score,
            "total_score": req.total_score,
            "chal_type": req.chal_type,
            "week": req.week,
            "user_cosmetics": req.user_cosmetics if req.user_cosmetics else "없음",
            "cosmetic_candidates": req.cosmetic_candidates if req.cosmetic_candidates else "없음",
            "week2_prompt": week2_prompt  # ✅ 8일차면 추가 지침 들어감, 아니면 빈값
        })

       

        # 이하 기존 코드 동일
        # JSON 파싱
        raw = result.content.strip()
        raw = re.sub(r"```json|```", "", raw).strip()
        routine = json.loads(raw)

        return {
            "status": "success",
            "data": {
                "routine": {
                    # 백엔드가 cos_name으로 cos_no 조회 후 ROUTINES 테이블에 저장
                    "morning": routine.get("morning", []),
                    "evening": routine.get("evening", []),
                    "special": routine.get("special", [])
                }
            }
        }

    except json.JSONDecodeError:
        return {
            "status": "error",
            "data": {"message": "루틴 JSON 파싱에 실패했습니다. 다시 시도해주세요."}
        }

   
    except Exception as e:
        print(f"오류 발생: {e}")  # ✅ 추가
        return {
            "status": "error",
            "data": {"message": "루틴 생성 중 오류가 발생했습니다."}
        }