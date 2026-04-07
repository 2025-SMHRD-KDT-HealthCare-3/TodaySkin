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
            let cos_no = null;

            if (item.cos_name) {
                const [cosResult] = await conn.query("SELECT cos_no FROM cosmetics WHERE cos_name = ? LIMIT 1", [item.cos_name]);
                if (cosResult.length > 0) cos_no = cosResult[0].cos_no;
            }

            // DB에 없는 제품(cos_no null)이라도 description이 있으면 일단 저장 (루틴 개수 유지)
            if (time !== 'special' && !cos_no && !item.cos_name) continue;
            if (time === 'special' && !item.description) continue;

            if (cos_no) {
                const isWaterWash = (cos_no === 2486 || item.cos_name === '물 세안');
                const [checkOwned] = await conn.query("SELECT source FROM user_cosmetics WHERE user_no = ? AND cos_no = ?", [user_no, cos_no]);

                if (checkOwned.length === 0) {
                    await conn.query("INSERT INTO user_cosmetics (user_no, cos_no, source) VALUES (?, ?, ?)",
                        [user_no, cos_no, isWaterWash ? '보유' : '추천']);
                } else if (isWaterWash && checkOwned[0].source === '추천') {
                    // 이미 추천으로 되어있어도 물 세안이면 보유로 강제 업데이트
                    await conn.query("UPDATE user_cosmetics SET source = '보유' WHERE user_no = ? AND cos_no = ?", [user_no, cos_no]);
                }
            }

            const order = i + 1;
            const [routineRes] = await conn.query(
                "INSERT INTO routines (user_no, cos_no, routine_time, routine_order, description, recommend_reason) VALUES (?, ?, ?, ?, ?, ?)",
                [user_no, cos_no, time, order, item.description || null, item.recommend_reason || null]
            );

            const [detailRes] = await conn.query("INSERT INTO challenge_details (chal_no, routine_no) VALUES (?, ?)", [chal_no, routineRes.insertId]);
            await conn.query("INSERT INTO actions (user_no, detail_no, action_yn, created_at) VALUES (?, ?, 'N', NOW())", [user_no, detailRes.insertId]);
        }
    }
}

// 2. 달성률 계산 헬퍼
async function getCumulativeRate(user_no, chal_no) {
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
        AND uc.source = '보유'                    
        AND r.routine_time IN ('morning', 'evening') 
    `;
    const [results] = await conn.query(sql, [user_no, chal_no]);

    const total = Number(results[0].total_count) || 0;
    const done = Number(results[0].done_count) || 0;

    const calculated_rate = total > 0 ? Math.round((done / total) * 100) : 0;

    return {
        daily_rate: calculated_rate,
        cumulative_rate: calculated_rate,
        total: total,
        done: done
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

        // 오늘 이미 생성된 루틴이 있는지 확인
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
            // 오늘 이미 생성된 루틴 데이터가 있으면 먼저 삭제
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
                `SELECT c.cos_name, c.cos_type, c.cos_ingredient 
                    FROM user_cosmetics uc 
                    JOIN cosmetics c ON uc.cos_no = c.cos_no 
                    WHERE uc.user_no = ? AND uc.source = '보유'`,
                [user_no]
            );
            const userCosmeticsText = cosmetics.map(c => `${c.cos_name}(${c.cos_type})`).join(", ") || "없음";

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
                    total_score_change = Number((prevAnalyses[0].total_score - prevAnalyses[1].total_score).toFixed(1));
                }

                const rates = await getCumulativeRate(user_no, chal_no);
                compliance_rate = rates.cumulative_rate;
            }

            // FastAPI 호출
            const pythonRes = await axios.post(`${FASTAPI_URL}/api/routine/generate`, {
                user_no: Number(user_no),
                skin_type: req.user.skin_type || "지성",
                acne_score: Number(analysis[0]?.acne_score || 0),
                pore_score: Number(analysis[0]?.pore_score || 0),
                chal_type: Number(chal_type),
                week: day_count <= 7 ? 1 : 2,
                age: Number(req.user.age || 25),
                gender: req.user.gender || "M",
                total_score_change: total_score_change,
                compliance_rate: Number(compliance_rate),
                fixed_routines: "물 세안"
            }, { headers: { 'x-internal-key': INTERNAL_API_KEY }, timeout: 60000 });

            const routine = pythonRes.data.data.routine;
            if (!routine) throw new ValidationError("AI 루틴 생성에 실패했습니다.", 500);

            // DB 저장
            await saveRoutineToDB(user_no, chal_no, routine);

        } else {
            // --- [Day 2~7, 9~14] 기존 루틴 불러오기 & 복사 로직 ---
            if (existingCheck.length === 0) {
                // 오늘 날짜의 actions(체크박스)가 없으면 기존 루틴을 복사해서 오늘용으로 만듦
                await conn.query(`
                    INSERT INTO actions (user_no, detail_no, action_yn, created_at)
                    SELECT ?, detail_no, 'N', NOW()
                    FROM challenge_details
                    WHERE chal_no = ?
                `, [user_no, chal_no]);
            }
        }

        // 생성(1일차)이든 복사(2일차)이든, 오늘 날짜의 통합 데이터를 DB에서 꺼내서 응답함
        const routineSql = `
            SELECT r.routine_time, r.routine_order, c.cos_name, 
                r.description, r.recommend_reason,
                IFNULL(uc.source, '추천') AS source,
                a.action_no,
                CASE WHEN a.action_yn = 'Y' THEN true ELSE false END AS completed
            FROM challenge_details cd
            JOIN routines r ON cd.routine_no = r.routine_no
            LEFT JOIN cosmetics c ON r.cos_no = c.cos_no 
            LEFT JOIN user_cosmetics uc ON uc.user_no = ? AND uc.cos_no = c.cos_no
            LEFT JOIN actions a ON cd.detail_no = a.detail_no AND a.user_no = ?
            WHERE cd.chal_no = ? AND DATE(a.created_at) = CURDATE()
            ORDER BY r.routine_time, r.routine_order
        `;
        const [dbRows] = await conn.query(routineSql, [user_no, user_no, chal_no]);

        const finalGrouped = { morning: [], evening: [], special: [] };

        dbRows.forEach(row => {
            if (!finalGrouped[row.routine_time]) return;

            finalGrouped[row.routine_time].push({
                order: row.routine_order,
                // 스페셜이면 내용을 이름으로, 아니면 화장품 이름을 출력
                name: row.routine_time === 'special'
                    ? (row.description || "스페셜 관리 가이드")
                    : (row.cos_name || "추천 제품"),
                source: row.source || (row.routine_time === 'special' ? "정보" : "추천"),
                completed: row.completed === 1 || row.completed === true,
                action_no: row.action_no,
                description: row.description || "",
                recommend_reason: row.recommend_reason || ""
            });
        });

        const finalRates = await getCumulativeRate(user_no, chal_no);
        res.json({
            status: "success",
            data: { day_count, cumulative_achievement_rate: finalRates.cumulative_rate, routine: finalGrouped }
        });

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

        res.json({
            status: "success",
            message: "상태 변경 완료",
            cumulative_achievement_rate: rates.cumulative_rate,
            daily_rate: rates.daily_rate
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;