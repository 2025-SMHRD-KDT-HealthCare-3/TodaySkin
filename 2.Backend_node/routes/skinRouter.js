const express = require('express');
const router = express.Router();
const conn = require('../config/database');
const multer = require('multer');
const path = require('path');
const axios = require('axios');

// 로그인 체크 미들웨어

const requireLogin = (req, res, next) => {
    if(!req.session.user_no){
        return res.status(401).json({ status : "error" , data: { message : "로그인이 필요합니다."}})
    }
    next();
}

// multer 설정

const storage = multer.diskStorage({
    destination : (req, file, cb) => {
        cb(null, 'uploads/');  // uploads 폴더에 저장
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '_' + req.session.user_no;
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
})

const upload = multer({ storage : storage});

// 사진 업로드 및 DB 기록 API
// POST/api/skin/upload

router.post('/upload', requireLogin, upload.single('skin_img'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            status: "error",
            data: { message: "사진이 전송되지 않았습니다." }
        });
    }

    const user_no = req.session.user_no;
    const file_name = `uploads/${req.file.filename}`;
    const file_size = req.file.size;
    const file_ext = path.extname(req.file.originalname).toLowerCase();

    // 🔒 파일 확장자 검사
    const allowed = ['.jpg', '.jpeg', '.png'];
    if (!allowed.includes(file_ext)) {
        return res.status(400).json({
            status: "error",
            data: { message: "지원하지 않는 파일 형식입니다." }
        });
    }

    // 1️⃣ uploads 저장
    const sql = `
        INSERT INTO uploads (user_no, file_name, file_size, file_ext, uploaded_at)
        VALUES (?, ?, ?, ?, NOW())
    `;

    conn.query(sql, [user_no, file_name, file_size, file_ext], async (err, result) => {
        if (err) {
            console.error('[UPLOAD DB ERROR]', err);
            return res.status(500).json({
                status: "error",
                data: { message: "업로드 기록 저장 실패" }
            });
        }

        const upload_no = result.insertId;

        try {
            // 2️⃣ Python 서버 요청
            const pythonRes = await axios.post('http://localhost:8000/predict', {
                upload_no,
                file_path: file_name
            });

            const { processing_img, acne_score } = pythonRes.data;

            // 3️⃣ 분석 결과 저장
            const analysisSql = `
                INSERT INTO img_analyses (upload_no, processing_img, acne_score, analysis_at)
                VALUES (?, ?, ?, NOW())
            `;

            conn.query(analysisSql, [upload_no, processing_img, acne_score], (err2) => {
                if (err2) {
                    console.error('[ANALYSIS DB ERROR]', err2);
                    return res.status(500).json({
                        status: "error",
                        data: { message: "분석 결과 저장 실패" }
                    });
                }

                return res.json({
                    status: "success",
                    data: {
                        message: "분석 완료!",
                        upload_no,
                        acne_score,
                        result_img: processing_img
                    }
                });
            });

        } catch (error) {
            console.error('[PYTHON SERVER ERROR]', error.message);

            // 🔥 롤백 처리 (핵심)
            conn.query("DELETE FROM uploads WHERE upload_no = ?", [upload_no]);

            const fs = require('fs');
            const path = require('path');
            const filePath = path.join(__dirname, '..', file_name);

            fs.unlink(filePath, (err) => {
                if (err && err.code !== 'ENOENT') {
                    console.error('[FILE DELETE ERROR]', err);
                }
            });

            return res.status(500).json({
                status: "error",
                data: { message: "AI 분석 서버 오류" }
            });
        }
    });
});



module.exports = router;