// 2.Backend_node/routes/skinRouter.js

const express = require('express');
const router = express.Router();
const conn = require('../config/database');
const multer = require('multer');
const path = require('path');
const axios = require('axios');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const FASTAPI_URL = process.env.FASTAPI_URL || 'http://localhost:8000';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

// ============================================================
// 커스텀 에러 클래스
// ============================================================

class ValidationError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = statusCode;
    }
}

// ============================================================
// 공통 에러 핸들러
// ============================================================

const handleError = (res, error) => {
    if (error instanceof ValidationError) {
        return res.status(error.statusCode).json({
            status: 'error',
            message: error.message
        });
    }

    console.error('[SERVER ERROR]', error);
    return res.status(500).json({
        status: 'error',
        message: '서버 오류'
    });
};

// ============================================================
// JWT 인증 미들웨어
// ============================================================

const requireLogin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            status: 'error',
            message: '로그인이 필요합니다.'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            status: 'error',
            message: '유효하지 않거나 만료된 토큰입니다.'
        });
    }
};

// ============================================================
// multer 설정
// ============================================================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '_' + req.user.user_no;
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// ============================================================
// 파일 물리적 삭제 헬퍼
// ============================================================

const deleteFile = (filePath) => {
    if (!filePath) return;

    const fullPath = path.join(__dirname, '..', filePath);
    fs.unlink(fullPath, (err) => {
        if (err && err.code !== 'ENOENT') {
            console.error('[FILE DELETE ERROR]', fullPath, err);
        }
    });
};

// ============================================================
// FastAPI 분석 요청 헬퍼 (path 방식 — 절대경로를 JSON으로 전송)
// ============================================================

const requestSkinAnalysis = async (upload_no, abs_file_path) => {
    const response = await axios.post(
        `${FASTAPI_URL}/internal/skin/analyze`,
        {
            upload_no,
            file_path: abs_file_path
        },
        {
            headers: {
                'Content-Type': 'application/json',
                'x-internal-key': INTERNAL_API_KEY
            },
            timeout: 60000
        }
    );

    if (!response.data || response.data.status !== 'success') {
        throw new ValidationError(
            response.data?.message || 'FastAPI 분석 실패',
            500
        );
    }

    return response.data.data;
};

// ============================================================
// 이미지 업로드 및 피부 분석
// POST /api/skin/analyze
// - 동일 날짜 재업로드 시 기존 파일 및 DB 레코드 삭제 후 저장
// ============================================================

