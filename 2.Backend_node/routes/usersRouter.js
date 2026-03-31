/*
 * 유저 관련 라우터 (usersRouter)
 - 회원가입, 로그인, 로그아웃, 회원정보 조회/수정/탈퇴
 - 기본 경로: /api/users
*/

const express = require('express');
const router = express.Router();
const conn = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

/*
 * 커스텀 에러 클래스
 - 검증 실패 시 상태코드와 메시지를 함께 전달
*/
class ValidationError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = statusCode;
    }
}

/*
 * 공통 에러 핸들러
 - ValidationError → 해당 상태코드 반환, 그 외 → 500 서버 오류
  
 * 상태코드 정리:
 - 200 OK           — 요청 성공 (로그인, 조회 등)
 - 201 Created      — 데이터 생성 성공 (회원가입 완료)
 - 400 Bad Request  — 잘못된 요청 (필수값 누락, 형식 오류, 중복 데이터)
 - 401 Unauthorized — 권한 없음 (아이디/비번 불일치, 토큰 만료)
 - 500 Internal     — 서버 내부 오류 (DB 연결 실패 등)
 */
const handleError = (res, error) => {
    if (error instanceof ValidationError) {
        return res.status(error.statusCode).json({
            status: "error",
            data: { message: error.message }
        });
    }
    console.error('[SERVER ERROR]', error);
    return res.status(500).json({
        status: "error",
        data: { message: "서버 오류" }
    });
};

/*
 * 공통 인증 미들웨어
 - Authorization 헤더에서 JWT 토큰을 추출하여 검증
 - 성공 시 req.user에 { user_no, nick, skin_type } 저장
*/
const requireLogin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            status: "error",
            data: { message: "로그인이 필요합니다." }
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            status: "error",
            data: { message: "유효하지 않거나 만료된 토큰입니다." }
        });
    }
};

/*
 * 회원가입
 - POST /api/users/join
 - 요청: { id, pwd, birthdate, gender, nick, skin_type }
 - 응답: { status, data: { message, user_no } }
 - pwd는 bcrypt로 암호화 후 저장, joined_at은 서버 시간 자동 입력
*/
router.post('/join', async (req, res) => {
    try {
        const { id, pwd, birthdate, gender, nick, skin_type } = req.body;

        if (!id || !pwd || !birthdate || !gender || !nick || !skin_type ||
            !id.trim() || !pwd.trim() || !nick.trim()) {
            throw new ValidationError("모든 필수 정보를 입력해주세요.");
        }

        if (!['M', 'F'].includes(gender)) {
            throw new ValidationError("성별은 M 또는 F만 가능합니다.");
        }

        const validSkin = ["건성", "지성", "복합성", "민감성", "중성"];
        if (!validSkin.includes(skin_type)) {
            throw new ValidationError("올바른 피부타입을 입력해주세요. ( 건성 | 지성 | 복합성 | 민감성 | 중성 )");
        }

        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(birthdate)) {
            throw new ValidationError("생년월일 형식이 올바르지 않습니다. (YYYY-MM-DD)");
        }

        const hashedPw = await bcrypt.hash(pwd, 10);

        const sql = `
            INSERT INTO users (id, pwd, birthdate, gender, nick, skin_type, joined_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        `;

        conn.query(sql, [id, hashedPw, birthdate, gender, nick, skin_type], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return handleError(res, new ValidationError("이미 사용 중인 아이디 또는 닉네임입니다."));
                }
                return handleError(res, err);
            }

            return res.status(201).json({
                status: "success",
                data: {
                    message: "회원가입이 완료되었습니다.",
                    user_no: result.insertId
                }
            });
        });

    } catch (error) {
        handleError(res, error);
    }
});

/*
 * 로그인
 - POST /api/users/login
 - 요청: { id, pwd }
 - 응답: { status, data: { token, user_no, nick, message } }
 - bcrypt로 비밀번호 비교 후 JWT 토큰 발급 (7일 유효)
*/
router.post('/login', async (req, res) => {
    try {
        const { id, pwd } = req.body;

        if (!id || !pwd) {
            throw new ValidationError("아이디와 비밀번호를 입력해주세요.");
        }

        const sql = "SELECT user_no, pwd, nick, skin_type FROM users WHERE id = ?";
        conn.query(sql, [id], async (err, results) => {
            try {
                if (err) throw err;

                if (results.length === 0) {
                    throw new ValidationError("아이디 또는 비밀번호가 틀렸습니다.", 401);
                }

                const user = results[0];
                const isMatch = await bcrypt.compare(pwd, user.pwd);

                if (!isMatch) {
                    throw new ValidationError("아이디 또는 비밀번호가 틀렸습니다.", 401);
                }

                const token = jwt.sign(
                    { user_no: user.user_no, nick: user.nick, skin_type: user.skin_type },
                    JWT_SECRET,
                    { expiresIn: '7d' }
                );

                return res.json({
                    status: "success",
                    data: {
                        token,
                        user_no: user.user_no,
                        nick: user.nick,
                        message: `${user.nick}님, 환영합니다!`
                    }
                });

            } catch (error) {
                handleError(res, error);
            }
        });

    } catch (error) {
        handleError(res, error);
    }
});

/*
 * 로그아웃
 - 별도 API 호출 없음 — JWT는 서버에 상태가 없으므로
 - 클라이언트(Header.jsx)에서 localStorage 토큰 삭제로 처리
 */

