/*
 * skinRouter — 피부 이미지 분석 라우터
 *
 * 역할:
 * - 업로드된 피부 이미지를 DB에 기록
 * - FastAPI로 분석 요청
 * - 분석 결과 이미지를 파일로 저장
 * - DB(img_analyses, daily_reports)에 결과 저장
 * - 최신 결과 / 히스토리 조회 API 제공
 */

const express = require('express');
const router = express.Router();

const conn = require('../config/database');
const { FASTAPI_URL } = require('../config/apiConfig');

const path = require('path');
const axios = require('axios');
const fs = require('fs').promises;

const { requireLogin } = require('../middleware/auth');
const { ValidationError } = require('../middleware/errorHandler');

const multer = require('multer');
const upload = require('../middleware/multerConfig');

// Node .env 에 저장된 FastAPI 내부 호출용 키
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';


// ==================================
// 파일 삭제 헬퍼
// ==================================
const deleteFile = async (filePath) => {
    if (!filePath) return;

    try {
        await fs.unlink(path.join(__dirname, '..', filePath));
    } catch (err) {
        if (err.code !== 'ENOENT') {
            console.error('[FILE DELETE ERROR]', err);
        }
    }
};


/*
    피부 분석
    POST /api/skin/analyze
*/
router.post('/analyze', requireLogin, upload.single('skin_img'), async (req, res, next) => {
    let uploadedPath = req.file ? `uploads/${req.file.filename}` : null;
    let processedPath = null;

    try {
        if (!req.file) {
            throw new ValidationError('이미지 파일을 업로드해주세요.');
        }

        const user_no = req.user.user_no;
        const today = new Date().toISOString().slice(0, 10);

        // 오늘 기존 업로드 확인
        const [existing] = await conn.query(
            `SELECT u.upload_no, u.file_name, a.anls_no, a.processing_img
             FROM uploads u
             LEFT JOIN img_analyses a ON u.upload_no = a.upload_no
             WHERE u.user_no = ? AND DATE(u.uploaded_at) = CURDATE()
             LIMIT 1`,
            [user_no]
        );

        let upload_no;
        let existingAnlsNo = null;

        if (existing.length > 0) {
            const row = existing[0];

            await deleteFile(row.file_name);
            await deleteFile(row.processing_img);

            upload_no = row.upload_no;
            existingAnlsNo = row.anls_no;

            await conn.query(
                'UPDATE uploads SET file_name=?, file_size=?, uploaded_at=NOW() WHERE upload_no=?',
                [uploadedPath, req.file.size, upload_no]
            );
        } else {
            const [uploadRes] = await conn.query(
                'INSERT INTO uploads (user_no, file_name, file_size, file_ext, uploaded_at) VALUES (?, ?, ?, ?, NOW())',
                [user_no, uploadedPath, req.file.size, path.extname(req.file.originalname).toLowerCase()]
            );

            upload_no = uploadRes.insertId;
        }

        // FastAPI 분석 요청
        const absFilePath = path.resolve(__dirname, '..', uploadedPath);

        const response = await axios.post(
            `${FASTAPI_URL}/api/skin/analyze`,
            { upload_no, file_path: absFilePath },
            {
                headers: { 'x-internal-key': INTERNAL_API_KEY },
                timeout: 60000
            }
        );

        if (response.data?.status !== 'success') {
            throw new Error('FastAPI 분석 실패');
        }

        const aiData = response.data.data;
        const total_score = aiData.total_score || 0;

        // 결과 이미지 저장 (Base64 -> 파일)
        processedPath = `uploads/processed_${upload_no}.jpg`;
        await fs.writeFile(
            path.join(__dirname, '..', processedPath),
            Buffer.from(aiData.processed_image_base64, 'base64')
        );

        // ==================================
        // DB 저장용 데이터 분리
        // - processed_image_base64는 파일로 이미 저장했으므로
        //   DB JSON(anls_result)에는 넣지 않음
        // ==================================
        const { processed_image_base64, ...dbAiData } = aiData;

        // DB 결과 저장
        let anls_no;

        if (existingAnlsNo !== null) {
            await conn.query(
                `UPDATE img_analyses
                 SET anls_result=?, acne_score=?, pore_score=?, total_score=?, processing_img=?, created_at=NOW()
                 WHERE anls_no=?`,
                [
                    JSON.stringify(dbAiData),
                    aiData.acne_score || 0,
                    aiData.pore_score || 0,
                    total_score,
                    processedPath,
                    existingAnlsNo
                ]
            );

            anls_no = existingAnlsNo;

            await conn.query('DELETE FROM daily_reports WHERE anls_no=?', [existingAnlsNo]);
        } else {
            const [analysisRes] = await conn.query(
                `INSERT INTO img_analyses
                (upload_no, model_name, anls_result, acne_score, pore_score, total_score, processing_img, created_at)
                VALUES (?, 'YOLO_2MODELS', ?, ?, ?, ?, ?, NOW())`,
                [
                    upload_no,
                    JSON.stringify(dbAiData),
                    aiData.acne_score || 0,
                    aiData.pore_score || 0,
                    total_score,
                    processedPath
                ]
            );

            anls_no = analysisRes.insertId;
        }

        // 분석 직후 daily_reports 생성
        const [chal] = await conn.query(
            "SELECT chal_no FROM challenges WHERE user_no = ? AND chal_status = '진행중' LIMIT 1",
            [user_no]
        );

        if (chal.length > 0) {
            const [prevScore] = await conn.query(
                `SELECT a.total_score
                 FROM img_analyses a
                 JOIN uploads u ON a.upload_no = u.upload_no
                 WHERE u.user_no = ? AND DATE(u.uploaded_at) < CURDATE()
                 ORDER BY a.created_at DESC LIMIT 1`,
                [user_no]
            );

            const prev_total_score = prevScore[0]?.total_score || 0;

            const commentRes = await axios.post(
                `${FASTAPI_URL}/api/report/comment`,
                {
                    skin_type: req.user.skin_type || "정보 없음",
                    total_score,
                    prev_total_score: Number(prev_total_score)
                },
                {
                    headers: { 'x-internal-key': INTERNAL_API_KEY },
                    timeout: 8000
                }
            );

            const line_comment = commentRes.data.data.line_comment;

            await conn.query(
                `INSERT INTO daily_reports
                (user_no, chal_no, anls_no, line_comment, overall_score,  created_at)
                VALUES (?, ?, ?, ?, ?, NOW())`,
                [
                    user_no,
                    chal[0].chal_no,
                    anls_no,
                    line_comment,
                    total_score
                ]
            );
        }

        // 프론트 응답에는 image_url만 주고,
        // 큰 base64 문자열은 굳이 다시 내리지 않음
        res.json({
            status: 'success',
            data: {
                analysis_id: anls_no,
                acne_score: aiData.acne_score,
                pore_score: aiData.pore_score,
                total_score: total_score,
                detections: aiData.detections,
                raw_data: aiData.raw_data || {},
                image_url: `/${processedPath}`
            }
        });

    } catch (error) {
        if (uploadedPath) await deleteFile(uploadedPath);
        if (processedPath) await deleteFile(processedPath);
        next(error);
    }
});


