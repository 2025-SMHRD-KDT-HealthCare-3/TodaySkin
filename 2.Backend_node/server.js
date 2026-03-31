const express = require('express');
const cors = require('cors');
require('dotenv').config();
const conn = require('./config/database');
const mainRouter = require('./routes'); // ✅ 변수명 통일

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api', mainRouter); // ✅

app.get('/', (req, res) => {
    res.json({ message: '오늘의 피부 서버 실행 중!' });
});

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