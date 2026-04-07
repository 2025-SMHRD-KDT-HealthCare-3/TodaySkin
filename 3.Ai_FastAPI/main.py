"""
main.py — FastAPI 서버 엔트리포인트

역할:
- 외부(Node)에서 들어오는 FastAPI 요청을 받는 진입점
- 피부 분석 / 루틴 생성 / 챗봇 / 화장품 추천 / 리포트 코멘트 엔드포인트 연결
- 내부 API 키 검증(Depends)
- 전역 에러 핸들러 등록
"""

# .env 파일 로드
# - INTERNAL_API_KEY 같은 환경변수를 읽기 위해 가장 먼저 실행
from dotenv import load_dotenv
load_dotenv()

# FastAPI 기본 구성 요소
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# 내부 API 키 검증 함수
from utils.security import verify_internal_key

# 서비스 레이어 함수들
# - 실제 비즈니스 로직은 각 services 폴더 안 함수가 담당
from services.skin_analyze import analyze_skin_from_path
from services.routine_generate import generate_routine
from services.chatbot_message import get_chat_response
from services.cosmetics_recommend import recommend_cosmetics
from services.report_comment import generate_daily_comment

# 벡터 DB 초기화 함수
from services.cosmetic_vector_search import init_cosmetic_vector_db

# 전역 에러 핸들러
from middleware.error_handler import (
    ValidationError,
    validation_error_handler,
    global_error_handler,
)

# FastAPI 앱 생성
app = FastAPI()


# 벡터 검색 연결 가이드
@app.on_event("startup")
async def startup():
    init_cosmetic_vector_db()

# ==================================
# CORS 설정
# ==================================
# 개발 단계에서는 모든 Origin 허용
# 추후 배포 시에는 프론트 도메인만 허용하도록 좁히는 것이 안전
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================================
# 전역 에러 핸들러 등록
# ==================================
# ValidationError -> 커스텀 검증 오류 처리
# Exception -> 기타 예외를 공통 처리
app.add_exception_handler(ValidationError, validation_error_handler)
app.add_exception_handler(Exception, global_error_handler)


# ==================================
# Request 모델 정의
# ==================================
# FastAPI는 요청 body를 Pydantic 모델로 자동 검증한다.

# ---------- 피부 분석 요청 ----------
class SkinAnalyzeRequest(BaseModel):
    # Node DB의 upload_no
    upload_no: int
    # Node가 업로드한 이미지의 절대경로
    file_path: str


# ---------- 루틴 생성 요청 ----------
class RoutineRequest(BaseModel):
    skin_type: str = ""
    acne_score: int = 0
    pore_score: int = 0
    chal_type: int = 7
    week: int = 1
    user_no: int = 0
    compliance_rate: int = 0
    age: int = 0
    gender: str = ""
    total_score_change: float = 0.0
    compliance_rate: int = 0


# ---------- 챗봇 요청 ----------
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


# ---------- 화장품 추천 요청 ----------
class CosmeticRequest(BaseModel):
    age: int = 0
    gender: str = ""
    skin_type: str = ""
    acne_score: int = 0
    pore_score: int = 0
    user_no: int = 0


# ---------- 데일리 리포트 코멘트 요청 ----------
class DailyCommentRequest(BaseModel):
    skin_type: str = ""
    total_score: float = 0.0
    prev_total_score: float = 0.0


# ==================================
# 엔드포인트 정의
# ==================================

@app.get("/")
def root():
    """
    서버 상태 확인용 엔드포인트
    브라우저나 Postman에서 GET / 호출 시 서버 동작 여부 확인 가능
    """
    return {
        "status": "success",
        "message": "FastAPI 서버 실행 중!"
    }


@app.post("/api/skin/analyze", dependencies=[Depends(verify_internal_key)])
def skin_analyze(req: SkinAnalyzeRequest):
    """
    피부 분석 엔드포인트

    흐름:
    1. Node가 upload_no, file_path 전달
    2. analyze_skin_from_path()가 실제 분석 수행
    3. 응답에 upload_no를 다시 포함해서 Node가 추적 가능하게 반환
    """
    result = analyze_skin_from_path(req.file_path)

    return {
        "status": "success",
        "data": {
            "upload_no": req.upload_no,
            **result
        }
    }


@app.post("/api/routine/generate", dependencies=[Depends(verify_internal_key)])
def create_routine(req: RoutineRequest):
    """
    사용자 피부 상태/챌린지 정보 기반 루틴 생성
    """
    return generate_routine(req)


@app.post("/api/chatbot/message", dependencies=[Depends(verify_internal_key)])
def chat(req: ChatRequest):
    """
    챗봇 메시지 생성
    """
    return get_chat_response(req)


@app.post("/api/cosmetics/recommend", dependencies=[Depends(verify_internal_key)])
def recommend(req: CosmeticRequest):
    """
    사용자 정보 + 후보 화장품 기반 추천
    """
    return recommend_cosmetics(req)


@app.post("/api/report/comment", dependencies=[Depends(verify_internal_key)])
def daily_comment(req: DailyCommentRequest):
    """
    데일리 리포트 한줄 코멘트 생성
    Node가 분석 직후 호출해서 daily_reports 저장에 사용
    """
    return generate_daily_comment(req)