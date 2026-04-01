from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_core.runnables.history import RunnableWithMessageHistory
from datetime import datetime

load_dotenv()

llm = ChatOpenAI(model="gpt-5.4-mini", max_tokens=1500)  # ✅ 중복 제거
store = {}

def get_session_history(session_id: str):
    if session_id not in store:
        store[session_id] = InMemoryChatMessageHistory()
    return store[session_id]

chat_prompt = ChatPromptTemplate.from_messages([
    ("system", """당신은 15년 경력의 피부과 전문의 출신 피부 관리 전문 챗봇입니다.
의학적 지식을 바탕으로 친절하고 이해하기 쉽게 피부 고민을 상담해주며,
사용자의 피부 상태에 맞는 정확한 정보를 제공하는 전문가입니다.
이전 대화를 기억하고 맥락에 맞게 답변해주세요.

현재 사용자의 피부 정보:
- 피부 타입: {skin_type}
- 여드름 점수: {acne_score}점 (0~100, 높을수록 좋음)
- 모공 점수: {pore_score}점 (0~100, 높을수록 좋음)

현재 사용자의 챌린지 정보:
- 챌린지 상태: {chal_status}
- 루틴 달성률: {compliance_rate}%

현재 사용자의 보유 화장품:
{user_cosmetics}

아래 규칙을 반드시 지켜주세요.
1. 피부 고민, 피부 관리 방법, 성분 등 피부 관련 질문에만 답변하세요.
2. 사용자의 피부 점수, 챌린지 상태, 보유 화장품을 참고해서 맞춤 답변을 해주세요.
3. 반드시 1~2줄 이내로 핵심만 간결하게 답변하세요.
4. 화장품 추천은 하지 마세요. 추천 요청이 오면 "화장품 추천은 추천 탭을 이용해주세요" 라고 안내하세요.
5. 피부와 관련 없는 질문은 "피부 관련 질문만 답변할 수 있어요!" 라고 답하세요.
6. 전문적이지만 친근한 톤으로 답변해주세요.
"""),
    MessagesPlaceholder(variable_name="history"),
    ("human", "{input}"),
])

chat_chain = chat_prompt | llm

chat_with_history = RunnableWithMessageHistory(
    chat_chain,
    get_session_history,
    input_messages_key="input",
    history_messages_key="history",
)

def get_chat_response(req):
    try:
        config = {"configurable": {"session_id": str(req.user_no)}}
        response = chat_with_history.invoke(
            {
                "input": req.message,
                "skin_type": req.skin_type if req.skin_type else "정보 없음",
                "acne_score": req.acne_score,
                "pore_score": req.pore_score,
                "chal_status": req.chal_status if req.chal_status else "정보 없음",    # ✅ 추가
                "compliance_rate": req.compliance_rate,                                 # ✅ 추가
                "user_cosmetics": req.user_cosmetics if req.user_cosmetics else "없음"  # ✅ 추가
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
    except Exception as e:
        return {
            "status": "error",
            "data": {"message": "챗봇 응답 중 오류가 발생했습니다."}
        }