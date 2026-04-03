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
_llm = ChatOpenAI(model="gpt-5.4-mini", max_tokens=200)


# ========== 프롬프트 템플릿 ==========
_prompt = ChatPromptTemplate.from_template(
    """당신은 피부 관리 어드바이저입니다.
사용자의 피부 점수 변화를 보고 한줄 코멘트를 작성합니다.

[사용자 피부 정보]
- 피부 타입: {skin_type}
- 종합 점수: {total_score}점 (80+ 매우좋음 / 60~79 양호 / 40~59 관리필요 / 40 미만 집중관리)
- 이전 대비 변화: {total_change}

[규칙]
1. 반드시 1문장으로만 작성하세요.
2. 점수 변화량(올랐으면 +N점, 내려갔으면 -N점)만 언급하세요.
   절대 현재 점수 숫자는 쓰지 마세요.
3. 첫 분석이면 점수 언급 없이 환영 멘트로만 작성하세요.
4. 변화량 뒤에 공감/감정 멘트를 붙이세요.
5. 문장 끝에 이모지 1개만 붙이세요.
6. 다른 텍스트는 절대 포함하지 마세요.
""")


# ========== 체인 구성 ==========
_chain = _prompt | _llm


# ========== 데일리 코멘트 생성 ==========

def generate_daily_comment(req):
    """
    데일리 한줄 코멘트 생성
    - req: 요청 객체 (skin_type, total_score, prev_total_score 포함)
    - 첫 분석 시 prev_total_score = 0.0으로 들어옴
    - 에러 발생 시 글로벌 핸들러로 전달 (main.py)
    """
    # 첫 분석 여부 판별 — prev_total_score가 0.0이면 이전 분석 없음
    is_first = req.prev_total_score == 0.0

    if is_first:
        change_text = "첫 분석 (이전 데이터 없음)"
    else:
        diff = req.total_score - req.prev_total_score
        if diff > 0:
            change_text = f"+{diff:.1f} (개선)"
        elif diff < 0:
            change_text = f"{diff:.1f} (악화)"
        else:
            change_text = "0 (변화없음)"

    result = _chain.invoke({
        "skin_type": req.skin_type or "정보 없음",
        "total_score": req.total_score,
        "total_change": change_text,
    })

    # 백엔드가 받아서 DAILY_REPORTS 테이블에 저장
    return {
        "status": "success",
        "data": {
            "line_comment": result.content.strip()
        }
    }