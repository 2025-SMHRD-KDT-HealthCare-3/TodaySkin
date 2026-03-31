# 3.Ai_FastAPI/main.py

# 현재 node의 skinRouter와 fastAPI의 skin_analyze 연결만 되어있는 상태

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from services.skin_analyze import analyze_skin_from_path
from utils.security import verify_internal_key

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 개발용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SkinAnalyzeRequest(BaseModel):
    upload_no: int
    file_path: str


@app.get("/")
def root():
    return {
        "status": "success",
        "message": "FastAPI server is running"
    }


@app.post("/internal/skin/analyze", dependencies=[Depends(verify_internal_key)])
def internal_skin_analyze(body: SkinAnalyzeRequest):
    try:
        result = analyze_skin_from_path(body.file_path)

        return {
            "status": "success",
            "data": result
        }

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": str(e)
            }
        )