router.post('/analyze', requireLogin, upload.single('skin_img'), async (req, res) => {
    try {
        if (!req.file) {
            throw new ValidationError('이미지 파일을 업로드해주세요.');
        }

        const user_no = req.user.user_no;
        const file_name = `uploads/${req.file.filename}`;
        const file_size = req.file.size;
        const file_ext = path.extname(req.file.originalname).toLowerCase();

        const allowed = ['.jpg', '.jpeg', '.png'];
        if (!allowed.includes(file_ext)) {
            deleteFile(file_name);
            throw new ValidationError('지원하지 않는 파일 형식입니다.');
        }

        const today = new Date().toISOString().slice(0, 10);

        const checkSql = `
            SELECT u.upload_no, u.file_name, a.anls_no, a.processing_img
            FROM uploads u
            LEFT JOIN img_analyses a ON u.upload_no = a.upload_no
            WHERE u.user_no = ? AND DATE(u.uploaded_at) = ?
        `;

        conn.query(checkSql, [user_no, today], (err, existing) => {
            if (err) return handleError(res, err);

            const insertUpload = () => {
                const sql = `
                    INSERT INTO uploads (user_no, file_name, file_size, file_ext, uploaded_at)
                    VALUES (?, ?, ?, ?, NOW())
                `;

                conn.query(sql, [user_no, file_name, file_size, file_ext], async (err, result) => {
                    if (err) return handleError(res, err);

                    const upload_no = result.insertId;

                    try {
                        const absFilePath = path.resolve(__dirname, '..', file_name);
                        const aiData = await requestSkinAnalysis(upload_no, absFilePath);

                        const {
                            acne_score,
                            pore_score,
                            total_score,
                            processed_image_base64,
                            detections
                        } = aiData;

                        const processingImgName = `uploads/processed_${upload_no}.jpg`;
                        const processingImgPath = path.join(__dirname, '..', processingImgName);

                        fs.writeFileSync(
                            processingImgPath,
                            Buffer.from(processed_image_base64, 'base64')
                        );

                        const analysisSql = `
                            INSERT INTO img_analyses
                                (upload_no, model_name, anls_result, acne_score, pore_score, total_score, processing_img, created_at)
                            VALUES (?, 'YOLO', ?, ?, ?, ?, ?, NOW())
                        `;

                        conn.query(
                            analysisSql,
                            [
                                upload_no,
                                JSON.stringify(aiData),
                                acne_score,
                                pore_score,
                                total_score,
                                processingImgName
                            ],
                            (err2, anlsResult) => {
                                if (err2) {
                                    conn.query('DELETE FROM uploads WHERE upload_no = ?', [upload_no], () => {});
                                    deleteFile(file_name);
                                    deleteFile(processingImgName);
                                    return handleError(res, err2);
                                }

                                return res.json({
                                    status: 'success',
                                    data: {
                                        analysis_id: anlsResult.insertId,
                                        acne_score,
                                        pore_score,
                                        total_score,
                                        detections,
                                        image_url: `/${processingImgName}`
                                    }
                                });
                            }
                        );
                    } catch (error) {
                        console.error('[FASTAPI ERROR]', error.response?.data || error.message);
                        conn.query('DELETE FROM uploads WHERE upload_no = ?', [upload_no], () => {});
                        deleteFile(file_name);
                        return handleError(res, new ValidationError('분석 중 오류가 발생했습니다.', 500));
                    }
                });
            };

            if (existing.length > 0) {
                existing.forEach((row) => {
                    deleteFile(row.file_name);
                    deleteFile(row.processing_img);
                });

                const existUploadNos = existing.map((r) => r.upload_no);

                conn.query('DELETE FROM img_analyses WHERE upload_no IN (?)', [existUploadNos], (err) => {
                    if (err) return handleError(res, err);

                    conn.query('DELETE FROM uploads WHERE upload_no IN (?)', [existUploadNos], (err) => {
                        if (err) return handleError(res, err);
                        insertUpload();
                    });
                });
            } else {
                insertUpload();
            }
        });
    } catch (error) {
        if (req.file) {
            deleteFile(`uploads/${req.file.filename}`);
        }
        return handleError(res, error);
    }
});

router.get('/result', requireLogin, (req, res) => {
    const sql = `
        SELECT
            a.anls_no AS analysis_id,
            a.acne_score,
            a.pore_score,
            a.total_score,
            a.processing_img AS image_url,
            a.anls_result,
            a.created_at
        FROM img_analyses a
        JOIN uploads u ON a.upload_no = u.upload_no
        WHERE u.user_no = ?
        ORDER BY a.created_at DESC
        LIMIT 1
    `;

    conn.query(sql, [req.user.user_no], (err, results) => {
        if (err) return handleError(res, err);

        if (results.length === 0) {
            return handleError(res, new ValidationError('분석 결과가 존재하지 않습니다.', 404));
        }

        const row = results[0];
        let detections = null;

        try {
            const parsed = row.anls_result ? JSON.parse(row.anls_result) : null;
            detections = parsed?.detections || null;
        } catch (e) {
            detections = null;
        }

        return res.json({
            status: 'success',
            data: {
                analysis_id: row.analysis_id,
                acne_score: row.acne_score,
                pore_score: row.pore_score,
                total_score: row.total_score,
                image_url: row.image_url
                    ? (row.image_url.startsWith('/') ? row.image_url : `/${row.image_url}`)
                    : null,
                detections,
                created_at: row.created_at
            }
        });
    });
});

router.get('/history', requireLogin, (req, res) => {
    const sql = `
        SELECT
            a.anls_no AS analysis_id,
            DATE(u.uploaded_at) AS date,
            a.total_score
        FROM img_analyses a
        JOIN uploads u ON a.upload_no = u.upload_no
        WHERE u.user_no = ?
        ORDER BY u.uploaded_at DESC
    `;

    conn.query(sql, [req.user.user_no], (err, results) => {
        if (err) return handleError(res, err);

        if (results.length === 0) {
            return handleError(res, new ValidationError('분석 기록이 존재하지 않습니다.', 404));
        }

        return res.json({
            status: 'success',
            data: results
        });
    });
});

module.exports = router;