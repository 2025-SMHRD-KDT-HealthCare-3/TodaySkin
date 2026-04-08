/*
 * routineRouter — 루틴 관리
 - GET   /api/routine           루틴 조회 (없으면 AI 생성)
 - PATCH /api/routine/:action_no 루틴 체크 (완료/미완료 토글)
*/

const express = require('express');
const router = express.Router();
const axios = require('axios');
const conn = require('../config/database');
const { FASTAPI_URL } = require('../config/apiConfig');
const { ValidationError } = require('../middleware/errorHandler');
const { requireLogin } = require('../middleware/auth');

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

// KST 날짜 헬퍼
const getKSTDate = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};

const getKSTDatetime = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
};

// 1. 루틴 저장 헬퍼
async function saveRoutineToDB(user_no, chal_no, routineData) {
    const timeSlots = ['morning', 'evening', 'special'];

    for (const time of timeSlots) {
        const items = routineData[time] || [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            let cos_no = null;

            if (item.cos_name) {
                const [cosResult] = await conn.query("SELECT cos_no FROM cosmetics WHERE cos_name = ? LIMIT 1", [item.cos_name]);
                if (cosResult.length > 0) cos_no = cosResult[0].cos_no;
            }

            if (time !== 'special' && !cos_no && !item.cos_name) continue;
            if (time === 'special' && !item.description) continue;

            if (cos_no) {
                const isWaterWash = (cos_no === 2486 || item.cos_name === '물 세안');
                const [checkOwned] = await conn.query("SELECT source FROM user_cosmetics WHERE user_no = ? AND cos_no = ?", [user_no, cos_no]);

                if (checkOwned.length === 0) {
                    await conn.query("INSERT INTO user_cosmetics (user_no, cos_no, source) VALUES (?, ?, ?)",
                        [user_no, cos_no, isWaterWash ? '보유' : '추천']);
                } else if (isWaterWash && checkOwned[0].source === '추천') {
                    await conn.query("UPDATE user_cosmetics SET source = '보유' WHERE user_no = ? AND cos_no = ?", [user_no, cos_no]);
                }
            }

            const order = i + 1;
            const [routineRes] = await conn.query(
                "INSERT INTO routines (user_no, cos_no, routine_time, routine_order, description, recommend_reason) VALUES (?, ?, ?, ?, ?, ?)",
                [user_no, cos_no, time, order, item.description || null, item.recommend_reason || null]
            );

            const [detailRes] = await conn.query("INSERT INTO challenge_details (chal_no, routine_no) VALUES (?, ?)", [chal_no, routineRes.insertId]);

            const [checkSource] = await conn.query(
                "SELECT source FROM user_cosmetics WHERE user_no = ? AND cos_no = ?",
                [user_no, cos_no]
            );

            if (checkSource.length > 0 && checkSource[0].source === '보유') {
                await conn.query(
                    "INSERT INTO actions (user_no, detail_no, action_yn, created_at) VALUES (?, ?, 'N', ?)",
                    [user_no, detailRes.insertId, getKSTDatetime()]
                );
            }
        }
    }
}

// 2. 달성률 계산 헬퍼
async function getCumulativeRate(user_no, chal_no) {
    const today = getKSTDate();
    const sql = `
        SELECT 
        COUNT(a.action_no) AS total_count,
        SUM(CASE WHEN a.action_yn = 'Y' THEN 1 ELSE 0 END) AS done_count
        FROM actions a
        JOIN challenge_details cd ON a.detail_no = cd.detail_no
        JOIN routines r ON cd.routine_no = r.routine_no
        JOIN user_cosmetics uc ON r.cos_no = uc.cos_no AND uc.user_no = a.user_no
        WHERE a.user_no = ? 
        AND cd.chal_no = ?
        AND DATE(a.created_at) = ?  
        AND uc.source = '보유'                    
        AND r.routine_time IN ('morning', 'evening') 
    `;
    const [results] = await conn.query(sql, [user_no, chal_no, today]);

    const total = Number(results[0].total_count) || 0;
    const done = Number(results[0].done_count) || 0;
    const calculated_rate = total > 0 ? Math.round((done / total) * 100) : 0;

    return { daily_rate: calculated_rate, total, done };
}

