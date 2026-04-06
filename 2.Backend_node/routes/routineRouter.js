/*
 * routineRouter — 루틴 관리
 - GET   /api/routine          루틴 조회 (없으면 AI 생성)
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


// 1. 루틴 저장 헬퍼
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

// 2. 달성률 계산 헬퍼
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
        
        // 1. 오늘 이미 생성된 루틴이 있는지 확인
        const [existingCheck] = await conn.query(`
            SELECT a.action_no 
            FROM actions a
            JOIN challenge_details cd ON a.detail_no = cd.detail_no
            WHERE cd.chal_no = ? AND a.user_no = ? AND DATE(a.created_at) = CURDATE()
            LIMIT 1
        `, [chal_no, user_no]);
        
        // 1일차 / 8일차 이면서 오늘 생성된 기록이 없을 때만 루틴 생성
        const needNewRoutine = (day_count === 1 || day_count === 8) && existingCheck.length === 0;

        if (needNewRoutine) {
            // 오늘 이미 생성된 루틴 데이터가 있으면 먼저 삭제 (멱등성 보장)
            await conn.query(`
                DELETE a FROM actions a
                JOIN challenge_details cd ON a.detail_no = cd.detail_no
                WHERE cd.chal_no = ? AND a.user_no = ? AND DATE(a.created_at) = CURDATE()
            `, [chal_no, user_no]);

            await conn.query(`
                DELETE FROM challenge_details 
                WHERE chal_no = ? AND detail_no NOT IN (SELECT detail_no FROM actions)
            `, [chal_no]);

            // AI 생성을 위한 데이터 준비
            const [analysis] = await conn.query(
                "SELECT acne_score, pore_score FROM img_analyses a JOIN uploads u ON a.upload_no = u.upload_no WHERE u.user_no = ? ORDER BY a.created_at DESC LIMIT 1",
                [user_no]
            );

            const [cosmetics] = await conn.query(
                "SELECT c.cos_name, c.cos_type FROM user_cosmetics uc JOIN cosmetics c ON uc.cos_no = c.cos_no WHERE uc.user_no = ?",
                [user_no]
            );
            const userCosmeticsText = cosmetics.map(c => `${c.cos_name}(${c.cos_type})`).join(", ") || "없음";

            /*
              * 기존 cosmetics 테이블 전체를 후보로 전달 → 토큰 부족
              * 변경내용
                - 사용자 보유 cos_type 목록 추출 → userTypes
                - 보유 타입 제외한 카테고리에서 타입별 최대 10개만 조회
                - 사용자 보유 화장품이 없는 경우(신규 사용자)도 타입별 10개로 처리
                - cos_type도 함께 전달하여 AI가 카테고리 파악 가능
            */
            const userTypes = [...new Set(cosmetics.map(c => c.cos_type))];
            let candidatesText = "없음";
            if (userTypes.length > 0) {
                const placeholders = userTypes.map(() => '?').join(',');
                const [candidates] = await conn.query(
                    `SELECT cos_name, cos_brand, cos_type
                     FROM (
                         SELECT cos_name, cos_brand, cos_type,
                                ROW_NUMBER() OVER (PARTITION BY cos_type ORDER BY cos_no) AS rn
                         FROM cosmetics
                         WHERE cos_type NOT IN (${placeholders})
                     ) ranked
                     WHERE rn <= 10`,
                    userTypes
                );
                candidatesText = candidates.map(c => `- ${c.cos_name}(${c.cos_brand}, ${c.cos_type})`).join("\n");
            } else {
                const [candidates] = await conn.query(
                    `SELECT cos_name, cos_brand, cos_type
                     FROM (
                         SELECT cos_name, cos_brand, cos_type,
                                ROW_NUMBER() OVER (PARTITION BY cos_type ORDER BY cos_no) AS rn
                         FROM cosmetics
                     ) ranked
                     WHERE rn <= 10`
                );
                candidatesText = candidates.map(c => `- ${c.cos_name}(${c.cos_brand}, ${c.cos_type})`).join("\n");
            }

            let total_score_change = 0;
            let compliance_rate = 0;

            if (day_count === 8) {
                const [prevAnalyses] = await conn.query(
                    "SELECT total_score FROM img_analyses a JOIN uploads u ON a.upload_no = u.upload_no WHERE u.user_no = ? ORDER BY a.created_at DESC LIMIT 2",
                    [user_no]
                );
                
                if (prevAnalyses.length === 2) {
                    // 최신 점수와 그 이전 점수의 차이 계산
                    total_score_change = Number((prevAnalyses[0].total_score - prevAnalyses[1].total_score).toFixed(1));
                }
                
                const rates = await getCumulativeRate(user_no, chal_no);
                compliance_rate = rates.cumulative_rate;
            }
                
            // FastAPI 호출
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
            }, { headers: { 'x-internal-key': INTERNAL_API_KEY }, timeout: 60000 });

            const routine = pythonRes.data.data.routine;
            if (!routine) throw new ValidationError("AI 루틴 생성에 실패했습니다.", 500);

            // DB 저장
            await saveRoutineToDB(user_no, chal_no, routine);

            // 조회 및 응답 구성 (source, action_no 포함)
            const routineSql = `
                SELECT r.routine_time, r.routine_order, c.cos_name, 
                       IFNULL(uc.source, '추천') AS source,
                       a.action_no,
                       CASE WHEN a.action_yn = 'Y' THEN true ELSE false END AS completed
                FROM challenge_details cd
                JOIN routines r ON cd.routine_no = r.routine_no
                JOIN cosmetics c ON r.cos_no = c.cos_no
                LEFT JOIN user_cosmetics uc ON uc.user_no = ? AND uc.cos_no = c.cos_no
                LEFT JOIN actions a ON cd.detail_no = a.detail_no AND a.user_no = ?
                WHERE cd.chal_no = ?
                ORDER BY r.routine_time, r.routine_order
            `;
            const [dbRows] = await conn.query(routineSql, [user_no, user_no, chal_no]);

            const finalGrouped = { morning: [], evening: [], special: [] };
            dbRows.forEach(row => {
                const aiItem = routine[row.routine_time]?.find(item => item.cos_name === row.cos_name);
                finalGrouped[row.routine_time].push({
                    order: row.routine_order,
                    name: row.cos_name,
                    source: row.source,
                    completed: row.completed,
                    action_no: row.action_no,
                    description: aiItem?.description || "",
                    recommend_reason: aiItem?.recommend_reason || null
                });
            });

            const finalRates = await getCumulativeRate(user_no, chal_no);
            res.json({
                status: "success",
                data: { day_count, cumulative_achievement_rate: finalRates.cumulative_rate, routine: finalGrouped }
            });

        } else {
            // 이미 생성된 기존 루틴 조회
            const routineSql = `
                SELECT a.action_no, c.cos_name AS name, r.routine_time, r.routine_order,
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
                    order: row.routine_order,
                    name: row.name,
                    completed: row.completed,
                    source: row.source,
                    action_no: row.action_no
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