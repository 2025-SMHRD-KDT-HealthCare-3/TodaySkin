# ──────────────────────────────────────────────
# 벡터 검색 연결 가이드
# ──────────────────────────────────────────────
# 아래 내용을 기존 파일에 각각 추가/수정하세요.
# ──────────────────────────────────────────────


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [1] main.py — 서버 시작 시 벡터 DB 초기화
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 기존 main.py에 아래 코드를 추가하세요.

from cosmetic_vector_search import init_cosmetic_vector_db

@app.on_event("startup")
async def startup():
    init_cosmetic_vector_db()   # 서버 켤 때 1번만 실행됨
    # 화장품 데이터가 바뀌면 아래처럼 강제 재생성:
    # init_cosmetic_vector_db(force_rebuild=True)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [2] cosmetics_recommend.py — 추천 서비스에 연결
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 기존 recommend_cosmetics() 함수 상단에 아래를 추가하세요.

from cosmetic_vector_search import search_cosmetic_candidates, fetch_user_cosmetics

def recommend_cosmetics(req):
    # ✅ 추가: 유저 보유 화장품 가져오기
    user_cosmetics = fetch_user_cosmetics(req.user_no)

    # ✅ 추가: 벡터 검색으로 후보 화장품 자동 조회
    #    기존에 req.cosmetic_candidates 를 외부에서 넣어줬다면,
    #    이제 아래 한 줄로 자동 조회됩니다.
    cosmetic_candidates = search_cosmetic_candidates(
        skin_type=req.skin_type,
        acne_score=req.acne_score,
        pore_score=req.pore_score,
        user_cosmetics=user_cosmetics,
        top_k=10
    )

    # 이하 기존 로직 그대로 사용
    candidate_types = set(c["cos_type"] for c in cosmetic_candidates)
    owned = set(c["cos_type"] for c in user_cosmetics)   # ✅ user_cosmetics에서 직접 추출
    missing_types = candidate_types - owned

    # ... 기존 LLM 호출 코드 동일 ...


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# [3] routine_generate.py — 루틴 생성에 연결
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 기존 generate_routine() 함수 상단에 아래를 추가하세요.

from cosmetic_vector_search import search_cosmetic_candidates, fetch_user_cosmetics

def generate_routine(req):
    # ✅ 추가: 유저 보유 화장품 가져오기
    user_cosmetics = fetch_user_cosmetics(req.user_no)

    # ✅ 추가: 벡터 검색으로 후보 화장품 자동 조회
    cosmetic_candidates = search_cosmetic_candidates(
        skin_type=req.skin_type,
        acne_score=req.acne_score,
        pore_score=req.pore_score,
        user_cosmetics=user_cosmetics,
        top_k=10
    )

    # LLM에 넘길 텍스트 포맷 변환
    def _format(cosmetics):
        if not cosmetics:
            return "없음"
        return "\n".join(
            f"- {c['cos_name']} / {c['cos_brand']} / {c['cos_type']} / {c['cos_ingredient']}"
            for c in cosmetics
        )

    week2_prompt = _build_week2_prompt(req)

    result = _chain.invoke({
        "age": req.age or "정보 없음",
        "gender": "남성" if req.gender == "M" else "여성" if req.gender == "F" else "정보 없음",
        "skin_type": req.skin_type or "정보 없음",
        "acne_score": req.acne_score,
        "pore_score": req.pore_score,
        "chal_type": req.chal_type,
        "week": req.week,
        "user_cosmetics": _format(user_cosmetics),        # ✅ 벡터 검색 결과 사용
        "cosmetic_candidates": _format(cosmetic_candidates),  # ✅ 벡터 검색 결과 사용
        "week2_prompt": week2_prompt,
    })

    # ... 이하 기존 JSON 파싱 코드 동일 ...
