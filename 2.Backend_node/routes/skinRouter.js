const express = require('express');
const router = express.Router();
const conn = require('../config/database');
const path = require('path');
const axios = require('axios');
const fs = require('fs').promises;
const { requireLogin } = require('../middleware/auth');
const { ValidationError } = require('../middleware/errorHandler'); 
const multer = require('multer');

const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

const upload = multer({ 
    dest: 'uploads/', // 프로젝트 루트에 'uploads' 폴더가 있어야 합니다.
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB 제한 (선택사항)
});

// 파일 삭제 헬퍼

const deleteFile = async (filePath) => {
    if (!filePath) return;
    try {
        await fs.unlink(path.join(__dirname, '..', filePath));
    } catch (err) {
        if (err.code !== 'ENOENT') console.error('[FILE DELETE ERROR]', err);
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
        if (!req.file) throw new ValidationError('이미지 파일을 업로드해주세요.');

        const { user_no } = req.user;
        const today = new Date().toISOString().slice(0, 10);

        // 1. 오늘 기존 데이터 및 파일 삭제 (동일 날짜 재업로드 처리)
        const [existing] = await conn.query(
            `SELECT u.upload_no, u.file_name, a.processing_img
             FROM uploads u LEFT JOIN img_analyses a ON u.upload_no = a.upload_no
             WHERE u.user_no = ? AND DATE(u.uploaded_at) = ?`,
            [user_no, today]
        );

        for (const row of existing) {
            await deleteFile(row.file_name);
            await deleteFile(row.processing_img);
            await conn.query('DELETE FROM img_analyses WHERE upload_no = ?', [row.upload_no]);
            await conn.query('DELETE FROM uploads WHERE upload_no = ?', [row.upload_no]);
        }

        // 2. 새 업로드 정보 저장
        const [uploadRes] = await conn.query(
            'INSERT INTO uploads (user_no, file_name, file_size, file_ext, uploaded_at) VALUES (?, ?, ?, ?, NOW())',
            [user_no, uploadedPath, req.file.size, path.extname(req.file.originalname).toLowerCase()]
        );
        const upload_no = uploadRes.insertId;

        // 3. FastAPI 분석 요청
        const absFilePath = path.resolve(__dirname, '..', uploadedPath);
        const response = await axios.post(
            `${FASTAPI_URL}/internal/skin/analyze`,
            { upload_no, file_path: absFilePath },
            { headers: { 'x-internal-key': INTERNAL_API_KEY }, timeout: 60000 }
        );

        if (response.data?.status !== 'success') throw new Error('FastAPI 분석 실패');
        const aiData = response.data.data;

        // 4. 결과 이미지 저장 (Base64 → File)
        processedPath = `uploads/processed_${upload_no}.jpg`;
        await fs.writeFile(
            path.join(__dirname, '..', processedPath),
            Buffer.from(aiData.processed_image_base64, 'base64')
        );

        // 5. DB 결과 저장 
        const [analysisRes] = await conn.query(
            `INSERT INTO img_analyses
            (upload_no, model_name, anls_result, acne_score, pore_score, total_score, processing_img, created_at)
            VALUES (?, 'YOLO', ?, ?, ?, ?, ?, NOW())`,
            [upload_no, JSON.stringify(aiData), aiData.acne_score, aiData.pore_score, aiData.wrinkle_score || 0, processedPath]
        );

        res.json({
            status: 'success',
            data: {
                analysis_id: analysisRes.insertId,
                acne_score: aiData.acne_score,
                pore_score: aiData.pore_score,
                wrinkle_score: aiData.wrinkle_score || 0,
                detections: aiData.detections,
                image_url: `/${processedPath}`
            }
        });

    } catch (error) {
        // 에러 시 업로드된 파일 롤백
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

        if (results.length === 0) throw new ValidationError('분석 결과가 없습니다.', 404);

        const row = results[0];
        res.json({
            status: 'success',
            data: {
                analysis_id: row.anls_no,
                acne_score: row.acne_score,
                pore_score: row.pore_score,
                wrinkle_score: row.wrinkle_score,
                image_url: row.processing_img ? `/${row.processing_img}` : null,
                detections: JSON.parse(row.anls_result || '{}').detections || [],
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
                    DATE(u.uploaded_at) AS date,
                    a.acne_score,
                    a.pore_score,
                    a.wrinkle_score,
                    ROUND((a.acne_score + a.pore_score + a.wrinkle_score) / 3, 1) AS total_score
             FROM img_analyses a
             JOIN uploads u ON a.upload_no = u.upload_no
             WHERE u.user_no = ?
             ORDER BY u.uploaded_at DESC`,
            [req.user.user_no]
        );

        if (results.length === 0) throw new ValidationError('분석 기록이 없습니다.', 404);

        res.json({ status: 'success', data: results });
    } catch (error) {
        next(error);
    }
});

module.exports = router;