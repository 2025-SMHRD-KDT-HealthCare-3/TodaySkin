const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser'); 
require('dotenv').config();

const conn = require('./config/database');
const mainRouter = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;


// 미들웨어 등록 

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); 

// 라우터 등록
app.use('/api', mainRouter);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (_, res) => {
    res.json({ message: '오늘의 피부 서버 실행 중!' });
});


// DB 연결

conn.connect((err) => {
    if (err) {
        console.error('DB 연결 실패:', err);
        process.exit(1);
    } else {
        console.log('DB 연결 성공! ✅');
    }
});


// 서버 실행


const server = app.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
});


// 그레이스풀 셧다운

const gracefulShutdown = (signal) => {
    console.log(`${signal} 신호 수신 - 서버를 안전하게 종료합니다.`);

    server.close(() => {
        console.log('HTTP 서버 종료 완료');

        conn.end((err) => {
            if (err) console.error('DB 연결 종료 오류:', err);
            else console.log('DB 연결 종료 완료');
            process.exit(0);
        });
    });

    setTimeout(() => {
        console.error('강제 종료합니다.');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));