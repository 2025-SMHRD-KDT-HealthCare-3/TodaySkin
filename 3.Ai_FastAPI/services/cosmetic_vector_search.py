# ──────────────────────────────────────────────
# * 화장품 벡터 검색 모듈 (cosmetic_vector_search.py)
# - API에서 전체 화장품 목록을 가져와 Chroma 벡터 DB에 임베딩
# - 피부 타입 + 점수 기반으로 유사도 검색하여 후보 화장품 반환
# - cosmetics_recommend.py, routine_generate.py에서 호출하여 사용
# ──────────────────────────────────────────────

import os
import requests
from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document

# ─────────────────────────────────────────
# 환경 변수 로드
# ─────────────────────────────────────────
load_dotenv()
OPENAI_API_KEY    = os.getenv("OPENAI_API_KEY")
COSMETIC_API_URL  = os.getenv("COSMETIC_API_URL", "http://localhost:8000/api/cosmetics")
USER_COSMETIC_API = os.getenv("USER_COSMETIC_API_URL", "http://localhost:8000/api/users/{user_no}/cosmetics")

# Chroma DB 저장 경로
PERSIST_DIR = os.path.join(os.path.dirname(__file__), "chroma_cosm_db")

# ─────────────────────────────────────────
# 임베딩 모델
# ─────────────────────────────────────────
embeddings = OpenAIEmbeddings(
    model="text-embedding-3-small",
    openai_api_key=OPENAI_API_KEY
)

# 전역 벡터 DB (서버 시작 시 1회만 로드)
_vector_store = None


# ─────────────────────────────────────────
# 1. 전체 화장품 목록 API 호출
# ─────────────────────────────────────────
def _fetch_all_cosmetics() -> list[dict]:
    """
    전체 화장품 DB를 API에서 가져옵니다.
    반환 예시:
    [
        {
            "cos_no": 1,
            "cos_name": "수분 토너",
            "cos_brand": "이니스프리",
            "cos_type": "토너",
            "cos_ingredient": "히알루론산, 나이아신아마이드 ..."
        },
        ...
    ]
    """
    try:
        res = requests.get(COSMETIC_API_URL, timeout=10)
        res.raise_for_status()
        data = res.json()
        print(f"✅ [API] 전체 화장품 {len(data)}개 로드 완료")
        return data
    except Exception as e:
        print(f"❌ [API] 전체 화장품 로드 실패: {e}")
        return []


# ─────────────────────────────────────────
# 2. 유저 보유 화장품 API 호출
# ─────────────────────────────────────────
def fetch_user_cosmetics(user_no: int) -> list[dict]:
    print(f"🔍 [API] 유저 보유 화장품 조회 - user_no: {user_no}") 
    """
    특정 유저의 보유 화장품을 API에서 가져옵니다.
    user_cosmetics 테이블의 cos_no로 화장품 상세 정보를 조인하여 반환한다고 가정합니다.

    반환 예시:
    [
        {
            "ucos_no": 10,
            "cos_no": 1,
            "cos_name": "수분 토너",
            "cos_brand": "이니스프리",
            "cos_type": "토너",
            "cos_ingredient": "히알루론산 ...",
            "source": "scan",
            "expired_at": "2025-12-31"
        },
        ...
    ]
    """
    try:
        url = USER_COSMETIC_API.replace("{user_no}", str(user_no))
        print(f"🔍 [API] 요청 URL: {url}")  # ✅ 추가
        res = requests.get(url, timeout=10)
        res.raise_for_status()
        data = res.json()
        print(f"✅ [API] 유저({user_no}) 보유 화장품 {len(data)}개 로드 완료")
        return data
    except Exception as e:
        print(f"❌ [API] 유저 보유 화장품 로드 실패: {e}")
        return []


# ─────────────────────────────────────────
# 3. 화장품 dict → LangChain Document 변환
# ─────────────────────────────────────────
def _to_document(cosmetic: dict) -> Document:
    """
    화장품 1개를 임베딩용 Document로 변환합니다.
    - page_content : 벡터 유사도 검색에 사용되는 텍스트
    - metadata     : 검색 결과 식별용 (cos_no, cos_name 등)
    """
    page_content = (
        f"제품명: {cosmetic.get('cos_name', '')}\n"
        f"브랜드: {cosmetic.get('cos_brand', '')}\n"
        f"카테고리: {cosmetic.get('cos_type', '')}\n"
        f"성분 및 효능: {cosmetic.get('cos_ingredient', '')}"
    )
    metadata = {
        "cos_no":         cosmetic.get("cos_no"),
        "cos_name":       cosmetic.get("cos_name", ""),
        "cos_brand":      cosmetic.get("cos_brand", ""),
        "cos_type":       cosmetic.get("cos_type", ""),
        "cos_ingredient": cosmetic.get("cos_ingredient", ""),
    }
    return Document(page_content=page_content, metadata=metadata)


