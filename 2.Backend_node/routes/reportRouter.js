const express = require('express');
const router = express.Router();
const axios = require('axios');
const conn = require('../config/database');
const { requireLogin } = require('../middleware/auth');
const { ValidationError } = require('../middleware/errorHandler');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';

/*
    데일리 리포트 조회 
   (GET /api/reports/daily)
*/
router.get('/daily', requireLogin, async (req, res, next) => {
    try {
        const user_no = req.user.user_no;
        const today = new Date().toISOString().slice(0, 10);

        // 진행 중인 챌린지 조회
        const [chalResults] = await conn.query(
            "SELECT chal_no, DATEDIFF(NOW(), start_date) + 1 AS day_count FROM challenges WHERE user_no = ? AND chal_status = '진행중' ORDER BY created_at DESC LIMIT 1",
            [user_no]
        );

        if (chalResults.length === 0) {
            throw new ValidationError("진행 중인 챌린지가 없습니다.", 404);
        }

        const { chal_no, day_count } = chalResults[0];

        // 오늘 분석 데이터 확인
        const [todayResults] = await conn.query(`
            SELECT a.acne_score, a.pore_score, a.wrinkle_score,
                ROUND((a.acne_score + a.pore_score + a.wrinkle_score) / 3, 1) AS total_score,
                DATE(u.uploaded_at) AS report_date
            FROM img_analyses a
            JOIN uploads u ON a.upload_no = u.upload_no
            WHERE u.user_no = ? AND DATE(u.uploaded_at) = ?
            ORDER BY a.created_at DESC LIMIT 1
        `, [user_no, today]);

        const has_today_analysis = todayResults.length > 0;

        // 달성률 계산
        const [rateResults] = await conn.query(`
            SELECT
                ROUND(SUM(CASE WHEN a.action_yn = 'Y' AND DATE(a.created_at) = ? THEN 1 ELSE 0 END)
                / NULLIF(SUM(CASE WHEN DATE(a.created_at) = ? THEN 1 ELSE 0 END), 0) * 100, 1) AS daily_rate,
                ROUND(SUM(CASE WHEN a.action_yn = 'Y' THEN 1 ELSE 0 END)
                / NULLIF(COUNT(a.action_no), 0) * 100, 1) AS cumulative_rate
            FROM challenge_details cd
            JOIN actions a ON cd.detail_no = a.detail_no AND a.user_no = ?
            WHERE cd.chal_no = ?
        `, [today, today, user_no, chal_no]);

        const daily_rate = rateResults[0]?.daily_rate || 0;
        const cumulative_rate = rateResults[0]?.cumulative_rate || 0;

        if (has_today_analysis) {
            const analysis = todayResults[0];

            // 이전 분석 데이터 조회 
            const [prevResults] = await conn.query(`
                SELECT ROUND((a.acne_score + a.pore_score + a.wrinkle_score) / 3, 1) AS total_score
                FROM img_analyses a
                JOIN uploads u ON a.upload_no = u.upload_no
                WHERE u.user_no = ? AND DATE(u.uploaded_at) < ?
                ORDER BY a.created_at DESC LIMIT 1
            `, [user_no, today]);

            const prev_total_score = prevResults[0]?.total_score || 0.0;

            //  FastAPI 한줄 코멘트 요청 
            try {
                const commentRes = await axios.post(
                    `${FASTAPI_URL}/api/report/daily-comment`,
                    {
                        skin_type: req.user.skin_type || "정보 없음",
                        total_score: Number(analysis.total_score),
                        prev_total_score: Number(prev_total_score)
                    },
                    { timeout: 8000 }
                );

                if (commentRes.data && commentRes.data.status === 'success') {
                    const line_comment = commentRes.data.data.line_comment;

                    // 코멘트 DB 저장
                    await conn.query(`
                        INSERT INTO daily_reports (user_no, chal_no, anls_no, line_comment, overall_score, achievement_rate, created_at)
                        SELECT ?, ?, a.anls_no, ?, ?, ?, NOW()
                        FROM img_analyses a
                        JOIN uploads u ON a.upload_no = u.upload_no
                        WHERE u.user_no = ? AND DATE(u.uploaded_at) = ?
                        ORDER BY a.created_at DESC LIMIT 1
                    `, [user_no, chal_no, line_comment, analysis.total_score, cumulative_rate, user_no, today]);

                    return res.json({
                        status: "success",
                        data: {
                            has_today_analysis: true,
                            day_count,
                            total_score: analysis.total_score,
                            acne_score: analysis.acne_score,
                            pore_score: analysis.pore_score,
                            wrinkle_score: analysis.wrinkle_score,
                            line_comment,
                            daily_rate,
                            cumulative_rate,
                            report_date: today
                        }
                    });
                } else {
                    throw new Error("AI 서버 응답 형식 오류");
                }
            } catch (aiError) {
                console.error('[AI COMMENT ERROR]', aiError.message);
                return next(new Error("AI 코멘트 생성에 실패했습니다. AI 서버를 확인해주세요."));
            }
        }

        // 오늘 분석 없으면 최근 데이터 반환
        const [latestResults] = await conn.query(`
            SELECT a.acne_score, a.pore_score, a.wrinkle_score,
                ROUND((a.acne_score + a.pore_score + a.wrinkle_score) / 3, 1) AS total_score,
                DATE(u.uploaded_at) AS report_date
            FROM img_analyses a
            JOIN uploads u ON a.upload_no = u.upload_no
            WHERE u.user_no = ?
            ORDER BY a.created_at DESC LIMIT 1
        `, [user_no]);

        const latest = latestResults[0] || null;

        return res.json({
            status: "success",
            data: {
                has_today_analysis: false,
                day_count,
                total_score: latest?.total_score || null,
                report_date: latest?.report_date || null,
                line_comment: "오늘의 피부 상태를 기록해보세요!",
                daily_rate,
                cumulative_rate,
                message: "오늘의 피부 점수를 확인하려면 사진을 업로드해주세요."
            }
        });

    } catch (error) {
        next(error);
    }
});

