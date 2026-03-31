const express = require('express');
const router = express.Router();
const conn = require('../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key'; 

// ============================================================
// 커스텀 에러 클래스


class ValidationError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = statusCode;
    }
}

// ============================================================
// 공통 에러 핸들러


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

// ============================================================
// 공통 인증 미들웨어 (세션 → JWT)


const requireLogin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({
            status: "error",
            data: { message: "로그인이 필요합니다." }
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { user_no, nick, skin_type }
        next();
    } catch (err) {
        return res.status(401).json({
            status: "error",
            data: { message: "유효하지 않거나 만료된 토큰입니다." }
        });
    }
};

// ============================================================
// 회원가입
// POST /api/users/signup


router.post('/signup', async (req, res) => {
    try {
        const { id, pwd, birthdate, gender, nick, skin_type } = req.body;

        // 1. 필수값 + 공백 체크
        if (!id || !pwd || !birthdate || !gender || !nick || !skin_type ||
            !id.trim() || !pwd.trim() || !nick.trim()) {
            throw new ValidationError("모든 필수 정보를 입력해주세요.");
        }

        // 2. 성별 검증
        if (!['M', 'F'].includes(gender)) {
            throw new ValidationError("성별은 M 또는 F만 가능합니다.");
        }

        // 3. 피부타입 검증
        const validSkin = ['dry', 'oily', 'complex', 'sensitive', 'neutral'];
        if (!validSkin.includes(skin_type)) {
            throw new ValidationError("올바른 피부타입을 입력해주세요. (dry | oily | complex | sensitive | neutral)");
        }

        // 4. 생년월일 형식 체크
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(birthdate)) {
            throw new ValidationError("생년월일 형식이 올바르지 않습니다. (YYYY-MM-DD)");
        }

        // 5. 비밀번호 암호화
        const hashedPw = await bcrypt.hash(pwd, 10);

        // 6. DB 저장
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

// ============================================================
// 로그인
// POST /api/users/login


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

                // JWT 발급 (세션 대신 토큰 사용)
                const token = jwt.sign(
                    { user_no: user.user_no, nick: user.nick, skin_type: user.skin_type },
                    JWT_SECRET,
                    { expiresIn: '7d' }
                );

                return res.json({
                    status: "success",
                    data: {
                        token,                  // 클라이언트가 저장해서 헤더에 담아 보냄
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

// ============================================================
// 로그아웃
// POST /api/users/logout
// ※ JWT는 서버에 상태가 없으므로 클라이언트가 토큰을 삭제하면 됨
//   서버에서 추가로 블랙리스트 처리가 필요하다면 Redis 등 활용


router.post('/logout', requireLogin, (req, res) => {
    // 클라이언트 측에서 토큰 삭제 처리
    return res.json({
        status: "success",
        data: { message: "로그아웃 완료. 클라이언트에서 토큰을 삭제해주세요." }
    });
});

// ============================================================
// 회원정보 조회
// GET /api/users/me


router.get('/me', requireLogin, (req, res) => {
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

// ============================================================
// 회원정보 수정
// PUT /api/users/me


router.put('/me', requireLogin, async (req, res) => {
    try {
        const { pwd, nick, skin_type } = req.body;

        if (!pwd && !nick && !skin_type) {
            throw new ValidationError("수정할 정보를 입력해주세요.");
        }

        if (skin_type) {
            const validSkin = ['dry', 'oily', 'complex', 'sensitive', 'neutral'];
            if (!validSkin.includes(skin_type)) {
                throw new ValidationError("올바른 피부타입을 입력해주세요.");
            }
        }

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

            // ※ JWT는 stateless이므로 변경된 정보가 담긴 새 토큰을 재발급
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
                    token: newToken // 갱신된 토큰 반환
                }
            });
        });

    } catch (error) {
        handleError(res, error);
    }
});

// ============================================================
// 회원탈퇴
// DELETE /api/users/me


router.delete('/me', requireLogin, async (req, res) => {
    try {
        const { pwd } = req.body;
        const user_no = req.user.user_no;

        if (!pwd) {
            throw new ValidationError("비밀번호를 입력해주세요.");
        }

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

                // 파일 조회 후 물리적 삭제
                const fileSql = `
                    SELECT u.file_name, a.processing_img 
                    FROM uploads u 
                    LEFT JOIN img_analyses a ON u.upload_no = a.upload_no 
                    WHERE u.user_no = ?
                `;

                conn.query(fileSql, [user_no], (err, files) => {
                    if (err) return handleError(res, err);

                    if (files.length > 0) {
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
                    }

                    // DB 연쇄 삭제
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

                    // 순차 실행 (콜백 지옥 → 재귀로 정리)
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

// ============================================================
// 공통 DB 에러 처리 함수 (레거시 호환용)

function dbError(res, log, err, message) {
    console.error(log, err);
    return handleError(res, new Error(message));
}

module.exports = router;