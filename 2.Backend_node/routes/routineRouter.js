const express = require('express');
const router = express.Router();
const axios = require('axios');
const conn = require('../config/database'); 
const { ValidationError } = require('../middleware/errorHandler');
const { requireLogin } = require('../middleware/auth');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://192.168.219.52:8000';


// 헬퍼 함수: DB 저장 (트랜잭션 적용 권장)

async function saveRoutineToDB(user_no, chal_no, routineData) {
    const timeSlots = ['morning', 'evening', 'special'];

   
    for (const time of timeSlots) {
        const items = routineData[time] || [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // 1. ROUTINES INSERT
            const [routineRes] = await conn.query(
                "INSERT INTO routines (user_no, cos_no, routine_time, routine_order) VALUES (?, ?, ?, ?)",
                [user_no, item.cos_no, time, i + 1]
            );
            const routine_no = routineRes.insertId;

            // 2. CHALLENGE_DETAILS INSERT
            const [detailRes] = await conn.query(
                "INSERT INTO challenge_details (chal_no, routine_no) VALUES (?, ?)",
                [chal_no, routine_no]
            );
            const detail_no = detailRes.insertId;

            // 3. ACTIONS INSERT
            await conn.query(
                "INSERT INTO actions (user_no, detail_no, action_yn, created_at) VALUES (?, ?, 'N', NOW())",
                [user_no, detail_no]
            );
        }
    }
}

// 달성률 계산 헬퍼 (Promise 기반으로 변경)

async function getCumulativeRate(user_no, chal_no) {
    const today = new Date().toISOString().slice(0, 10);
    const sql = `
        SELECT
            ROUND(SUM(CASE WHEN a.action_yn = 'Y' AND DATE(a.created_at) = ? THEN 1 ELSE 0 END)
            / NULLIF(COUNT(CASE WHEN DATE(a.created_at) = ? THEN 1 ELSE 0 END), 0) * 100, 1) AS daily_rate,
            ROUND(SUM(CASE WHEN a.action_yn = 'Y' THEN 1 ELSE 0 END)
            / NULLIF(COUNT(a.action_no), 0) * 100, 1) AS cumulative_rate
        FROM challenge_details cd
        JOIN actions a ON cd.detail_no = a.detail_no AND a.user_no = ?
        WHERE cd.chal_no = ?
    `;
    const [results] = await conn.query(sql, [today, today, user_no, chal_no]);
    return {
        daily_rate: results[0]?.daily_rate || 0,
        cumulative_rate: results[0]?.cumulative_rate || 0
    };
}


// 루틴 조회 (GET)

router.get('/', requireLogin, async (req, res, next) => {
    const user_no = req.user.user_no;

    try {
        // 1. 진행 중인 챌린지 확인
        const chalSql = `
            SELECT chal_no, chal_type, start_date, DATEDIFF(NOW(), start_date) + 1 AS day_count
            FROM challenges
            WHERE user_no = ? AND chal_status = '진행중'
            ORDER BY created_at DESC LIMIT 1
        `;
        const [chalResults] = await conn.query(chalSql, [user_no]);

        if (chalResults.length === 0) {
            throw new ValidationError("진행 중인 챌린지가 없습니다.", 404);
        }

        const { chal_no, day_count } = chalResults[0];
        const needNewRoutine = day_count === 1 || day_count === 8;

        if (needNewRoutine) {
            // AI 서버 요청 및 저장 로직
            const [analysis] = await conn.query(
                "SELECT acne_score, pore_score FROM img_analyses a JOIN uploads u ON a.upload_no = u.upload_no WHERE u.user_no = ? ORDER BY a.created_at DESC LIMIT 1",
                [user_no]
            );

            const [cosmetics] = await conn.query(
                "SELECT c.cos_no, c.cos_name, c.cos_type, c.cos_function FROM user_cosmetics uc JOIN cosmetics c ON uc.cos_no = c.cos_no WHERE uc.user_no = ?",
                [user_no]
            );

            const pythonRes = await axios.post(`${FASTAPI_URL}/api/routine/generate`, {
                user_no,
                skin_type: req.user.skin_type || "",
                acne_score: analysis[0]?.acne_score || 0,
                pore_score: analysis[0]?.pore_score || 0,
                user_cosmetics: cosmetics,
                week: day_count <= 7 ? 1 : 2
            });

            const routine = pythonRes.data.data.routine;
            await saveRoutineToDB(user_no, chal_no, routine);

            const rates = await getCumulativeRate(user_no, chal_no);
            res.json({
                status: "success",
                data: { day_count, cumulative_achievement_rate: rates.cumulative_rate, routine }
            });
        } else {
            // 기존 루틴 조회
            const routineSql = `
                SELECT a.action_no, c.cos_name AS name, r.routine_time,
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
            const [routineRows] = await conn.query(routineSql, [user_no, user_no, chal_no]);

            const grouped = { morning: [], evening: [], special: [] };
            routineRows.forEach(row => {
                grouped[row.routine_time].push({
                    action_no: row.action_no,
                    name: row.name,
                    completed: row.completed,
                    is_owned: row.is_owned
                });
            });

            const rates = await getCumulativeRate(user_no, chal_no);
            res.json({
                status: "success",
                data: { day_count, cumulative_achievement_rate: rates.cumulative_rate, routine: grouped }
            });
        }
    } catch (error) {
        next(error);
    }
});


// 루틴 체크 (PATCH)

router.patch('/:action_no', requireLogin, async (req, res, next) => {
    try {
        const { action_no } = req.params;
        const { completed } = req.body;
        const user_no = req.user.user_no;

        if (isNaN(action_no)) throw new ValidationError("올바른 루틴 번호를 입력해주세요.");
        if (typeof completed !== 'boolean') throw new ValidationError("completed 값은 boolean이어야 합니다.");

        // 소유권 확인 및 업데이트
        const [results] = await conn.query("SELECT action_no FROM actions WHERE action_no = ? AND user_no = ?", [action_no, user_no]);
        if (results.length === 0) throw new ValidationError("권한이 없습니다.", 403);

        const action_yn = completed ? 'Y' : 'N';
        await conn.query("UPDATE actions SET action_yn = ? WHERE action_no = ? AND user_no = ?", [action_yn, action_no, user_no]);

        // 진행 중인 챌린지의 달성률 계산
        const [chal] = await conn.query("SELECT chal_no FROM challenges WHERE user_no = ? AND chal_status = '진행중' LIMIT 1", [user_no]);
        const rates = await getCumulativeRate(user_no, chal[0]?.chal_no);

        res.json({ status: "success", data: rates });
    } catch (error) {
        next(error);
    }
});

module.exports = router;