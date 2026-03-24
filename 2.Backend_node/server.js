/*
* 참고! 각각 포트번호가 달라야 충돌 없습니다.
React      → http://localhost:5173  (Vite 기본값)
Node.js    → http://localhost:3000
FastAPI    → http://localhost:8000
*/


// 설치한 모듈 등록
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// 미들웨어
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended : true }))

// 테스트 라우터
app.get('/', (req, res) => {
  res.json({ message: '오늘의 피부 서버 실행 중!' });
});

// DB연결 TEST : 확인 후 삭제
const conn = require('./config/database');

conn.connect((err) => {
  if (err) {
    console.error('DB 연결 실패:', err);
  } else {
    console.log('DB 연결 성공! ✅');
  }
});
// DB연결 TEST : 여기까지 삭제

app.listen(PORT, () => {
  console.log(`서버 실행 중: http://localhost:${PORT}`);
});