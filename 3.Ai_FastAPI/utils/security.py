# 3.Ai_FastAPI/utils/security.py
# 이 파일은 Node에서 보낸 내부 키를 검사. => React나 외부에서 FastAPI 직접 호출 못 하게 막기 위해서

import os
import secrets
from fastapi import Header, HTTPException
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BASE_DIR, ".env")
load_dotenv(ENV_PATH)

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "").strip()

if not INTERNAL_API_KEY:
    raise RuntimeError("INTERNAL_API_KEY가 .env에 설정되지 않았습니다.")


def verify_internal_key(
    x_internal_key: str | None = Header(default=None, alias="x-internal-key")
) -> None:
    """
    Node 서버에서 전달한 내부 API 키를 검증합니다.
    - 키 미포함 및 불일치 모두 동일한 403 반환
    - secrets.compare_digest()로 타이밍 어택 방지
    """
    if x_internal_key is None or not secrets.compare_digest(
        x_internal_key.strip(),
        INTERNAL_API_KEY
    ):
        raise HTTPException(status_code=403, detail="Forbidden")