/* 
   피부 변화 리포트 조회
  (GET /api/reports/challenge/:chal_no)
*/
router.get('/challenge/:chal_no', requireLogin, async (req, res, next) => {
    try {
        const { chal_no } = req.params;
        const user_no = req.user.user_no;

        if (isNaN(chal_no)) throw new ValidationError("올바른 챌린지 번호를 입력해주세요.");

        // 챌린지 시작일 조회
        const [chalResults] = await conn.query(
            "SELECT start_date FROM challenges WHERE chal_no = ? AND user_no = ?",
            [chal_no, user_no]
        );

        if (chalResults.length === 0) throw new ValidationError("챌린지 정보를 찾을 수 없습니다.", 404);
        const { start_date } = chalResults[0];

        // 첫날 vs 최신 이미지 및 점수 조회
        const query = `
            SELECT a.acne_score, a.pore_score, a.wrinkle_score,
                ROUND((a.acne_score + a.pore_score + a.wrinkle_score) / 3, 1) AS total_score,
                a.processing_img, a.created_at
            FROM img_analyses a
            JOIN uploads u ON a.upload_no = u.upload_no
            WHERE u.user_no = ? AND u.uploaded_at >= ?
        `;
        const [firstResults] = await conn.query(`${query} ORDER BY a.created_at ASC LIMIT 1`, [user_no, start_date]);
        const [latestResults] = await conn.query(`${query} ORDER BY a.created_at DESC LIMIT 1`, [user_no, start_date]);

        // 누적 달성률 계산 
        const [rateResults] = await conn.query(`
            SELECT
                ROUND(SUM(CASE WHEN a.action_yn = 'Y' THEN 1 ELSE 0 END)
                / NULLIF(COUNT(a.action_no), 0) * 100, 1) AS cumulative_rate
            FROM challenge_details cd
            JOIN actions a ON cd.detail_no = a.detail_no AND a.user_no = ?
            WHERE cd.chal_no = ?
        `, [user_no, chal_no]);

        const formatData = (data) => data ? { ...data, image_url: data.processing_img ? `/${data.processing_img}` : null } : null;

        res.json({
            status: "success",
            data: {
                chal_no: Number(chal_no),
                first_day: formatData(firstResults[0]),
                latest_day: formatData(latestResults[0]),
                cumulative_rate: rateResults[0]?.cumulative_rate || 0 
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;