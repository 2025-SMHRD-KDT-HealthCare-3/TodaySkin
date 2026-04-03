/*
 * challengeRouter — 챌린지 관리
 - POST  /api/challenge            챌린지 생성 (기존 진행 중 자동 중단)
 - GET   /api/challenge            현재 챌린지 조회 (종료일 지나면 자동 완료)
 - PATCH /api/challenge/stop       챌린지 수동 종료
 - GET   /api/challenge/history    지난 챌린지 기록 조회
 - GET   /api/challenge/:chal_no   특정 챌린지 상세 + 달성률
*/

const express = require('express');
const router = express.Router();
const conn = require('../config/database');
const { requireLogin } = require('../middleware/auth');
const { ValidationError } = require('../middleware/errorHandler');


/*
    챌린지 생성 
    (POST /api/challenge)
    기존 진행 중인 챌린지 자동 중단 후 신규 생성
*/
router.post('/', requireLogin, async (req, res, next) => {
    try {
        const { chal_type , chal_name} = req.body;
        const user_no = req.user.user_no;

        if (!chal_type || ![7, 14].includes(Number(chal_type))) {
            throw new ValidationError("챌린지 기간은 7일 또는 14일만 선택 가능합니다.");
        }
  
        if (!chal_name || !chal_name.trim()) {
        throw new ValidationError("챌린지 목표를 입력해주세요.");
        }
        
        // 진행 중인 챌린지 조회
        const [activeChals] = await conn.query(
            "SELECT chal_no FROM challenges WHERE user_no = ? AND chal_status = '진행중' LIMIT 1",
            [user_no]
        );

        const prevChal = activeChals.length > 0 ? activeChals[0] : null;

        // 새 챌린지 시작 시 이전 것은 '중단' 처리
        if (prevChal) {
            await conn.query(
                "UPDATE challenges SET chal_status = '중단' WHERE chal_no = ?",
                [prevChal.chal_no]
            );
        }

        // [신규 챌린지 계산]
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + Number(chal_type) - 1);

        const formatDate = (d) => d.toISOString().slice(0, 10);
    
        const [result] = await conn.query(
            "INSERT INTO challenges (user_no, chal_name, start_date, end_date, chal_type, chal_status, created_at) VALUES (?, ?, ?, ?, ?, '진행중', NOW())",
            [user_no, chal_name, formatDate(startDate), formatDate(endDate), chal_type]
        );

        return res.status(201).json({
            status: "success",
            data: {
                new_challenge: {
                    chal_no: result.insertId,
                    chal_name: chal_name.trim(),
                    chal_type: Number(chal_type),
                    start_date: formatDate(startDate),
                    end_date: formatDate(endDate),
                    chal_status: "진행중"
                },
                message: prevChal 
                    ? "새로운 챌린지가 시작되었습니다! 이전 기록은 자동으로 중단되었습니다." 
                    : "새로운 챌린지가 시작되었습니다!"
            }
        });

    } catch (error) {
        next(error);
    }
});


/*
   - 현재 진행 중인 챌린지 조회 
   - (GET /api/challenge)
   - [중요] 조회 시 종료일이 지났으면 자동으로 '완료' 처리
*/
router.get('/', requireLogin, async (req, res, next) => {
    try {
        const user_no = req.user.user_no;
        const today = new Date().toISOString().slice(0, 10);

        // 진행중인 최신 챌린지 1개 조회
        const [results] = await conn.query(`
            SELECT chal_no, chal_type, start_date, end_date, chal_status,
                DATEDIFF(?, start_date) + 1 AS day_count
            FROM challenges
            WHERE user_no = ? AND chal_status = '진행중'
            ORDER BY created_at DESC LIMIT 1
        `, [today, user_no]);

        if (results.length === 0) {
            return res.json({ status: "success", data: null, message: "진행 중인 챌린지가 없습니다." });
        }

        const challenge = results[0];
        const endDateStr = new Date(challenge.end_date).toISOString().slice(0, 10);

        // 오늘 날짜가 종료일을 넘었는지 확인
        if (today > endDateStr) {
            await conn.query(
                "UPDATE challenges SET chal_status = '완료' WHERE chal_no = ?",
                [challenge.chal_no]
            );
            
            return res.json({
                status: "success",
                data: { ...challenge, chal_status: '완료' },
                message: "챌린지 기간이 종료되어 자동으로 '완료' 처리되었습니다."
            });
        }

        return res.json({ status: "success", data: challenge });

    } catch (error) {
        next(error);
    }
});


/*
    챌린지 수동 종료
    (PATCH /api/challenge/stop)
*/
router.patch('/stop', requireLogin, async (req, res, next) => {
    try {
        const [result] = await conn.query(
            "UPDATE challenges SET chal_status = '중단' WHERE user_no = ? AND chal_status = '진행중'",
            [req.user.user_no]
        );

        if (result.affectedRows === 0) throw new ValidationError("진행 중인 챌린지가 없습니다.", 404);

        return res.json({ status: "success", data: { message: "챌린지를 중단하였습니다." } });
    } catch (error) {
        next(error);
    }
});


/*
    지난 챌린지 기록 조회 
    (GET /api/challenge/history)
*/
router.get('/history', requireLogin, async (req, res, next) => {
    try {
        const [results] = await conn.query(`
            SELECT chal_no, chal_type, start_date, end_date, chal_status
            FROM challenges
            WHERE user_no = ? AND chal_status IN ('완료', '중단')
            ORDER BY created_at DESC
        `, [req.user.user_no]);

        return res.json({ status: "success", data: results });
    } catch (error) {
        next(error);
    }
});


/*
    특정 챌린지 상세 및 달성률 조회 
    (GET /api/challenge/:chal_no)
*/
router.get('/:chal_no', requireLogin, async (req, res, next) => {
    try {
        const { chal_no } = req.params;
        if (isNaN(chal_no)) throw new ValidationError("올바른 번호를 입력해주세요.");

        const [results] = await conn.query(`
            SELECT 
                c.*,
                IFNULL(ROUND(SUM(CASE WHEN a.action_yn = 'Y' THEN 1 ELSE 0 END) / NULLIF(COUNT(a.action_no), 0) * 100, 1), 0) AS cumulative_rate
            FROM challenges c
            LEFT JOIN challenge_details cd ON c.chal_no = cd.chal_no
            LEFT JOIN actions a ON cd.detail_no = a.detail_no
            WHERE c.chal_no = ? AND c.user_no = ?
            GROUP BY c.chal_no
        `, [chal_no, req.user.user_no]);

        if (results.length === 0) throw new ValidationError("정보를 찾을 수 없습니다.", 404);

        return res.json({ status: "success", data: results[0] });
    } catch (error) {
        next(error);
    }
});

module.exports = router;