/*
 * 회원정보 조회
 - GET /api/users/my
 - 인증 필요 (requireLogin)
 - 응답: { status, data: { id, nick, birthdate, gender, skin_type, joined_at } }
*/
router.get('/my', requireLogin, (req, res) => {
    const sql = 'SELECT id, nick, birthdate, gender, skin_type, joined_at FROM users WHERE user_no = ?';

    conn.query(sql, [req.user.user_no], (err, results) => {
        if (err) return handleError(res, err);

        if (results.length === 0) {
            return handleError(res, new ValidationError("사용자를 찾을 수 없습니다."));
        }

        return res.json({
            status: "success",
            data: results[0]
        });
    });
});

/*
 * 회원정보 수정
 - PUT /api/users/my
 - 인증 필요 (requireLogin)
 - 요청: { pwd?, nick?, skin_type? } — 변경할 항목만 전송
 - 응답: { status, data: { message, token } } — 갱신된 JWT 토큰 반환
 */
router.put('/my', requireLogin, async (req, res) => {
    try {
        const { pwd, nick, skin_type } = req.body;

        if (!pwd && !nick && !skin_type) {
            throw new ValidationError("수정할 정보를 입력해주세요.");
        }

        if (skin_type) {
            const validSkin = ['건성', '지성', '복합성', '민감성', '중성'];
            if (!validSkin.includes(skin_type)) {
                throw new ValidationError("올바른 피부타입을 입력해주세요.");
            }
        }

        /* 변경할 필드만 동적으로 SQL 구성 */
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
        const sql = `UPDATE users SET ${fields.join(', ')} WHERE user_no = ?`;

        conn.query(sql, values, (err) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return handleError(res, new ValidationError("이미 사용 중인 닉네임입니다."));
                }
                return handleError(res, err);
            }

            /* 변경된 정보 반영한 새 토큰 발급 */
            const newToken = jwt.sign(
                {
                    user_no: req.user.user_no,
                    nick: nick ? nick.trim() : req.user.nick,
                    skin_type: skin_type || req.user.skin_type
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            );

            return res.json({
                status: "success",
                data: {
                    message: "회원정보가 수정되었습니다.",
                    token: newToken
                }
            });
        });

    } catch (error) {
        handleError(res, error);
    }
});

/*
 * 회원탈퇴
 - DELETE /api/users/my
 - 인증 필요 (requireLogin)
 - 요청: { pwd } — 본인 확인용 비밀번호
 - 처리 순서: 비밀번호 확인 → 업로드 파일 물리 삭제 → DB 연쇄 삭제 → 응답
 */
router.delete('/my', requireLogin, async (req, res) => {
    try {
        const { pwd } = req.body;
        const user_no = req.user.user_no;

        if (!pwd) {
            throw new ValidationError("비밀번호를 입력해주세요.");
        }

        /* 비밀번호 확인 */
        const selectSql = "SELECT pwd FROM users WHERE user_no = ?";
        conn.query(selectSql, [user_no], async (err, results) => {
            try {
                if (err) throw err;
                if (results.length === 0) {
                    throw new ValidationError("사용자를 찾을 수 없습니다.");
                }

                const isMatch = await bcrypt.compare(pwd, results[0].pwd);
                if (!isMatch) {
                    throw new ValidationError("비밀번호가 올바르지 않습니다.", 401);
                }

                /* 업로드된 파일 물리 삭제 (원본 + 전처리 이미지) */
                const fileSql = `
                    SELECT u.file_name, a.processing_img 
                    FROM uploads u 
                    LEFT JOIN img_analyses a ON u.upload_no = a.upload_no 
                    WHERE u.user_no = ?
                `;

                conn.query(fileSql, [user_no], (err, files) => {
                    if (err) return handleError(res, err);

                    files.forEach(file => {
                        if (file.file_name) {
                            const originPath = path.join(__dirname, '..', file.file_name);
                            fs.unlink(originPath, (err) => {
                                if (err && err.code !== 'ENOENT') console.error('[원본 삭제 실패]', originPath);
                            });
                        }
                        if (file.processing_img) {
                            const processPath = path.join(__dirname, '..', file.processing_img);
                            fs.unlink(processPath, (err) => {
                                if (err && err.code !== 'ENOENT') console.error('[전처리 삭제 실패]', processPath);
                            });
                        }
                    });

                    /* DB 연쇄 삭제 — 관련 테이블 순서대로 삭제 후 users 삭제 */
                    const deleteQueries = [
                        ["DELETE FROM daily_reports WHERE user_no = ?", [user_no]],
                        ["DELETE a FROM img_analyses a JOIN uploads u ON a.upload_no = u.upload_no WHERE u.user_no = ?", [user_no]],
                        ["DELETE FROM actions WHERE user_no = ?", [user_no]],
                        ["DELETE FROM challenge_details WHERE chal_no IN (SELECT chal_no FROM challenges WHERE user_no = ?)", [user_no]],
                        ["DELETE FROM routines WHERE user_no = ?", [user_no]],
                        ["DELETE FROM challenges WHERE user_no = ?", [user_no]],
                        ["DELETE FROM user_cosmetics WHERE user_no = ?", [user_no]],
                        ["DELETE FROM uploads WHERE user_no = ?", [user_no]],
                        ["DELETE FROM users WHERE user_no = ?", [user_no]],
                    ];

                    /* 삭제 쿼리를 순서대로 하나씩 실행 (순차실행) - 앞의 삭제가 끝나야 다음 삭제 시작 */
                    const runNext = (index) => {
                        if (index >= deleteQueries.length) {
                            return res.json({
                                status: "success",
                                data: { message: "모든 데이터가 완벽하게 삭제되었습니다." }
                            });
                        }
                        const [sql, params] = deleteQueries[index];
                        conn.query(sql, params, (err) => {
                            if (err) return handleError(res, err);
                            runNext(index + 1);
                        });
                    };

                    runNext(0);
                });

            } catch (error) {
                handleError(res, error);
            }
        });

    } catch (error) {
        handleError(res, error);
    }
});

module.exports = router;