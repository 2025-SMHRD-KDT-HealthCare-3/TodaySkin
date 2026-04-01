# ──────────────────────────────────────────────
# 데일리 코멘트 서비스 (daily_comment_service.py)
# - 오늘 피부 종합 점수와 이전 대비 변화량 기반 한줄 코멘트 생성
# - 텍스트 응답 (JSON 아님)
# ──────────────────────────────────────────────

from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
import logging

load_dotenv()
logger = logging.getLogger(__name__)

# ── LLM 설정 ──
# 한줄 코멘트라 토큰 적게 필요
llm = ChatOpenAI(model="gpt-5.4-mini", max_tokens=200)


def generate_daily_comment(req):
    """
    데일리 한줄 코멘트 생성
    - req: 요청 객체 (skin_type, total_score, prev_total_score 포함)
    - 첫 분석 시 prev_total_score = 0.0으로 들어옴
    """
    try:
        # ── 첫 분석 여부 판별 ──
        # prev_total_score가 0.0이면 이전 분석 없음 → 첫 분석
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

        # ── 프롬프트 ──
        prompt = ChatPromptTemplate.from_template(
            """당신은 피부 관리 어드바이저입니다.
            사용자의 피부 점수 변화를 보고 한줄 코멘트를 작성합니다.
            
            [사용자 피부 정보]
            - 피부 타입: {skin_type}
            - 종합 점수: {total_score}점 (80+ 매우좋음 / 60~79 양호 / 40~59 관리필요 / 40 미만 집중관리)
            - 이전 대비 변화: {total_change}

            [규칙]
            1. 반드시 1문장으로만 작성하세요.
            2. 점수가 올라갔으면 칭찬, 내려갔으면 따뜻한 격려, 변화 없으면 유지 응원 톤으로 작성하세요.
            3. 첫 분석인 경우 환영 인사와 함께 현재 점수에 대한 코멘트를 작성하세요.
            4. 전문적이지만 친근한 톤으로 작성하세요.
            5. 코멘트 1문장만 출력하세요. 다른 텍스트는 절대 포함하지 마세요.
            """)

        # ── 체인 실행 ──
        chain = prompt | llm
        result = chain.invoke({
            "skin_type": req.skin_type or "정보 없음",
            "total_score": req.total_score,
            "total_change": change_text,
        })

        return {
            "status": "success",
            "data": {
                # 백엔드가 받아서 DAILY_REPORTS 테이블에 저장
                "line_comment": result.content.strip()
            }
        }

    except Exception as e:
        logger.error(f"데일리 코멘트 생성 오류: {e}")
        return {
            "status": "error",
            "data": {"message": "코멘트 생성 중 오류가 발생했습니다."}
        }