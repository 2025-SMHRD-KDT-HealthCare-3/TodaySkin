**SMHRD 핵심역량 프로젝트 (2026.03.23 ~ 2026.04.13)**
# 🧴 오늘의 피부 (TodaySkin)

> AI 기반 피부 분석 & 맞춤 루틴 관리 서비스

피부 사진을 촬영하면 AI가 피부 상태를 분석하고, 맞춤 스킨케어 루틴을 제안합니다.  
7일/14일 챌린지를 통해 꾸준한 피부 관리 습관을 만들어갑니다.

---

## 📌 주요 기능

- **AI 피부 분석** — YOLO 기반 컴퓨터 비전으로 여드름/모공 탐지 및 점수화
- **맞춤 루틴 추천** — 피부 타입과 분석 결과를 기반으로 아침/저녁/스페셜 루틴 자동 생성
- **챌린지 시스템** — 7일/14일 단위 챌린지로 루틴 실천 동기부여
- **피부 변화 리포트** — 챌린지 기간 동안의 점수 변화 추이 및 사진 비교
- **화장품 관리** — 보유 화장품 등록 및 유통기한 관리
- **AI 챗봇** — 스킨케어 관련 질문에 실시간 AI 상담
- **화장품 추천** — 부족한 루틴 카테고리에 맞는 화장품 추천

---

## 🛠 기술 스택

| 구분 | 기술 |
|------|------|
| **Frontend** | React, React Router |
| **Backend** | Node.js, Express |
| **AI Server** | Python, FastAPI, LangChain, OpenAI API |
| **Computer Vision** | YOLOv26, YOLOv11 |
| **Database** | MySQL |
| **기타** | Multer (파일 업로드), Axios, JWT (httpOnly Cookie) |

---

## 🏗 시스템 아키텍처

```
┌──────────────┐     /api/*      ┌──────────────┐     Internal API    ┌──────────────┐
│   Frontend   │ ──────────────► │   Backend    │ ──────────────────► │  AI Server   │
│  React/Vite  │ ◄────────────── │  Node/Express│ ◄────────────────── │   FastAPI    │
└──────────────┘                 └──────┬───────┘                     └──────┬───────┘
                                        │                                    │
                                        ▼                                    ▼
                                 ┌──────────────┐                   ┌──────────────┐
                                 │    MySQL     │                   │ YOLO Models  │
                                 │   Database   │                   │ + OpenAI API │
                                 └──────────────┘                   └──────────────┘
```

**요청 흐름**
1. 프론트엔드 → Vite 프록시(`/api`) → Node.js 백엔드
2. AI 기능 요청 시 → 백엔드 → FastAPI AI 서버 (내부 API 키 인증)
3. 피부 분석: 이미지 업로드 → YOLO 모델 추론 → 점수 산출 → DB 저장

---

## 📁 프로젝트 구조

```
0.TodaySkin/
├── 1.Frontend_React/    # React 프론트엔드
│   ├── src/
│   │   ├── pages/       # 페이지 컴포넌트
│   │   ├── components/  # 공용 컴포넌트
│   │   └── styles/      # 디자인 토큰 (design.js)
│   └── vite.config.js
│
├── 2.Backend_node/      # Node.js 백엔드
│   ├── routes/          # API 라우터
│   ├── middleware/      # 인증, 에러 핸들링
│   └── config/          # DB, API 설정
│
└── 3.Ai_FastAPI/        # FastAPI AI 서버
    ├── middleware/      # 에러 핸들링
    ├── model/           # YOLO 모델 파일
    ├── services/        # AI 서비스 로직 (분석, 루틴, 챗봇, 추천)
    ├── chroma_cosm_db/  # 화장품 추천용 벡터 DB (ChromaDB)
    ├── utils/           # 이미지 전처리, 점수 산출, 내부 API 키 검증
    └── main.py
```

---

## 🚀 실행 방법

### 1. 데이터베이스 설정

### 2. 환경 변수 설정

**Backend** (`2.Backend_node/.env`)
```env
DB_HOST=localhost
DB_PORT=db_port_no.
DB_USER=db_name
DB_PASSWORD=your_password
DB_NAME=db_name
PORT=your_port_no.
JWT_SECRET=your_jwt_secret
INTERNAL_API_KEY=your_internal_key
```

**AI Server** (`3.Ai_FastAPI/.env`)
```env
OPENAI_API_KEY=your_openai_key
INTERNAL_API_KEY=your_internal_key
MODEL_PATH=your_best.pt_path
COSMETIC_API_URL=cosmetic_api_address
USER_COSMETIC_API_URL=user_cosmetic_api_address
```

### 3. Backend 실행

```bash
cd 2.Backend_node
npm install
nodemon server.js
# → http://localhost:3000
```

### 4. AI Server 실행

```bash
cd 3.Ai_FastAPI

# 가상환경 생성 및 활성화
python -m venv venv

# Windows
venv\Scripts\activate
# Mac / Linux
source venv/bin/activate

# 패키지 설치 및 실행
pip install -r requirements.txt
uvicorn main:app --reload
# → http://localhost:8000

```

### 5. Frontend 실행

```bash
cd 1.Frontend_React
npm install
npm run dev
# → http://localhost:5173
```

> 실행 순서: **Backend → AI Server → Frontend** 순으로 실행해주세요.

---
