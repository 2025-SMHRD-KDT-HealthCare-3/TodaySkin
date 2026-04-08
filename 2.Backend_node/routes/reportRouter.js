/*
 * reportRouter — 리포트 관리
 - GET /api/reports/daily              데일리 리포트 조회 (AI 코멘트 포함)
 - GET /api/reports/challenge/:chal_no 챌린지 피부 변화 리포트
*/

const express = require('express');
const router = express.Router();
const axios = require('axios');
const conn = require('../config/database');
const { FASTAPI_URL } = require('../config/apiConfig');
const { requireLogin } = require('../middleware/auth');
const { ValidationError } = require('../middleware/errorHandler');

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

/* 데일리 리포트 조회 
   (GET /api/reports/daily)
*/
router.get('/daily', requireLogin, async (req, res, next) => {
    try {
        const user_no = req.user.user_no;

        // 1. [날짜 보정] 서버가 UTC여도 무조건 한국 날짜 "YYYY-MM-DD" 생성
        const now = new Date();
        const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        const today = kstNow.toISOString().slice(0, 10);

        // 2. 진행 중인 챌린지 조회
        const [chalResults] = await conn.query(
            "SELECT chal_no, chal_name, DATEDIFF(NOW(), start_date) + 1 AS day_count FROM challenges WHERE user_no = ? AND chal_status = '진행중' ORDER BY created_at DESC LIMIT 1",
            [user_no]
        );

        if (chalResults.length === 0) {
            throw new ValidationError("진행 중인 챌린지가 없습니다.", 404);
        }
        const { chal_no, chal_name, day_count } = chalResults[0];

        // 3. 오늘 분석 데이터 확인
        const [todayResults] = await conn.query(`
            SELECT a.anls_no, a.acne_score, a.pore_score, a.total_score,
                DATE(u.uploaded_at) AS report_date
            FROM img_analyses a
            JOIN uploads u ON a.upload_no = u.upload_no
            WHERE u.user_no = ? AND DATE(u.uploaded_at) = ?
            ORDER BY a.created_at DESC LIMIT 1`, [user_no, today]);

        const has_today_analysis = todayResults.length > 0;

        // 4. 하단 그래프용 데이터 (JOIN 제거하여 데이터 누락 원천 차단)
        const [dailyRates] = await conn.query(`
           SELECT 
                /* 핵심: 날짜별로 예쁘게 묶기 위해 DATE() 사용 */
                DATE(routine_checked) AS date, 
                ROUND(SUM(CASE WHEN action_yn = 'Y' THEN 1 ELSE 0 END) / COUNT(*) * 100) AS rate
            FROM actions
            WHERE user_no = ? AND routine_checked IS NOT NULL
            GROUP BY DATE(routine_checked)  /* 여기도 DATE() 추가 */
            ORDER BY date ASC
        `, [user_no]);

        // 5. 상단 실시간 점수용 — source='보유' + morning/evening 기준 (routineRouter의 getCumulativeRate와 동일)
        const [todayStats] = await conn.query(`
            SELECT
                COUNT(a.action_no) AS total,
                SUM(CASE WHEN a.action_yn = 'Y' THEN 1 ELSE 0 END) AS done
            FROM actions a
            JOIN challenge_details cd ON a.detail_no = cd.detail_no
            JOIN routines r ON cd.routine_no = r.routine_no
            JOIN user_cosmetics uc ON r.cos_no = uc.cos_no AND uc.user_no = a.user_no
            WHERE a.user_no = ?
              AND cd.chal_no = ?
              AND DATE(a.routine_checked) = ?
              AND uc.source = '보유'
              AND r.routine_time IN ('morning', 'evening')
        `, [user_no, chal_no, today]);

        const total = Number(todayStats[0].total) || 0;
        const done = Number(todayStats[0].done) || 0;
        const daily_rate = total > 0 ? Math.round((done / total) * 100) : 0;

        const cumulative_rate = dailyRates.length > 0
            ? Math.round(dailyRates.reduce((acc, curr) => acc + curr.rate, 0) / dailyRates.length)
            : 0;

        // [서버 터미널 확인용 로그]
        // console.log(`[REPORT CHECK] 유저:${user_no} | 날짜:${today} | 달성률:${daily_rate}% (전체:${total}/완료:${done})`);

        // 6. AI 코멘트 로직
        let line_comment = "오늘의 피부 상태를 기록해보세요!";
        if (has_today_analysis) {
            const analysis = todayResults[0];
            const [existingReport] = await conn.query(`
                SELECT line_comment FROM daily_reports
                WHERE user_no = ? AND chal_no = ? AND DATE(created_at) = ?
                LIMIT 1
            `, [user_no, chal_no, today]);

            if (existingReport.length > 0) {
                line_comment = existingReport[0].line_comment;
            } else {
                try {
                    const [prevResults] = await conn.query(`
                        SELECT total_score FROM img_analyses a JOIN uploads u ON a.upload_no = u.upload_no
                        WHERE u.user_no = ? AND DATE(u.uploaded_at) < ?
                        ORDER BY a.created_at DESC LIMIT 1
                    `, [user_no, today]);
                    const prev_total_score = prevResults[0]?.total_score || 0.0;

                    const commentRes = await axios.post(`${FASTAPI_URL}/api/daily/comment`, {
                        skin_type: req.user.skin_type || "정보 없음",
                        total_score: Number(analysis.total_score),
                        prev_total_score: Number(prev_total_score)
                    }, { headers: { 'x-internal-key': INTERNAL_API_KEY }, timeout: 8000 });

                    if (commentRes.data?.status === 'success') {
                        line_comment = commentRes.data.data.line_comment;
                        await conn.query(`
                            INSERT INTO daily_reports (user_no, chal_no, anls_no, line_comment, overall_review, achievement_rate, created_at)
                            VALUES (?, ?, ?, ?, ?, ?, NOW())
                        `, [user_no, chal_no, analysis.anls_no, line_comment, "오늘의 분석 결과입니다.", daily_rate]);
                    }
                } catch (aiErr) {
                    console.error('[AI ERROR]', aiErr.message);
                }
            }
        }

        // 7. 최종 응답
        return res.json({
            status: "success",
            data: {
                has_today_analysis,
                day_count,
                chal_name,
                total_score: has_today_analysis ? todayResults[0].total_score : null,
                acne_score: has_today_analysis ? todayResults[0].acne_score : null,
                pore_score: has_today_analysis ? todayResults[0].pore_score : null,
                line_comment,
                daily_rate,
                cumulative_rate,
                report_date: today,
                daily_rates: dailyRates
            }
        });

    } catch (error) {
        console.error("[REPORT ERROR]", error);
        next(error);
    }
});