// 3. 루틴 조회 및 생성 (GET)
router.get('/', requireLogin, async (req, res, next) => {
    const user_no = req.user.user_no;
    const today = getKSTDate();

    try {
        const [chalResults] = await conn.query(
            "SELECT chal_no, chal_type, start_date, DATEDIFF(NOW(), start_date) + 1 AS day_count FROM challenges WHERE user_no = ? AND chal_status = '진행중' ORDER BY created_at DESC LIMIT 1",
            [user_no]
        );

        if (chalResults.length === 0) throw new ValidationError("진행 중인 챌린지가 없습니다.", 404);
        const { chal_no, chal_type, day_count } = chalResults[0];

        // 오늘 이미 생성된 기록이 있는지 확인
        const [existingCheck] = await conn.query(`
            SELECT a.action_no FROM actions a
            JOIN challenge_details cd ON a.detail_no = cd.detail_no
            WHERE cd.chal_no = ? AND a.user_no = ? AND DATE(a.created_at) = ?
            LIMIT 1
        `, [chal_no, user_no, today]);

        const needNewRoutine = (day_count === 1 || day_count === 8) && existingCheck.length === 0;

        if (needNewRoutine) {
            // 중복 방지 삭제 후 재생성
            await conn.query(
                "DELETE a FROM actions a JOIN challenge_details cd ON a.detail_no = cd.detail_no WHERE cd.chal_no = ? AND a.user_no = ? AND DATE(a.created_at) = ?",
                [chal_no, user_no, today]
            );

            const [analysis] = await conn.query(
                "SELECT acne_score, pore_score FROM img_analyses a JOIN uploads u ON a.upload_no = u.upload_no WHERE u.user_no = ? ORDER BY a.created_at DESC LIMIT 1",
                [user_no]
            );

            const pythonRes = await axios.post(`${FASTAPI_URL}/api/routine/generate`, {
                user_no: Number(user_no),
                skin_type: req.user.skin_type || "지성",
                acne_score: Number(analysis[0]?.acne_score || 0),
                pore_score: Number(analysis[0]?.pore_score || 0),
                chal_type: Number(chal_type),
                week: day_count <= 7 ? 1 : 2,
                fixed_routines: "물 세안"
            }, { headers: { 'x-internal-key': INTERNAL_API_KEY }, timeout: 60000 });

            await saveRoutineToDB(user_no, chal_no, pythonRes.data.data.routine);

        } else if (existingCheck.length === 0) {
            // Day 2~7, 9~14: 어제 루틴을 오늘 날짜로 복사
            await conn.query(`
                INSERT INTO actions (user_no, detail_no, action_yn, created_at)
                SELECT ?, cd.detail_no, 'N', ?
                FROM challenge_details cd
                JOIN routines r ON cd.routine_no = r.routine_no
                JOIN user_cosmetics uc ON r.cos_no = uc.cos_no AND uc.user_no = ?
                WHERE cd.chal_no = ? AND uc.source = '보유'
            `, [user_no, getKSTDatetime(), user_no, chal_no]);
        }

        // 최종 응답 데이터 구성
        const routineSql = `
            SELECT 
                r.routine_time, 
                r.routine_order, 
                c.cos_name, 
                r.description, 
                r.recommend_reason,
                IFNULL(uc.source, '추천') AS source,
                a.action_no,
                CASE WHEN a.action_yn = 'Y' THEN true ELSE false END AS completed
            FROM challenge_details cd
            JOIN routines r ON cd.routine_no = r.routine_no
            LEFT JOIN cosmetics c ON r.cos_no = c.cos_no
            LEFT JOIN user_cosmetics uc ON uc.cos_no = r.cos_no AND uc.user_no = ?
            LEFT JOIN actions a ON cd.detail_no = a.detail_no AND a.user_no = ? AND DATE(a.created_at) = ?
            WHERE cd.chal_no = ?
            ORDER BY r.routine_time, r.routine_order
        `;
        const [dbRows] = await conn.query(routineSql, [user_no, user_no, today, chal_no]);

        const finalGrouped = { morning: [], evening: [], special: [] };
        dbRows.forEach(row => {
            if (finalGrouped[row.routine_time]) {
                finalGrouped[row.routine_time].push({
                    order: row.routine_order,
                    name: row.routine_time === 'special' ? (row.description || "관리") : (row.cos_name || "추천 제품"),
                    source: row.source,
                    completed: row.completed === 1 || row.completed === true,
                    action_no: row.action_no,
                    description: row.description || ""
                });
            }
        });

        const rates = await getCumulativeRate(user_no, chal_no);
        res.json({ status: "success", data: { day_count, daily_rate: rates.daily_rate, routine: finalGrouped } });

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

        const updateSql = `
            UPDATE actions 
            SET action_yn = ?, 
                routine_checked = CASE WHEN ? = 'Y' THEN NOW() ELSE NULL END 
            WHERE action_no = ? AND user_no = ?
        `;
        await conn.query(updateSql, [action_yn, action_yn, action_no, user_no]);

        const [chal] = await conn.query("SELECT chal_no FROM challenges WHERE user_no = ? AND chal_status = '진행중' LIMIT 1", [user_no]);
        const rates = await getCumulativeRate(user_no, chal[0]?.chal_no);

        res.json({ status: "success", message: "상태 변경 완료", daily_rate: rates.daily_rate });
    } catch (error) {
        next(error);
    }
});

module.exports = router;