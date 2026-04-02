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

// --- 여기서부터 수정된 DB 연결 및 서버 실행부 ---

// DB 연결 확인 (Pool 방식 전용)
// Pool은 명시적으로 connect하지 않아도 되지만, 서버 시작 시 연결 상태를 확인하기 위해 작성합니다.
(async () => {
    try {
        const connection = await conn.getConnection();
        console.log('DB 풀(Pool) 연결 성공! ✅');
        connection.release(); // 확인 후 연결 통로 반납 (필수!)
    } catch (err) {
        console.error('DB 연결 실패! 설정 확인 필요:', err);
        // DB 연결 실패해도 서버가 바로 죽지 않도록 process.exit은 뺍니다.
    }
})();

// 서버 실행
app.listen(PORT, () => {
    console.log(`서버 실행 중: http://localhost:${PORT}`);
});


// 그레이스풀 셧다운

// const gracefulShutdown = (signal) => {
//     console.log(`${signal} 신호 수신 - 서버를 안전하게 종료합니다.`);

//     server.close(() => {
//         console.log('HTTP 서버 종료 완료');

//         conn.end((err) => {
//             if (err) console.error('DB 연결 종료 오류:', err);
//             else console.log('DB 연결 종료 완료');
//             process.exit(0);
//         });
//     });

//     setTimeout(() => {
//         console.error('강제 종료합니다.');
//         process.exit(1);
//     }, 10000);
// };

// process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
// process.on('SIGINT', () => gracefulShutdown('SIGINT'));