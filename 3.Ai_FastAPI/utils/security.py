# 이 파일은 Node에서 보낸 내부 키를 검사. => React나 외부에서 FastAPI 직접 호출 못 하게 막기 위해서

import os
from fastapi import Header, HTTPException
from dotenv import load_dotenv

load_dotenv()

INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY", "")

def verify_internal_key(x_internal_key: str = Header(None)):
    if x_internal_key != INTERNAL_API_KEY:
        raise HTTPException(status_code=403, detail="Forbidden: invalid internal key")