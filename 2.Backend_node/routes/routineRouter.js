const express = require('express');
const router = express.Router();
const axios = require('axios');
const conn = require('../config/database'); 
const { ValidationError } = require('../middleware/errorHandler');
const { requireLogin } = require('../middleware/auth');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://127.0.0.1:8000';

// 1. 루틴 저장 헬퍼 (Routines -> Details -> Actions 순차 저장)
async function saveRoutineToDB(user_no, chal_no, routineData) {
    const timeSlots = ['morning', 'evening', 'special'];

    for (const time of timeSlots) {
        const items = routineData[time] || [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            let cos_no = item.cos_no || null;
            if (!cos_no && item.cos_name) {
                const [cosResult] = await conn.query(
                    "SELECT cos_no FROM cosmetics WHERE cos_name = ? OR cos_name LIKE ? LIMIT 1",
                    [item.cos_name, `%${item.cos_name.split(' ')[0]}%`] 
                );
                if (cosResult.length > 0) cos_no = cosResult[0].cos_no;
            }

            if (!cos_no) continue;

            const [checkOwned] = await conn.query(
                "SELECT ucos_no FROM user_cosmetics WHERE user_no = ? AND cos_no = ?",
                [user_no, cos_no]
            );

            // 보관함에 없으면 AI가 추천한 것이므로 '추천'으로 저장
            if (checkOwned.length === 0) {
                await conn.query(
                    "INSERT INTO user_cosmetics (user_no, cos_no, source) VALUES (?, ?, '추천')",
                    [user_no, cos_no]
                );
            }

            const [routineRes] = await conn.query(
                "INSERT INTO routines (user_no, cos_no, routine_time, routine_order) VALUES (?, ?, ?, ?)",
                [user_no, cos_no, time, i + 1]
            );
            const routine_no = routineRes.insertId;

            const [detailRes] = await conn.query(
                "INSERT INTO challenge_details (chal_no, routine_no) VALUES (?, ?)",
                [chal_no, routine_no]
            );
            const detail_no = detailRes.insertId;

            await conn.query(
                "INSERT INTO actions (user_no, detail_no, action_yn, created_at) VALUES (?, ?, 'N', NOW())",
                [user_no, detail_no]
            );
        }
    }
}

// 2. 달성률 계산 헬퍼 (기존과 동일)
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

// 3. 루틴 조회 및 생성 (GET)
router.get('/', requireLogin, async (req, res, next) => {
    const user_no = req.user.user_no;

    try {
        const chalSql = `
            SELECT chal_no, chal_type, start_date, DATEDIFF(NOW(), start_date) + 1 AS day_count
            FROM challenges
            WHERE user_no = ? AND chal_status = '진행중'
            ORDER BY created_at DESC LIMIT 1
        `;
        const [chalResults] = await conn.query(chalSql, [user_no]);

        if (chalResults.length === 0) throw new ValidationError("진행 중인 챌린지가 없습니다.", 404);

        const { chal_no, chal_type, day_count } = chalResults[0];
        const needNewRoutine = day_count === 1 || day_count === 8;

        if (needNewRoutine) {
            const [analysis] = await conn.query(
                "SELECT acne_score, pore_score FROM img_analyses a JOIN uploads u ON a.upload_no = u.upload_no WHERE u.user_no = ? ORDER BY a.created_at DESC LIMIT 1",
                [user_no]
            );

            const [cosmetics] = await conn.query(
                "SELECT c.cos_name, c.cos_type FROM user_cosmetics uc JOIN cosmetics c ON uc.cos_no = c.cos_no WHERE uc.user_no = ?",
                [user_no]
            );
            const userCosmeticsText = cosmetics.map(c => `${c.cos_name}(${c.cos_type})`).join(", ") || "없음";

            const [candidates] = await conn.query("SELECT cos_name, cos_brand FROM cosmetics");
            const candidatesText = candidates.map(c => `- ${c.cos_name}(${c.cos_brand})`).join("\n");

            let total_score_change = 0;
            let compliance_rate = 0;

            if (day_count === 8) {
                const [prevAnalyses] = await conn.query(
                    "SELECT acne_score, pore_score FROM img_analyses a JOIN uploads u ON a.upload_no = u.upload_no WHERE u.user_no = ? ORDER BY a.created_at DESC LIMIT 2",
                    [user_no]
                );
                if (prevAnalyses.length === 2) {
                    const prevTotal = (prevAnalyses[1].acne_score + prevAnalyses[1].pore_score) / 2;
                    const currTotal = (prevAnalyses[0].acne_score + prevAnalyses[0].pore_score) / 2;
                    total_score_change = Number((currTotal - prevTotal).toFixed(1));
                }
                const rates = await getCumulativeRate(user_no, chal_no);
                compliance_rate = rates.cumulative_rate;
            }

            const pythonRes = await axios.post(`${FASTAPI_URL}/api/routine/generate`, {
                skin_type: req.user.skin_type || "지성",
                acne_score: Number(analysis[0]?.acne_score || 0),
                pore_score: Number(analysis[0]?.pore_score || 0),
                chal_type: Number(chal_type),
                week: day_count <= 7 ? 1 : 2,
                age: Number(req.user.age || 25), 
                gender: req.user.gender || "M",
                user_cosmetics: userCosmeticsText,
                cosmetic_candidates: candidatesText,
                total_score_change: total_score_change,
                compliance_rate: Number(compliance_rate)
            }, { timeout: 60000 });

            const routine = pythonRes.data.data.routine;
            if (!routine) throw new ValidationError("AI 루틴 생성에 실패했습니다.", 500);

            await saveRoutineToDB(user_no, chal_no, routine);

            const finalRates = await getCumulativeRate(user_no, chal_no);
            res.json({
                status: "success",
                data: { day_count, cumulative_achievement_rate: finalRates.cumulative_rate, routine }
            });
        } else {
            // ⭐ [수정] IFNULL(uc.source, '추천')을 사용하여 미보유를 '추천'으로 통합
            const routineSql = `
                SELECT a.action_no, c.cos_name AS name, r.routine_time,
                       CASE WHEN a.action_yn = 'Y' THEN true ELSE false END AS completed,
                       IFNULL(uc.source, '추천') AS source
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
                    source: row.source // 이제 '보유' 아니면 '추천'만 나갑니다.
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

// 4. 루틴 체크 (PATCH)
router.patch('/:action_no', requireLogin, async (req, res, next) => {
    try {
        const { action_no } = req.params;
        const { completed } = req.body;
        const user_no = req.user.user_no;

        const [results] = await conn.query("SELECT action_no FROM actions WHERE action_no = ? AND user_no = ?", [action_no, user_no]);
        if (results.length === 0) throw new ValidationError("권한이 없습니다.", 403);

        const action_yn = completed ? 'Y' : 'N';
        await conn.query("UPDATE actions SET action_yn = ? WHERE action_no = ? AND user_no = ?", [action_yn, action_no, user_no]);

        const [chal] = await conn.query("SELECT chal_no FROM challenges WHERE user_no = ? AND chal_status = '진행중' LIMIT 1", [user_no]);
        const rates = await getCumulativeRate(user_no, chal[0]?.chal_no);

        res.json({ status: "success", data: rates });
    } catch (error) {
        next(error);
    }
});

module.exports = router;