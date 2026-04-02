# ──────────────────────────────────────────────
# * 챗봇 서비스 (chatbot_message.py)
# - 사용자 피부 상태 기반 맞춤 피부 상담 챗봇
# - LangChain + OpenAI API 활용
# - 세션별 대화 히스토리 유지 (메모리 기반, 서버 재시작 시 초기화)
# ──────────────────────────────────────────────


import logging
from datetime import datetime

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory


logger = logging.getLogger(__name__)


# ========== LLM 설정 ==========
# max_tokens: 3~4문장 답변 기준 500이면 충분
llm = ChatOpenAI(model="gpt-5.4-mini", max_tokens=500)


# ========== 세션별 대화 히스토리 ==========
# key: user_no(문자열), value: InMemoryChatMessageHistory
# ⚠️ 메모리 기반 — 서버 재시작 시 초기화 / 사용자 증가 시 메모리 관리 필요
_store = {}

def _get_session_history(session_id: str):
    """세션 ID(user_no)로 대화 히스토리 조회, 없으면 새로 생성"""
    if session_id not in _store:
        _store[session_id] = InMemoryChatMessageHistory()
    return _store[session_id]


# ========== 프롬프트 템플릿 ==========
# system: 역할 정의 + 사용자 컨텍스트 + 판단 기준 + 규칙
# history: 이전 대화 내역 (LangChain이 자동 주입)
# input: 사용자의 현재 메시지

_chat_prompt = ChatPromptTemplate.from_messages([
    ("system", """당신은 피부 관리 전문 어드바이저 챗봇입니다.
피부과학 지식을 바탕으로 친절하고 이해하기 쉽게 피부 고민을 상담해주며,
사용자의 피부 상태에 맞는 관리 방법을 안내합니다.
이전 대화를 기억하고 맥락에 맞게 답변해주세요.

[사용자 피부 정보]
- 피부 타입: {skin_type}
- 여드름 점수: {acne_score}점 (80+ 매우좋음 / 60~79 양호 / 40~59 관리필요 / 40 미만 집중관리)
- 모공 점수: {pore_score}점 (80+ 매우좋음 / 60~79 양호 / 40~59 관리필요 / 40 미만 집중관리)
- 최근 분석 일자: {last_analysis_date}

[루틴 정보]
- 루틴 달성률: {compliance_rate}%

[보유 화장품]
{user_cosmetics}

[답변 판단 기준]
- 달성률 50% 미만 + 점수 낮음 → 루틴 실천을 먼저 권유하세요.
- 달성률 70% 이상 + 점수 낮음 → 보유 화장품의 사용 순서나 조합 개선을 제안하세요.
- 달성률 70% 이상 + 점수 좋음 → 현재 관리를 칭찬하고 유지 팁을 알려주세요.
- 분석한 지 7일 이상 지났다면 → 답변 끝에 재분석을 가볍게 권유하세요.

[규칙]
1. 피부 고민, 관리 방법, 성분 등 피부 관련 질문에만 답변하세요.
2. 피부와 관련 없는 질문에는 "피부 관련 질문만 답변할 수 있어요!"라고 답하세요.
3. 3~4문장 이내로 핵심 위주로 답변하되, 필요하면 이유를 한 줄 덧붙이세요.
4. 화장품 추천 요청이 오면 "맞춤 화장품은 추천 탭에서 피부 분석 기반으로 추천해드리고 있어요!"라고 안내하세요.
   단, 보유 화장품의 성분이나 사용 순서에 대한 질문에는 답변하세요.
5. 약 처방, 시술, 심한 피부 질환 등 의료적 판단이 필요한 질문에는 피부과 방문을 안내하세요.
6. 전문적이지만 친근한 톤으로 답변해주세요.
"""),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}"),
])


# ========== 체인 구성 ==========
# 프롬프트 → LLM 파이프라인에 대화 히스토리 자동 관리 래핑
_chat_chain = _chat_prompt | llm

_chat_with_history = RunnableWithMessageHistory(
    _chat_chain,
    _get_session_history,
    input_messages_key="input",
    history_messages_key="history",
)


# ========== 챗봇 응답 생성 ==========

def get_chat_response(req):
    """
    챗봇 응답 생성
    - req: 사용자 요청 객체 (message, user_no, 피부 정보 등 포함)
    - 사용자 컨텍스트를 프롬프트 변수에 주입하고, 세션 히스토리 기반으로 응답 생성
    - 에러 발생 시 글로벌 에러 핸들러로 전달 (main.py)
    """
    config = {"configurable": {"session_id": str(req.user_no)}}

    response = _chat_with_history.invoke(
        {
            "input": req.message,
            "skin_type": req.skin_type or "정보 없음",
            "acne_score": req.acne_score,
            "pore_score": req.pore_score,
            "compliance_rate": req.compliance_rate,
            "user_cosmetics": req.user_cosmetics or "없음",
            "last_analysis_date": req.last_analysis_date or "분석 기록 없음",
        },
        config=config
    )

    return {
        "status": "success",
        "data": {
            "answer": response.content,
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
    }