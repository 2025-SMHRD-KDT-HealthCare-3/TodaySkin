const express = require('express');
const router = express.Router();
const conn = require('../config/database'); // DB 연결
const bcrypt = require('bcrypt'); // 비밀번호 암호화
const fs = require('fs');
const path = require('path');

// ============================================================
// 공통 인증 미들웨어
// ============================================================

const requireLogin = (req, res, next) => {
    if (!req.session.user_no) {
        return res.status(401).json({
            status: "error",
            data: { message: "로그인이 필요합니다." }
        });
    }
    next();
};

// ============================================================
// 회원가입
// POST /api/users/signup
// ============================================================

router.post('/signup', async (req, res) => {
    // 💡 skintype -> skin_type 변경
    const { id, pwd, birthdate, gender, nick, skin_type } = req.body;

    // 1. 필수값 + 공백 체크
    if (!id || !pwd || !birthdate || !gender || !nick || !skin_type ||
        !id.trim() || !pwd.trim() || !nick.trim()) {
        return res.status(400).json({
            status: "error",
            data: { message: "모든 필수 정보를 입력해주세요." }
        });
    }

    // 2. 성별 검증
    if (!['M', 'F'].includes(gender)) {
        return res.status(400).json({
            status: "error",
            data: { message: "성별은 M 또는 F만 가능합니다." }
        });
    }

    // 3. 피부타입 검증
    const validSkin = ['dry', 'oily', 'complex', 'sensitive', 'neutral'];
    if (!validSkin.includes(skin_type)) {
        return res.status(400).json({
            status: "error",
            data: { message: "올바른 피부타입을 입력해주세요. (dry | oily | complex | sensitive | neutral)" }
        });
    }

    // 4. 생년월일 형식 체크
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(birthdate)) {
        return res.status(400).json({
            status: "error",
            data: { message: "생년월일 형식이 올바르지 않습니다. (YYYY-MM-DD)" }
        });
    }

    try {
        // 5. 비밀번호 암호화
        const hashedPw = await bcrypt.hash(pwd, 10);

        // 6. SQL (skin_type 적용)
        const sql = `
            INSERT INTO users (id, pwd, birthdate, gender, nick, skin_type, joined_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        `;

        // 7. DB 저장
        conn.query(sql, [id, hashedPw, birthdate, gender, nick, skin_type], (err, result) => {
            if (err) {
                console.error('[signup] DB 에러:', err);

                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({
                        status: "error",
                        data: { message: "이미 사용 중인 아이디 또는 닉네임입니다." }
                    });
                }

                return res.status(500).json({
                    status: "error",
                    data: { message: "서버 오류" }
                });
            }

            // 8. 성공 응답
            return res.status(201).json({
                status: "success",
                data: {
                    message: "회원가입이 완료되었습니다.",
                    user_no: result.insertId
                }
            });
        });

    } catch (error) {
        console.error('[signup] 암호화 에러:', error);
        return res.status(500).json({
            status: "error",
            data: { message: "암호화 실패" }
        });
    }
});

// ============================================================================================
// 로그인
// POST /api/users/login
// ==================================================================================================

router.post('/login', async (req, res) => {
    const { id, pwd } = req.body;

    if (!id || !pwd) {
        return res.status(400).json({
            status: "error",
            data: { message: "아이디와 비밀번호를 입력해주세요." }
        });
    }

    // 💡 SQL 조회 컬럼 skin_type으로 수정
    const sql = "SELECT user_no, pwd, nick, skin_type FROM users WHERE id = ?";
    conn.query(sql, [id], async (err, results) => {
        if (err) {
            console.error('[login] DB 에러:', err);
            return res.status(500).json({
                status: "error",
                data: { message: "서버 오류" }
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                status: "error",
                data: { message: "아이디 또는 비밀번호가 틀렸습니다." }
            });
        }

        const user = results[0];

        try {
            const isMatch = await bcrypt.compare(pwd, user.pwd);

            if (!isMatch) {
                return res.status(401).json({
                    status: "error",
                    data: { message: "아이디 또는 비밀번호가 틀렸습니다." }
                });
            }

            req.session.regenerate((err) => {
                if (err) {
                    console.error('[login] 세션 재생성 에러:', err);
                    return res.status(500).json({
                        status: "error",
                        data: { message: "로그인 처리 중 오류 발생" }
                    });
                }

                req.session.user_no = user.user_no;
                req.session.nick = user.nick;
                req.session.skin_type = user.skin_type; // 💡 세션 키 skin_type

                return res.json({
                    status: "success",
                    data: {
                        user_no: user.user_no,
                        nick: user.nick,
                        message: `${user.nick}님, 환영합니다!`
                    }
                });
            });

        } catch (error) {
            console.error('[login] bcrypt 에러:', error);
            return res.status(500).json({
                status: "error",
                data: { message: "로그인 처리 중 오류 발생" }
            });
        }
    });
});

