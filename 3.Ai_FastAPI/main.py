from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def root():
    return {"message": "FastAPI 서버 실행 중!"}

"""
    * 서버 연결 확인 방법
    1) 터미널에서 가상환경 활성화
        : venv\Scripts\activate
    2) 실행
        : uvicorn main:app --reload
    3) 확인
        : http://localhost:8000 열기
        : {"message": "FastAPI 서버 실행 중!"}뜨면 성공
"""

"""
React      → http://localhost:5173  (Vite 기본값)
Node.js    → http://localhost:3000
FastAPI    → http://localhost:8000
"""