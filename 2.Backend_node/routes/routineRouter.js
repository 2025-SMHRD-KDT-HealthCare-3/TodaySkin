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
            data: { message: "유효하지 않은 토큰입니다." }
        });
    }
};

/*
   DB 저장 헬퍼
   Python 루틴을 ROUTINES → CHALLENGE_DETAILS → ACTIONS 순서로 저장
   Python 응답 형태:
   { morning: [{name, cos_no}, ...], evening: [...], special: [...] }
*/


async function saveRoutineToDB(user_no, chal_no, routineData) {
    const connPromise = conn.promise();
    const timeSlots = ['morning', 'evening', 'special'];

    for (const time of timeSlots) {
        const items = routineData[time] || [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i]; // { name: "토너 바르기", cos_no: 101 }

            // 1. ROUTINES INSERT (cos_no NOT NULL 유지)
            const [routineRes] = await connPromise.query(
                "INSERT INTO routines (user_no, cos_no, routine_time, routine_order) VALUES (?, ?, ?, ?)",
                [user_no, item.cos_no, time, i + 1]
            );
            const routine_no = routineRes.insertId;

            // 2. CHALLENGE_DETAILS INSERT
            const [detailRes] = await connPromise.query(
                "INSERT INTO challenge_details (chal_no, routine_no) VALUES (?, ?)",
                [chal_no, routine_no]
            );
            const detail_no = detailRes.insertId;

            // 3. ACTIONS INSERT (초기값 N)
            await connPromise.query(
                "INSERT INTO actions (user_no, detail_no, action_yn) VALUES (?, ?, 'N')",
                [user_no, detail_no]
            );
        }
    }
}


// 달성률 계산 헬퍼


function getCumulativeRate(user_no, chal_no) {
    return new Promise((resolve, reject) => {
        const today = new Date().toISOString().slice(0, 10);
        const sql = `
            SELECT
                ROUND(
                    SUM(CASE WHEN a.action_yn = 'Y' AND DATE(a.created_at) = ? THEN 1 ELSE 0 END)
                    / NULLIF(COUNT(CASE WHEN DATE(a.created_at) = ? THEN 1 ELSE 0 END), 0) * 100
                , 1) AS daily_rate,
                ROUND(
                    SUM(CASE WHEN a.action_yn = 'Y' THEN 1 ELSE 0 END)
                    / NULLIF(COUNT(a.action_no), 0) * 100
                , 1) AS cumulative_rate
            FROM challenge_details cd
            JOIN actions a ON cd.detail_no = a.detail_no AND a.user_no = ?
            WHERE cd.chal_no = ?
        `;
        conn.query(sql, [today, today, user_no, chal_no], (err, results) => {
            if (err) return reject(err);
            resolve({
                daily_rate: results[0]?.daily_rate || 0,
                cumulative_rate: results[0]?.cumulative_rate || 0
            });
        });
    });
}

/*
   루틴 조회
   GET /api/routine
   - day_count 1 또는 8이면 AI 서버에 신규 루틴 생성 후 DB 저장
   - 그 외 날짜는 기존 루틴 DB에서 조회
*/

