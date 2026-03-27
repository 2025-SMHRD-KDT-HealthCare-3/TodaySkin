/*
* 참고! 각각 포트번호가 달라야 충돌 없습니다.
React      → http://localhost:5173  (Vite 기본값)
Node.js    → http://localhost:3000
FastAPI    → http://localhost:8000
*/


// 설치한 모듈 등록
const express = require('express');
const cors = require('cors');
const session = require('express-session'); 
const FileStore = require('session-file-store')(session);
require('dotenv').config();


// 메인 라우터 불러오기
const mainRouter = require('./routes/mainRouter');


const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors({
    origin: 'http://localhost:5173', // React 주소
    credentials: true                // 쿠키 허용
}));
app.use(express.json());
app.use(express.urlencoded({ extended : true }))

// 세션 설정
app.use(session({
    secret: process.env.SESSION_SECRET, 
    resave: false,
    saveUninitialized: false,
    store: new FileStore(),     
    cookie: {
        httpOnly: true,
        secure: false, 
        maxAge: 1000 * 60 * 60 * 24 // 24시간 유지
    }
}));

// 모든 /api로 시작하는 요청은 mainRouter가 처리한다.
app.use('/api', mainRouter);

// 테스트용 기본 라우트
app.get('/', (req, res) => {
  res.json({ message: '오늘의 피부 서버 실행 중!' });
});

// 5. DB 연결 확인 (config/database.js 연동)
const conn = require('./config/database');

conn.connect((err) => {
  if (err) {
    console.error('DB 연결 실패:', err);
  } else {
    console.log('DB 연결 성공! ✅');
  }
});

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});


