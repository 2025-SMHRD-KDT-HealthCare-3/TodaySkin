from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from services.routine_generate import generate_routine
from services.chatbot_message import get_chat_response
from services.cosmetics_recommend import recommend_cosmetics
from services.report_comment import generate_daily_comment
from services.skin_analyze import analyze_skin_from_path
load_dotenv()

app = FastAPI()

# ========== CORS 설정 ==========
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SkinAnalyzeRequest(BaseModel):
    upload_no: int
    file_path: str

@app.get("/")
def root():
    return {"message": "FastAPI 서버 실행 중!"}

# ========== 루틴 생성 ==========
class RoutineRequest(BaseModel):
    skin_type: str = ""
    acne_score: int = 0
    pore_score: int = 0
    chal_type: int = 7
    week: int = 1
    user_cosmetics: str = ""
    cosmetic_candidates: str = ""
    age: int = 0
    gender: str = ""
    total_score_change: float = 0.0
    compliance_rate: int = 0

@app.post("/api/routine/generate")
def create_routine(req: RoutineRequest):
    return generate_routine(req)

# ========== 이미지 분석 ==========
@app.post("/analyze")
def skin_analyze(req: SkinAnalyzeRequest):
    # Node.js에서 보낸 file_path 하나만 인자로 전달합니다.
    # (보내주신 skin_analyze.py의 analyze_skin_from_path 함수 정의에 맞춤)
    result = analyze_skin_from_path(req.file_path)
    
    # Node.js가 기대하는 { status: "success", data: ... } 형태로 감싸서 반환합니다.
    return {
        "status": "success",
        "data": result
    }

# ========== 챗봇 ==========
class ChatRequest(BaseModel):
    message: str
    user_no: int
    skin_type: str = ""
    acne_score: int = 0
    pore_score: int = 0
    chal_status: str = ""
    compliance_rate: int = 0
    user_cosmetics: str = ""
    last_analysis_date: str = ""  

@app.post("/api/chatbot/message")
def chat(req: ChatRequest):
    return get_chat_response(req)

# ========== 화장품 추천 ==========
class CosmeticRequest(BaseModel):
    skin_type: str = ""
    acne_score: int = 0
    pore_score: int = 0
    cosmetic_candidates: list = []
    owned_categories: list = [] 

@app.post("/api/cosmetics/recommend")
def recommend(req: CosmeticRequest):
    return recommend_cosmetics(req)

# ========== 데일리 리포트 한줄 코멘트 ==========
class DailyCommentRequest(BaseModel):
    skin_type: str = ""
    total_score: float = 0.0
    prev_total_score: float = 0.0


@app.post("/api/daily/comment")
def daily_comment(req: DailyCommentRequest):
    return generate_daily_comment(req)