router.get('/', requireLogin, async (req, res) => {
    const user_no = req.user.user_no;

    const chalSql = `
        SELECT chal_no, chal_type, start_date, DATEDIFF(NOW(), start_date) + 1 AS day_count
        FROM challenges
        WHERE user_no = ? AND chal_status = '진행중'
        ORDER BY created_at DESC LIMIT 1
    `;

    conn.query(chalSql, [user_no], async (err, chalResults) => {
        if (err) return handleError(res, err);
        if (chalResults.length === 0) {
            return handleError(res, new ValidationError("진행 중인 챌린지가 없습니다.", 404));
        }

        const { chal_no, chal_type, day_count } = chalResults[0];
        const needNewRoutine = day_count === 1 || day_count === 8;

        if (needNewRoutine) {
            try {
                // 1. 최신 분석 결과 조회
                const [analysis] = await conn.promise().query(
                    "SELECT acne_score, pore_score FROM img_analyses a JOIN uploads u ON a.upload_no = u.upload_no WHERE u.user_no = ? ORDER BY a.created_at DESC LIMIT 1",
                    [user_no]
                );

                // 2. 보유 화장품 조회 (AI에게 전달할 목록)
                const [cosmetics] = await conn.promise().query(
                    "SELECT c.cos_no, c.cos_name, c.cos_type, c.cos_function FROM user_cosmetics uc JOIN cosmetics c ON uc.cos_no = c.cos_no WHERE uc.user_no = ?",
                    [user_no]
                );

                // 3. AI 서버에 루틴 생성 요청
                // Python은 { morning: [{name, cos_no},...], evening: [...], special: [...] } 형태로 반환
                const pythonRes = await axios.post(`${FASTAPI_URL}/api/routine/generate`, {
                    user_no,
                    skin_type: req.user.skin_type || "",
                    acne_score: analysis[0]?.acne_score || 0,
                    pore_score: analysis[0]?.pore_score || 0,
                    user_cosmetics: cosmetics, // 보유 화장품 목록 전달
                    week: day_count <= 7 ? 1 : 2
                });

                const routine = pythonRes.data.data.routine;

                // 4. 생성된 루틴 DB 저장
                await saveRoutineToDB(user_no, chal_no, routine);

                const rates = await getCumulativeRate(user_no, chal_no);

                return res.json({
                    status: "success",
                    data: {
                        day_count,
                        cumulative_achievement_rate: rates.cumulative_rate,
                        routine
                    }
                });

            } catch (error) {
                return handleError(res, error);
            }

        } else {
            // 기존 루틴 조회 + is_owned로 보유/추천 구분
            const routineSql = `
                SELECT
                    a.action_no,
                    c.cos_name AS name,
                    r.routine_time,
                    CASE WHEN a.action_yn = 'Y' THEN true ELSE false END AS completed,
                    CASE WHEN uc.ucos_no IS NOT NULL THEN true ELSE false END AS is_owned
                FROM challenge_details cd
                JOIN routines r ON cd.routine_no = r.routine_no
                JOIN cosmetics c ON r.cos_no = c.cos_no
                LEFT JOIN user_cosmetics uc ON uc.user_no = ? AND uc.cos_no = c.cos_no
                LEFT JOIN actions a ON cd.detail_no = a.detail_no AND a.user_no = ?
                WHERE cd.chal_no = ?
                ORDER BY r.routine_time, r.routine_order
            `;

            conn.query(routineSql, [user_no, user_no, chal_no], async (err, routineRows) => {
                if (err) return handleError(res, err);

                const grouped = { morning: [], evening: [], special: [] };
                routineRows.forEach(row => {
                    grouped[row.routine_time].push({
                        action_no: row.action_no,
                        name: row.name,
                        completed: row.completed,
                        is_owned: row.is_owned // 프론트에서 보유/추천 구분용
                    });
                });

                const rates = await getCumulativeRate(user_no, chal_no);

                return res.json({
                    status: "success",
                    data: {
                        day_count,
                        cumulative_achievement_rate: rates.cumulative_rate,
                        routine: grouped
                    }
                });
            });
        }
    });
});

/*
   루틴 체크
   PATCH /api/routine/:action_no
*/

router.patch('/:action_no', requireLogin, (req, res) => {
    try {
        const { action_no } = req.params;
        const { completed } = req.body;
        const user_no = req.user.user_no;

        // 유효성 검사
        if (!action_no || isNaN(action_no)) {
            throw new ValidationError("올바른 루틴 번호를 입력해주세요.");
        }
        if (typeof completed !== 'boolean') {
            throw new ValidationError("completed 값은 true 또는 false여야 합니다.");
        }

        // 소유권 확인
        const checkSql = "SELECT action_no FROM actions WHERE action_no = ? AND user_no = ?";

        conn.query(checkSql, [action_no, user_no], (err, results) => {
            if (err) return handleError(res, err);

            if (results.length === 0) {
                return handleError(res, new ValidationError("해당 루틴을 찾을 수 없거나 권한이 없습니다.", 403));
            }

            const action_yn = completed ? 'Y' : 'N';

            conn.query(
                "UPDATE actions SET action_yn = ? WHERE action_no = ? AND user_no = ?",
                [action_yn, action_no, user_no],
                async (err) => {
                    if (err) return handleError(res, err);

                    const [chal] = await conn.promise().query(
                        "SELECT chal_no FROM challenges WHERE user_no = ? AND chal_status = '진행중' LIMIT 1",
                        [user_no]
                    );

                    const rates = await getCumulativeRate(user_no, chal[0]?.chal_no);

                    return res.json({
                        status: "success",
                        data: rates
                    });
                }
            );
        });

    } catch (error) {
        handleError(res, error);
    }
});

module.exports = router;