/*
    분석 결과 조회 (최신 1건)
    GET /api/skin/result
*/
router.get('/result', requireLogin, async (req, res, next) => {
    try {
        const [results] = await conn.query(
            `SELECT a.* FROM img_analyses a
             JOIN uploads u ON a.upload_no = u.upload_no
             WHERE u.user_no = ?
             ORDER BY a.created_at DESC LIMIT 1`,
            [req.user.user_no]
        );

        if (results.length === 0) {
            throw new ValidationError('분석 결과가 없습니다.', 404);
        }

        const row = results[0];
        const parsed = JSON.parse(row.anls_result || '{}');

        res.json({
            status: 'success',
            data: {
                analysis_id: row.anls_no,
                acne_score: row.acne_score,
                pore_score: row.pore_score,
                total_score: row.total_score,
                image_url: row.processing_img ? `/${row.processing_img}` : null,
                detections: parsed.detections || {},
                raw_data: parsed.raw_data || {},
                created_at: row.created_at
            }
        });
    } catch (error) {
        next(error);
    }
});


/*
    분석 기록 목록 조회 (날짜별)
    GET /api/skin/history
*/
router.get('/history', requireLogin, async (req, res, next) => {
    try {
        const [results] = await conn.query(
            `SELECT a.anls_no AS analysis_id,
                    DATE_FORMAT(u.uploaded_at, '%Y-%m-%d') AS date,
                    a.acne_score,
                    a.pore_score,
                    a.total_score
             FROM img_analyses a
             JOIN uploads u ON a.upload_no = u.upload_no
             WHERE u.user_no = ?
             ORDER BY u.uploaded_at DESC`,
            [req.user.user_no]
        );

        if (results.length === 0) {
            throw new ValidationError('분석 기록이 없습니다.', 404);
        }

        res.json({ status: 'success', data: results });
    } catch (error) {
        next(error);
    }
});

module.exports = router;