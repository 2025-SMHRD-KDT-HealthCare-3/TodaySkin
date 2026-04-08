# ──────────────────────────────────────────────
# * 데일리 코멘트 서비스 (report_comment.py)
# - 오늘 피부 종합 점수와 이전 대비 변화량 기반 한줄 코멘트 생성
# - 텍스트 응답 (JSON 아님)
# ──────────────────────────────────────────────


import logging

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate


logger = logging.getLogger(__name__)


# ========== LLM 설정 ==========
# 한줄 코멘트라 토큰 적게 필요
_llm = ChatOpenAI(model="gpt-4o-mini", max_tokens=200)




# ========== 프롬프트 템플릿 ==========
_prompt = ChatPromptTemplate.from_template(
    """당신은 피부 관리 어드바이저입니다.
사용자의 현재 여드름과 모공 점수를 분석하여 전문적인 한줄 코멘트를 작성합니다.

[점수 가이드]
- 80점 이상: 매우 좋음 (칭찬)
- 60~79점: 양호 (유지 권장)
- 40~59점: 관리 필요 (주의 및 조언)
- 40점 미만: 집중 관리 (강한 주의 및 격려)

[분석 정보]
- 피부 타입: {skin_type}
- 현재 여드름 점수: {acne_score}점
- 현재 모공 점수: {pore_score}점

[작성 규칙]
1. 반드시 딱 1문장으로만 작성하세요.
2. 현재 점수 수치(숫자)는 코멘트에 직접 포함하지 마세요. (상태 위주로 설명)
3. 여드름과 모공 상태 중 더 관리가 시급하거나 특징적인 부분을 강조하세요.
4. 사용자에게 친절하면서도 전문적인 느낌을 주어야 합니다.
5. 문장 끝에 상황에 어울리는 이모지 1개를 사용하세요.
6. 다른 설명 텍스트는 절대 포함하지 마세요.
""")

# ========== 체인 구성 ==========
_chain = _prompt | _llm

# ========== 데일리 코멘트 생성 ==========

def generate_daily_comment(req):
    """
    오늘의 여드름/모공 점수 기반 한줄 진단 생성
    """
    # 이전 데이터 비교 로직을 삭제하고 현재 점수만 전달
    result = _chain.invoke({
        "skin_type": req.skin_type or "정보 없음",
        "acne_score": req.acne_score,
        "pore_score": req.pore_score,
    })

    return {
        "status": "success",
        "data": {
            "line_comment": result.content.strip()
        }
    }