# ─────────────────────────────────────────
# 4. 벡터 DB 초기화 (서버 시작 시 1회 실행)
# ─────────────────────────────────────────
def init_cosmetic_vector_db(force_rebuild: bool = False):
    """
    전체 화장품 목록을 임베딩하여 Chroma 벡터 DB를 구성합니다.

    - 이미 로컬에 저장된 DB가 있으면 재사용 (API 비용 절약)
    - force_rebuild=True 로 호출하면 DB를 삭제하고 새로 구성
      → 화장품 데이터가 업데이트될 때 사용

    호출 위치 예시 (main.py):
        from cosmetic_vector_search import init_cosmetic_vector_db

        @app.on_event("startup")
        async def startup():
            init_cosmetic_vector_db()
    """
    global _vector_store

    # force_rebuild 시 기존 DB 삭제
    if force_rebuild and os.path.exists(PERSIST_DIR):
        import shutil
        shutil.rmtree(PERSIST_DIR)
        print("🗑️  [Vector DB] 기존 화장품 벡터 DB 삭제 완료")

    # 이미 메모리에 로드된 경우 스킵
    if _vector_store is not None:
        return

    # 로컬에 저장된 DB가 있으면 불러오기
    if os.path.exists(PERSIST_DIR) and os.listdir(PERSIST_DIR):
        print("📦 [Vector DB] 기존 화장품 벡터 DB 불러오는 중...")
        _vector_store = Chroma(
            persist_directory=PERSIST_DIR,
            embedding_function=embeddings
        )
        print("✅ [Vector DB] 화장품 벡터 DB 로드 완료!")
        return

    # 없으면 API에서 데이터 가져와서 새로 생성
    print("🔨 [Vector DB] 화장품 벡터 DB 새로 생성 중...")
    cosmetics = _fetch_all_cosmetics()

    if not cosmetics:
        print("⚠️  [Vector DB] 화장품 데이터가 없어 벡터 DB를 생성하지 않습니다.")
        return

    documents = [_to_document(c) for c in cosmetics]

    _vector_store = Chroma.from_documents(
        documents=documents,
        embedding=embeddings,
        persist_directory=PERSIST_DIR
    )
    print(f"✅ [Vector DB] 화장품 {len(documents)}개 임베딩 및 저장 완료!")


# ─────────────────────────────────────────
# 5. 피부 정보 기반 후보 화장품 검색
# ─────────────────────────────────────────
def search_cosmetic_candidates(
    skin_type: str,
    acne_score: int,
    pore_score: int,
    user_cosmetics: list[dict],
    top_k: int = 50  
) -> list[dict]:
    """
    피부 타입과 점수를 기반으로 벡터 DB에서 후보 화장품을 검색합니다.

    - 유저 보유 화장품(user_cosmetics)의 cos_no는 검색 결과에서 제외합니다.
      (보유 화장품은 routine_generate / recommend 단에서 별도로 처리)
    - 반환값은 cosmetics_recommend.py의 req.cosmetic_candidates 형식과 동일합니다.

    Args:
        skin_type      : 피부 타입 (예: "지성", "건성", "복합성")
        acne_score     : 여드름 점수 (0~100)
        pore_score     : 모공 점수 (0~100)
        user_cosmetics : 유저 보유 화장품 목록 (cos_no 포함)
        top_k          : 검색할 최대 결과 수 (기본 10개)

    Returns:
        [
            {
                "cos_no": 1,
                "cos_name": "...",
                "cos_brand": "...",
                "cos_type": "...",
                "cos_ingredient": "..."
            },
            ...
        ]
    """
    if _vector_store is None:
        print("⚠️  [Vector DB] 벡터 DB가 초기화되지 않았습니다. init_cosmetic_vector_db()를 먼저 호출하세요.")
        return []

    # 피부 점수 → 텍스트 변환 (검색 쿼리 품질 향상)
    def _score_label(score: int) -> str:
        if score >= 80:
            return "매우 좋음, 현재 상태 유지 성분"
        elif score >= 60:
            return "양호, 보습 및 진정 성분 권장"
        elif score >= 40:
            return "관리 필요, 전용 케어 성분 필요"
        else:
            return "집중 관리 필요, 특화 트러블 케어 성분 필수"

    query = (
        f"{skin_type} 피부용 { _score_label(acne_score) } { _score_label(pore_score) } "
        f"클렌징 토너 세럼 수분크림 자외선차단제 추천 제품" 
    )

    try:
        results = _vector_store.similarity_search(query, k=top_k)
    except Exception as e:
        print(f"❌ [Vector DB] 유사도 검색 실패: {e}")
        return []

    # 유저 보유 화장품 cos_no 목록 (검색 결과에서 제외)
    owned_cos_nos = {
        c.get("cos_no") for c in user_cosmetics if c.get("cos_no") is not None
    }

    candidates = []
    seen_cos_nos = set()

    for doc in results:
        meta = doc.metadata
        cos_no = meta.get("cos_no")

        # 중복 제거 및 보유 화장품 제외
        if cos_no in seen_cos_nos or cos_no in owned_cos_nos:
            continue

        seen_cos_nos.add(cos_no)
        candidates.append({
            "cos_no":         cos_no,
            "cos_name":       meta.get("cos_name", ""),
            "cos_brand":      meta.get("cos_brand", ""),
            "cos_type":       meta.get("cos_type", ""),
            "cos_ingredient": meta.get("cos_ingredient", ""),
        })

    print(f"🔍 [Vector DB] 후보 화장품 {len(candidates)}개 검색 완료")
    return candidates


# ─────────────────────────────────────────
# 6. 직접 실행 시 벡터 DB 강제 생성
# ─────────────────────────────────────────
if __name__ == "__main__":
    # python cosmetic_vector_search.py 로 직접 실행하면
    # 서버 없이도 벡터 DB를 미리 만들 수 있습니다.
    init_cosmetic_vector_db(force_rebuild=True)
