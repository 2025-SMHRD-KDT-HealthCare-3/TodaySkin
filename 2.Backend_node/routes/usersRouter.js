/*
 * usersRouter — 회원 관리
 - POST   /api/users/join     회원가입
 - POST   /api/users/login    로그인 (쿠키 방식)
 - POST   /api/users/logout   로그아웃
 - GET    /api/users/my       회원정보 조회
 - PUT    /api/users/my       회원정보 수정
 - DELETE /api/users/my       회원탈퇴
*/

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs').promises;
const path = require('path');
const conn = require('../config/database');
const { ValidationError } = require('../middleware/errorHandler');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';


/*
    회원가입
    POST /api/users/join
*/
router.post('/join', async (req, res, next) => {
    try {
        const { id, pwd, birthdate, gender, nick, skin_type } = req.body;

        if (!id || !pwd || !nick) throw new ValidationError("필수 정보를 입력해주세요.");

        const hashedPw = await bcrypt.hash(pwd, 10);
        const sql = `INSERT INTO users (id, pwd, birthdate, gender, nick, skin_type, joined_at) VALUES (?, ?, ?, ?, ?, ?, NOW())`;

        try {
            await conn.query(sql, [id, hashedPw, birthdate, gender, nick, skin_type]);
            res.status(201).json({ status: "success", data: { message: "회원가입 완료" } });
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') throw new ValidationError("중복된 아이디나 닉네임입니다.");
            throw err;
        }
    } catch (error) {
        next(error);
    }
});


/*
    로그인 (쿠키 방식)
    POST /api/users/login
*/
router.post('/login', async (req, res, next) => {
    try {
        const { id, pwd } = req.body;

        if (!id || !pwd) throw new ValidationError("아이디와 비밀번호를 입력해주세요.");

        const [results] = await conn.query("SELECT * FROM users WHERE id = ?", [id]);

        if (results.length === 0 || !(await bcrypt.compare(pwd, results[0].pwd))) {
            throw new ValidationError("아이디 또는 비밀번호가 틀렸습니다.", 401);
        }

        const user = results[0];

        // 생년월일 기반 나이 계산 (한국 나이 기준)
        const birthYear = new Date(user.birthdate).getFullYear();
        const currentYear = new Date().getFullYear();
        const age = currentYear - birthYear + 1;

        const token = jwt.sign(
            {
                user_no: user.user_no,
                nick: user.nick,
                skin_type: user.skin_type,
                gender: user.gender,
                age: age  // 
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // 쿠키에 저장
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', 
            sameSite: 'lax', 
            maxAge: 7 * 24 * 60 * 60 * 1000 
        });

        res.json({
            status: "success",
            data: { user_no: user.user_no, nick: user.nick }
        });
    } catch (error) {
        next(error);
    }
});


/*
    로그아웃
    POST /api/users/logout
*/
router.post('/logout', requireLogin, (req, res) => {
    res.clearCookie('token');
    res.json({ status: "success", data: { message: "로그아웃 완료" } });
});


/*
    회원정보 조회
    GET /api/users/my
*/
router.get('/my', requireLogin, async (req, res, next) => {
    try {
        const [results] = await conn.query(
            "SELECT id, nick, birthdate, gender, skin_type, joined_at FROM users WHERE user_no = ?",
            [req.user.user_no]
        );

        if (results.length === 0) throw new ValidationError("사용자를 찾을 수 없습니다.", 404);

        res.json({ status: "success", data: results[0] });
    } catch (error) {
        next(error);
    }
});


/*
    회원정보 수정
    PUT /api/users/my
*/
router.put('/my', requireLogin, async (req, res, next) => {
    try {
        const { pwd, nick, skin_type } = req.body;

        if (!pwd && !nick && !skin_type) throw new ValidationError("수정할 정보를 입력해주세요.");

        const fields = [];
        const values = [];

        if (pwd) {
            const hashedPw = await bcrypt.hash(pwd, 10);
            fields.push('pwd = ?');
            values.push(hashedPw);
        }
        if (nick) {
            fields.push('nick = ?');
            values.push(nick.trim());
        }
        if (skin_type) {
            fields.push('skin_type = ?');
            values.push(skin_type);
        }

        values.push(req.user.user_no);

        try {
            await conn.query(`UPDATE users SET ${fields.join(', ')} WHERE user_no = ?`, values);
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') throw new ValidationError("이미 사용 중인 닉네임입니다.");
            throw err;
        }

        // 정보 수정 시에도 토큰에 기존 나이 유지
        const newToken = jwt.sign(
            {
                user_no: req.user.user_no,
                nick: nick ? nick.trim() : req.user.nick,
                skin_type: skin_type || req.user.skin_type,
                gender: req.user.gender,
                age: req.user.age 
            },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('token', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({ status: "success", data: { message: "회원정보가 수정되었습니다." } });
    } catch (error) {
        next(error);
    }
});


/*
    회원탈퇴
    DELETE /api/users/my
*/
router.delete('/my', requireLogin, async (req, res, next) => {
    try {
        const { pwd } = req.body;
        const user_no = req.user.user_no;

        if (!pwd) throw new ValidationError("비밀번호를 입력해주세요.");

        const [users] = await conn.query("SELECT pwd FROM users WHERE user_no = ?", [user_no]);
        if (!users[0] || !(await bcrypt.compare(pwd, users[0].pwd))) {
            throw new ValidationError("비밀번호가 올바르지 않습니다.", 401);
        }

        // 1. 파일 물리적 삭제
        const [files] = await conn.query(
            `SELECT u.file_name, a.processing_img
             FROM uploads u
             LEFT JOIN img_analyses a ON u.upload_no = a.upload_no
             WHERE u.user_no = ?`,
            [user_no]
        );

        for (const file of files) {
            try {
                if (file.file_name) await fs.unlink(path.join(__dirname, '..', file.file_name));
                if (file.processing_img) await fs.unlink(path.join(__dirname, '..', file.processing_img));
            } catch (e) { /* 파일 없어도 계속 진행 */ }
        }

        // 2. DB 연쇄 삭제 
        const deleteQueries = [
            "DELETE FROM daily_reports WHERE user_no = ?",
            "DELETE a FROM img_analyses a JOIN uploads u ON a.upload_no = u.upload_no WHERE u.user_no = ?",
            "DELETE FROM actions WHERE user_no = ?",
            "DELETE FROM challenge_details WHERE chal_no IN (SELECT chal_no FROM challenges WHERE user_no = ?)",
            "DELETE FROM routines WHERE user_no = ?",
            "DELETE FROM challenges WHERE user_no = ?",
            "DELETE FROM user_cosmetics WHERE user_no = ?",
            "DELETE FROM uploads WHERE user_no = ?",
            "DELETE FROM users WHERE user_no = ?"
        ];

        for (const query of deleteQueries) {
            await conn.query(query, [user_no]);
        }

        // 쿠키 삭제
        res.clearCookie('token');
        res.json({ status: "success", data: { message: "탈퇴 완료" } });
    } catch (error) {
        next(error);
    }
});

module.exports = router;