// =======================================================================================
// 로그아웃
// POST /api/users/logout
// ========================================================================================

router.post('/logout', requireLogin, (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('[logout] 세션 삭제 에러:', err);
            return res.status(500).json({
                status: "error",
                data: { message: "로그아웃 처리 중 오류 발생" }
            });
        }

        res.clearCookie('connect.sid'); 
        return res.json({
            status: "success",
            data: { message: "로그아웃 완료" }
        });
    });
});

// ==========================================================================================
// 회원정보 조회
// GET /api/users/me
// ============================================================================================

router.get('/me', requireLogin, (req, res) => {
    // 💡 skin_type으로 조회
    const sql = 'SELECT id, nick, birthdate, gender, skin_type, joined_at FROM users WHERE user_no = ?';

    conn.query(sql, [req.session.user_no], (err, results) => {
        if (err) {
            console.error('[GET /me] DB 에러:', err);
            return res.status(500).json({
                status: "error",
                data: { message: "서버 오류" }
            });
        }

        if (results.length === 0) {
            return res.status(400).json({
                status: "error",
                data: { message: "사용자를 찾을 수 없습니다." }
            });
        }

        return res.json({
            status: "success",
            data: results[0] 
        });
    });
});

// ========================================================================================
// 회원정보 수정
// PUT /api/users/me
// ========================================================================================

router.put('/me', requireLogin, async (req, res) => {
    // 💡 skintype -> skin_type
    const { pwd, nick, skin_type } = req.body;

    if (!pwd && !nick && !skin_type) {
        return res.status(400).json({
            status: "error",
            data: { message: "수정할 정보를 입력해주세요." }
        });
    }

    if (skin_type) {
        const validSkin = ['dry', 'oily', 'complex', 'sensitive', 'neutral'];
        if (!validSkin.includes(skin_type)) {
            return res.status(400).json({
                status: "error",
                data: { message: "올바른 피부타입을 입력해주세요." }
            });
        }
    }

    try {
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
            fields.push('skin_type = ?'); // 💡 skin_type
            values.push(skin_type);
        }

        values.push(req.session.user_no);
        const sql = `UPDATE users SET ${fields.join(', ')} WHERE user_no = ?`;

        conn.query(sql, values, (err) => {
            if (err) {
                console.error('[PUT /me] DB 에러:', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ status: "error", data: { message: "이미 사용 중인 닉네임입니다." } });
                }
                return res.status(500).json({ status: "error", data: { message: "서버 오류" } });
            }

            if (nick) req.session.nick = nick.trim();
            if (skin_type) req.session.skin_type = skin_type; // 💡 세션 갱신

            return res.json({
                status: "success",
                data: { message: "회원정보가 수정되었습니다." }
            });
        });

    } catch (error) {
        console.error('[PUT /me] 암호화 에러:', error);
        return res.status(500).json({ status: "error", data: { message: "서버 오류" } });
    }
});

// ============================================================================================
// 회원탈퇴
// DELETE /api/users/me
// =============================================================================================

