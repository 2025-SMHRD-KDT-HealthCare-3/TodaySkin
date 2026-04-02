const express = require('express');
const router = express.Router();
const axios = require('axios');
const conn = require('../config/database'); 
const { requireLogin } = require('../middleware/auth');
const { ValidationError } = require('../middleware/errorHandler');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';

/*
    챗봇 메시지 전송 (POST)
    /api/chatbot/message
*/
router.post('/message', requireLogin, async (req, res, next) => {
    try {
        const { message } = req.body;
        const user_no = req.user.user_no;

        if (!message || !message.trim()) {
            throw new ValidationError("메시지를 입력해주세요.");
        }

        // 1. AI에게 전달할 종합 데이터 조회 (피부점수 + 분석날짜 + 보유화장품)
        const userDataSql = `
            SELECT 
                a.acne_score,
                a.pore_score,
                DATE_FORMAT(a.created_at, '%Y-%m-%d') as last_analysis_date,
                (SELECT GROUP_CONCAT(c.cos_name SEPARATOR ', ') 
                 FROM user_cosmetics uc 
                 JOIN cosmetics c ON uc.cos_no = c.cos_no 
                 WHERE uc.user_no = ?) as user_cosmetics
            FROM img_analyses a
            JOIN uploads u ON a.upload_no = u.upload_no
            WHERE u.user_no = ?
            ORDER BY a.created_at DESC LIMIT 1
        `;
        
        const [userResults] = await conn.query(userDataSql, [user_no, user_no]);
        
        // 기본값 설정
        const info = userResults[0] || { 
            acne_score: 0, 
            pore_score: 0, 
            last_analysis_date: "기록 없음",
            user_cosmetics: "정보 없음" 
        };

        // 2. FastAPI 서버로 챗봇 요청 전달
        const pythonRes = await axios.post(
            `${FASTAPI_URL}/api/chatbot/message`,
            {
                message: message.trim(),
                user_no: Number(user_no),
                skin_type: req.user.skin_type || "정보 없음",
                acne_score: Number(info.acne_score) || 0, 
                pore_score: Number(info.pore_score) || 0, // 
                user_cosmetics: String(info.user_cosmetics || "정보 없음"),
                // ✅ "기록 없음"이라는 한글은 FastAPI(Pydantic)에서 날짜 에러를 낼 수 있으므로 ""로 처리
                last_analysis_date: info.last_analysis_date === "기록 없음" ? "" : info.last_analysis_date,
            },
            { timeout: 15000 } 
        );

        // 3. 성공 응답
        res.json({
            status: "success",
            data: {
                answer: pythonRes.data.data.answer,
                timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19)
            }
        });

    } catch (error) {
        // FastAPI 서버 연결 실패 시 에러 처리
        if (error.code === 'ECONNREFUSED') {
            return next(new Error("AI 서버와 통신할 수 없습니다. 주소와 전원을 확인해주세요."));
        }
        next(error); 
    }
});

module.exports = router;