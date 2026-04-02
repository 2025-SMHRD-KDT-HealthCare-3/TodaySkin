/*
 * multerConfig — 파일 업로드 설정
 - 저장 위치: uploads/ 폴더
 - 파일명: 타임스탬프_유저번호.확장자 (예: 1775123456_1.jpg)
 - 제한: 10MB, jpg/jpeg/png만 허용
*/

const multer = require('multer');
const path = require('path');

/* 저장 경로 및 파일명 생성 규칙 */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '_' + req.user.user_no;
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

/* 업로드 미들웨어 (용량 제한 + 확장자 검사) */
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },  // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
            return cb(new Error('jpg, jpeg, png 파일만 업로드 가능합니다.'));
        }
        cb(null, true);
    }
});

module.exports = upload;