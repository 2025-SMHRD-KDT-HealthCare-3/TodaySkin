"""
* 공통 에러 핸들러

모든 엔드포인트에서 발생하는 예외를 한 곳에서 처리합니다.
- 콘솔에 간결한 에러 로그 출력
- 클라이언트에 통일된 에러 응답 반환

HTTP 상태 코드:
- 200  OK              요청 성공
- 400  Bad Request     잘못된 요청 (필수값 누락 등)
- 500  Internal Error  서버 내부 오류
"""

from fastapi import Request
from fastapi.responses import JSONResponse


"""입력값 검증 실패 등 클라이언트 에러"""
class ValidationError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


"""ValidationError 처리 — 400 계열"""
async def validation_error_handler(request: Request, exc: ValidationError):
    print(f"[VALIDATION ERROR] {request.url.path} → {exc.message}")
    return JSONResponse(
        status_code=exc.status_code,
        content={"status": "error", "message": exc.message}
    )


"""예상하지 못한 에러 처리 — 500"""
async def global_error_handler(request: Request, exc: Exception):
    print(f"[SERVER ERROR] {request.url.path} → {exc}")
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": "서버 내부 오류가 발생했습니다."}
    )