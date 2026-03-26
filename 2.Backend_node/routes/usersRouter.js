const express = require('express');
const router = express.Router();
const conn = require('../config/database'); // DB 연결
const bcrypt = require('bcrypt'); // 비밀번호 암호화

// 회원가입
router.post('/signup', async (req, res) => {
    const { id, pwd, birthdate, gender, nick, skintype } = req.body;

    // 1. 필수값 + 공백 체크
    if (!id || !pwd || !birthdate || !gender || !nick || !skintype ||
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

    // 3. 피부타입 검증 (neutral 포함)
    const validSkin = ['dry', 'oily', 'complex', 'sensitive', 'neutral'];
    if (!validSkin.includes(skintype)) {
        return res.status(400).json({
            status: "error",
            data: { message: "올바른 피부타입을 입력해주세요." }
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

        // 6. SQL
        const sql = `
            INSERT INTO users
            (id, pwd, birthdate, gender, nick, skintype, joined_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        `;

        // 7. DB 저장
        conn.query(
            sql,
            [id, hashedPw, birthdate, gender, nick, skintype],
            (err, result) => {

                if (err) {
                    console.error(err);

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
                res.status(201).json({
                    status: "success",
                    data: {
                        message: "회원가입이 완료되었습니다.",
                        user_no: result.insertId
                    }
                });
            }
        );

    } catch (error) {
        res.status(500).json({
            status: "error",
            data: { message: "암호화 실패" }
        });
    }
});

// -----------------------------------------------------------------------------------------------------------------------------------

// 로그인

// router.post('/login', (req,res) => {
//     const {id, pwd} = req.body;

//     // 입력값 체크
//     if(!id || !pwd) {
//         return res.status(400).json({ status : 'error', data : { message: '아이디와 비밀번호를 입력해주세요.'} })
//     }

//     // DB에서 아이디로 유저 조회
//     const sql = 'SELECT * FROM users WHERE id = ?';
//     conn.query(sql, [id], async (err, results) => {
//         if(err){
//             console.log(err);
//             return res.status(500).json({ status : 'error', data : {message : '서버 오류'}})
//         }
//         if(resultS.length === 0 ){
//             return res.status(401).json({ status : 'error', data : {message : '아이디 또는 비밀번호가 틀렸습니다.'}})
//         }
//         const user = results[0];

//         try {
//             const isMatch = await bcrypt.compare(pwd, user.pwd);
//         }
//     })
// })

module.exports = router;