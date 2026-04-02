# ──────────────────────────────────────────────
# * 내부 API 키 검증 (security.py)
# - Node에서 보낸 내부 키를 검사
# - React나 외부에서 FastAPI 직접 호출 방지
# ──────────────────────────────────────────────


import os
import secrets

from fastapi import Header, HTTPException


INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "").strip()

if not INTERNAL_API_KEY:
    raise RuntimeError("INTERNAL_API_KEY가 .env에 설정되지 않았습니다.")


def verify_internal_key(
    x_internal_key: str | None = Header(default=None, alias="x-internal-key")
) -> None:
    """
    Node 서버에서 전달한 내부 API 키를 검증
    - 키 미포함 및 불일치 모두 403 반환
    - secrets.compare_digest()로 타이밍 어택 방지
    """
    if x_internal_key is None or not secrets.compare_digest(
        x_internal_key.strip(),
        INTERNAL_API_KEY
    ):
        raise HTTPException(status_code=403, detail="Forbidden")