/* 피부 변화 리포트 조회 
   (GET /api/reports/challenge/:chal_no)
*/
router.get('/challenge/:chal_no', requireLogin, async (req, res, next) => {
    try {
        const { chal_no } = req.params;
        const user_no = req.user.user_no;

        // 1. 챌린지의 정확한 시작/종료일 가져오기
        const [chalResults] = await conn.query(
            "SELECT start_date, end_date FROM challenges WHERE chal_no = ? AND user_no = ?",
            [chal_no, user_no]
        );
        if (chalResults.length === 0) throw new ValidationError("챌린지 정보를 찾을 수 없습니다.", 404);

        const { start_date, end_date } = chalResults[0];

        // 2. 위 그래프 데이터 (이미지 분석 점수)
        // [수정] 챌린지 시작일(start_date)부터의 모든 데이터를 가져옵니다.
        // 날짜는 KST 변환해서 저장
        const scoreQuery = `
            SELECT
                DATE(a.created_at) AS date,
                a.total_score, a.acne_score, a.pore_score,
                u.file_name
            FROM img_analyses a
            JOIN uploads u ON a.upload_no = u.upload_no
            WHERE u.user_no = ?
              AND DATE(a.created_at) BETWEEN DATE(?) AND DATE(?)
            ORDER BY a.created_at ASC
        `;
        const [scores] = await conn.query(scoreQuery, [user_no, start_date, end_date]);

        // 3. 아래 그래프 데이터 (루틴 달성률)
        // [수정] DATE() 함수를 적용하여 오늘(4/8) 데이터까지 포함되도록 함
        const [dailyRates] = await conn.query(`
            SELECT 
                DATE(routine_checked) AS date, 
                ROUND(SUM(CASE WHEN action_yn = 'Y' THEN 1 ELSE 0 END) / COUNT(*) * 100) AS rate
            FROM actions 
            WHERE user_no = ? 
              AND DATE(routine_checked) BETWEEN DATE(?) AND DATE(?)
            GROUP BY DATE(routine_checked) 
            ORDER BY date ASC
        `, [user_no, start_date, end_date]);

        // 첫날과 마지막날 데이터 추출 (UI 표시용)
        const formatData = (data) => data ? { ...data, image_url: data.file_name ? `/${data.file_name}` : null } : null;

        res.json({
            status: "success",
            data: {
                chal_no: Number(chal_no),
                start_date,
                end_date,
                // 리스트가 있으면 첫 번째와 마지막 데이터 전달
                first_day: formatData(scores.length > 0 ? scores[0] : null),
                latest_day: formatData(scores.length > 0 ? scores[scores.length - 1] : null),
                daily_rates: dailyRates, // 아래 그래프용
                score_rates: scores      // 위 그래프용 (프론트에서 이 데이터를 쓰게 하세요)
            }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;