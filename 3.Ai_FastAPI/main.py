"""
main.py — FastAPI 서버 엔트리포인트

엔드포인트:
- GET  /                        서버 상태 확인
- POST /api/skin/analyze        피부 이미지 분석
- POST /api/routine/generate    루틴 생성
- POST /api/chatbot/message     챗봇 메시지
- POST /api/cosmetics/recommend 화장품 추천
- POST /api/daily/comment       데일리 리포트 코멘트
"""

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from utils.security import verify_internal_key

from services.skin_analyze import analyze_skin_from_path
from services.routine_generate import generate_routine
from services.chatbot_message import get_chat_response
from services.cosmetics_recommend import recommend_cosmetics
from services.report_comment import generate_daily_comment
from middleware.error_handler import (
    ValidationError,
    validation_error_handler,
    global_error_handler,
)


app = FastAPI()

# ========== CORS 설정 ==========
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== 에러 핸들러 등록 ==========
app.add_exception_handler(ValidationError, validation_error_handler)
app.add_exception_handler(Exception, global_error_handler)


# ==================================
# ========== Request 모델 ==========
# ==================================


# ========== 이미지 분석 ==========

class SkinAnalyzeRequest(BaseModel):
    upload_no: int
    file_path: str


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


# ========== 화장품 추천 ==========

class CosmeticRequest(BaseModel):
    age: int = 0
    gender: str = ""
    skin_type: str = ""
    acne_score: int = 0
    pore_score: int = 0
    cosmetic_candidates: list = []
    owned_categories: list = []


# ====== 데일리 리포트 한줄 코멘트 =======

class DailyCommentRequest(BaseModel):
    skin_type: str = ""
    total_score: float = 0.0
    prev_total_score: float = 0.0



# ========== 엔드포인트 ==========

@app.get("/")
def root():
    return {"message": "FastAPI 서버 실행 중!"}

@app.post("/api/skin/analyze", dependencies=[Depends(verify_internal_key)])
def skin_analyze(req: SkinAnalyzeRequest):
    result = analyze_skin_from_path(req.file_path)
    return {"status": "success", "data": result}

@app.post("/api/routine/generate", dependencies=[Depends(verify_internal_key)])
def create_routine(req: RoutineRequest):
    return generate_routine(req)

@app.post("/api/chatbot/message", dependencies=[Depends(verify_internal_key)])
def chat(req: ChatRequest):
    return get_chat_response(req)

@app.post("/api/cosmetics/recommend", dependencies=[Depends(verify_internal_key)])
def recommend(req: CosmeticRequest):
    return recommend_cosmetics(req)

@app.post("/api/report/comment", dependencies=[Depends(verify_internal_key)])
def daily_comment(req: DailyCommentRequest):
    return generate_daily_comment(req)