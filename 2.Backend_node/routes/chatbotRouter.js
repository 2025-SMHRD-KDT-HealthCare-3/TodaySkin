const express = require('express');
const router = express.Router();
const conn = require('../config/database');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const FASTAPI_URL = 'http://192.168.219.52:8000'; // IP 바뀌면 여기만 수정


// 커스텀 에러 클래스


class ValidationError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = statusCode;
    }
}


// 공통 에러 핸들러


const handleError = (res, error) => {
    if (error instanceof ValidationError) {
        return res.status(error.statusCode).json({
            status: "error",
            data: { message: error.message }
        });
    }
    console.error('[SERVER ERROR]', error);
    return res.status(500).json({
        status: "error",
        data: { message: "서버 오류" }
    });
};


// JWT 인증 미들웨어


const requireLogin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            status: "error",
            data: { message: "로그인이 필요합니다." }
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            status: "error",
            data: { message: "유효하지 않거나 만료된 토큰입니다." }
        });
    }
};


// 챗봇 메시지 전송
// POST /api/chatbot/message
// - DB에서 사용자 피부 데이터 조회 후 AI 서버로 전달
// - 보안상 대화내용 저장 X


router.post('/message', requireLogin, async (req, res) => {
    try {
        const { message } = req.body;
        const user_no = req.user.user_no;

        if (!message || !message.trim()) {
            throw new ValidationError("메시지를 입력해주세요.");
        }

        const skinDataSql = `
            SELECT
                a.acne_score,
                a.pore_score,
                ROUND((a.acne_score + a.pore_score) / 2, 1) AS total_score,
                DATE(u.uploaded_at) AS last_analysis_date
            FROM img_analyses a
            JOIN uploads u ON a.upload_no = u.upload_no
            WHERE u.user_no = ?
            ORDER BY a.created_at DESC LIMIT 1
        `;

        conn.query(skinDataSql, [user_no], async (err, skinResults) => {
            if (err) return handleError(res, err);

            try {
                const pythonRes = await axios.post(
                    `${FASTAPI_URL}/api/chatbot/message`, // ✅ 변수로 관리
                    {
                        message: message.trim(),
                        user_no,
                        skin_type: req.user.skin_type || "",
                        acne_score: skinResults[0]?.acne_score || 0,
                        pore_score: skinResults[0]?.pore_score || 0
                    }
                );

                return res.json({
                    status: "success",
                    data: {
                        answer: pythonRes.data.data.answer,
                        timestamp: new Date().toISOString()
                            .replace('T', ' ').slice(0, 19)
                    }
                });

            } catch (error) {
                console.error('[CHATBOT SERVER ERROR]', error.message);
                return handleError(res,
                    new Error("챗봇 응답 중 오류가 발생했습니다."));
            }
        });

    } catch (error) {
        handleError(res, error);
    }
});

module.exports = router;