router.delete('/me', requireLogin, async (req, res) => {
    const { pwd } = req.body;
    const user_no = req.session.user_no;

    if (!pwd) {
        return res.status(400).json({
            status: "error",
            data: { message: "비밀번호를 입력해주세요." }
        });
    }

    const selectSql = "SELECT pwd FROM users WHERE user_no = ?";
    conn.query(selectSql, [user_no], async (err, results) => {
        if (err) return dbError(res, '[USER CHECK ERROR]', err, "서버 오류");
        if (results.length === 0) return res.status(400).json({ status: "error", data: { message: "사용자를 찾을 수 없습니다." } });

        try {
            const isMatch = await bcrypt.compare(pwd, results[0].pwd);
            if (!isMatch) return res.status(401).json({ status: "error", data: { message: "비밀번호가 올바르지 않습니다." } });

            // 1. 파일 조회 (UPLOADS/IMG_ANALYSES)
            const fileSql = `
                SELECT u.file_name, a.processing_img 
                FROM uploads u 
                LEFT JOIN img_analyses a ON u.upload_no = a.upload_no 
                WHERE u.user_no = ?
            `;

            conn.query(fileSql, [user_no], (err, files) => {
                if (err) return dbError(res, '[FILE SELECT ERROR]', err, "파일 조회 실패");

                // 2. 파일 물리적 삭제
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

                // 3. DB 연쇄 삭제 (순서 준수)
                conn.query("DELETE FROM daily_reports WHERE user_no = ?", [user_no], (err) => {
                    if (err) return dbError(res, '[REPORT DELETE ERROR]', err, "리포트 삭제 실패");

                    const delAnlsSql = "DELETE a FROM img_analyses a JOIN uploads u ON a.upload_no = u.upload_no WHERE u.user_no = ?";
                    conn.query(delAnlsSql, [user_no], (err) => {
                        if (err) return dbError(res, '[ANALYSIS DELETE ERROR]', err, "분석 삭제 실패");

                        conn.query("DELETE FROM actions WHERE user_no = ?", [user_no], (err) => {
                            if (err) return dbError(res, '[ACTION DELETE ERROR]', err, "행동 삭제 실패");

                            conn.query("DELETE FROM challenge_details WHERE chal_no IN (SELECT chal_no FROM challenges WHERE user_no = ?)", [user_no], (err) => {
                                if (err) return dbError(res, '[DETAIL DELETE ERROR]', err, "챌린지 상세 삭제 실패");

                                conn.query("DELETE FROM routines WHERE user_no = ?", [user_no], (err) => {
                                    if (err) return dbError(res, '[ROUTINE DELETE ERROR]', err, "루틴 삭제 실패");

                                    conn.query("DELETE FROM challenges WHERE user_no = ?", [user_no], (err) => {
                                        if (err) return dbError(res, '[CHALLENGE DELETE ERROR]', err, "챌린지 삭제 실패");

                                        conn.query("DELETE FROM user_cosmetics WHERE user_no = ?", [user_no], (err) => {
                                            if (err) return dbError(res, '[COSMETIC DELETE ERROR]', err, "화장품 삭제 실패");

                                            conn.query("DELETE FROM uploads WHERE user_no = ?", [user_no], (err) => {
                                                if (err) return dbError(res, '[UPLOAD DELETE ERROR]', err, "업로드 삭제 실패");

                                                conn.query("DELETE FROM users WHERE user_no = ?", [user_no], (err) => {
                                                    if (err) return dbError(res, '[USER DELETE ERROR]', err, "회원 삭제 실패");

                                                    req.session.destroy((err) => {
                                                        if (err) console.error('[SESSION DESTROY ERROR]', err);
                                                        res.clearCookie('connect.sid');
                                                        return res.json({ status: "success", data: { message: "모든 데이터가 완벽하게 삭제되었습니다." } });
                                                    });
                                                });
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        } catch (error) {
            console.error('[BCRYPT ERROR]', error);
            return res.status(500).json({ status: "error", data: { message: "서버 오류" } });
        }
    });
});

// 공통 DB 에러 처리 함수
function dbError(res, log, err, message) {
    console.error(log, err);
    return res.status(500).json({ status: "error", data: { message } });
}

module.exports = router;