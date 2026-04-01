const express = require('express');
const router = express.Router();
const conn = require('../config/database');
const jwt = require('jsonwebtoken');


const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';


// 커스텀 에러

class ValidationError extends Error {
    constructor(message, statusCode = 400){
        super(message);
        this.name = 'ValidationError';
        this.statusCode = statusCode;
    }
}

// 공통 에러

const handleError = (res, error) =>{
    if(error instanceof ValidationError) {
        return res.status(error.statusCode).json({
            status : 'error',
            data : {message : error.message}
        });
    }
    console.error('[SERVER ERROR]', error);
    return res.status(500).json({
        status : 'error',
        data : { message : '서버오류'}
    });
};

// JWT 인증 미들웨어

const requireLogin = (req, res, next) =>{
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if(!token) {
        return res.status(401).json({
            status : 'error',
            data : {message : '로그인이 필요합니다.'}
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err){
        return res.status(401).json ({
            status : 'error',
            data : {message : '유효하지 않거나 만료된 토큰입니다.'}
        });
    }
};

/*
    화장품 검색
    GET /api/cosmetics/search?keyword=검색어
*/ 

router.get('/search', requireLogin, (req, res)=>{
    try{
        const { keyword } = req.query;

        if (!keyword || !keyword.trim()) {
            throw new ValidationError('검색어를 입력해주세요.');
        }

        const sql = `
            SELECT cos_no, cos_name, cos_brand, cos_type
            FROM cosmetics
            WHERE cos_name LIKE ? or cos_brand LIKE ? 
            ORDER BY cos_name ASC
        `;
        const searchTerm = `%${keyword.trim()}%`;

        conn.query(sql, [searchTerm, searchTerm], (err, results) => {
            if(err) return handleError(res, err);

            if(results.length === 0 ) {
                return handleError(res, new ValidationError('해당 화장품을 찾을 수 없습니다.', 404));
            }

            return res.json({
                status : 'success',
                data: results
            });
        });
    } catch (error) {
        handleError(res,error);
    }
});

/*
   화장품 추천 (루틴 연계형으로 전면 수정!)
   GET /api/cosmetics/recommend
*/ 

router.get('/recommend', requireLogin, (req, res) => {
    const user_no = req.user.user_no;

    // 핵심 SQL: 현재 진행 중인 챌린지의 '루틴'에 포함된 화장품 중, '내 화장품(user_cosmetics)'에 없는 것만 쏙쏙 뽑아옵니다!
    const recommendedSql = `
        SELECT DISTINCT 
            c.cos_no, 
            c.cos_name, 
            c.cos_brand, 
            c.cos_type, 
            c.cos_function
        FROM challenges ch
        JOIN challenge_details cd ON ch.chal_no = cd.chal_no
        JOIN routines r ON cd.routine_no = r.routine_no
        JOIN cosmetics c ON r.cos_no = c.cos_no
        LEFT JOIN user_cosmetics uc ON r.user_no = uc.user_no AND r.cos_no = uc.cos_no
        WHERE ch.user_no = ? 
          AND ch.chal_status = '진행중' 
          AND uc.ucos_no IS NULL; -- 내가 보유하지 않은 화장품만 필터링!
    `;

    conn.query(recommendedSql, [user_no], (err, results) => {
        if (err) return handleError(res, err);

        // 만약 추천할 게 없다면 (루틴에 있는 걸 다 가지고 있다면)
        if (results.length === 0) {
            return res.json({
                status: "success",
                data: {
                    recommendation: [],
                    message: "현재 루틴에 필요한 모든 화장품을 보유하고 계시네요!"
                }
            });
        }

        
        return res.json({
            status: "success",
            data: {
                recommendation: results
            }
        });
    });
});

/*
   보유 화장품 등록
   POST /api/cosmetics/user-cosmetics
*/


router.post('/user-cosmetics', requireLogin, (req, res) => {
    try {
        const { cos_no, expired_at } = req.body;
        const user_no = req.user.user_no;

        if (!cos_no) {
            throw new ValidationError("화장품을 선택해주세요.");
        }

        const checkSql = `
            SELECT ucos_no FROM user_cosmetics
            WHERE user_no = ? AND cos_no = ?
        `;

        conn.query(checkSql, [user_no, cos_no], (err, existing) => {
            if (err) return handleError(res, err);

            if (existing.length > 0) {
                return handleError(res, new ValidationError("이미 보관함에 등록된 화장품입니다."));
            }

            const sql = `
                INSERT INTO user_cosmetics (user_no, cos_no, expired_at, created_at)
                VALUES (?, ?, ?, NOW())
            `;

            conn.query(sql, [user_no, cos_no, expired_at || null], (err) => {
                if (err) return handleError(res, err);

                return res.status(201).json({
                    status: "success",
                    data: { message: "보유 화장품 등록이 완료되었습니다." }
                });
            });
        });

    } catch (error) {
        handleError(res, error);
    }
});

/*
    보유 화장품 목록 조회
    GET /api/cosmetics/user-cosmetics
*/

router.get('/user-cosmetics', requireLogin, (req, res) => {
    const sql = `
        SELECT
            uc.ucos_no,
            uc.cos_no,
            c.cos_name,
            c.cos_brand,
            c.cos_type,
            uc.expired_at
        FROM user_cosmetics uc
        JOIN cosmetics c ON uc.cos_no = c.cos_no
        WHERE uc.user_no = ?
        ORDER BY uc.created_at DESC
    `;

    conn.query(sql, [req.user.user_no], (err, results) => {
        if (err) return handleError(res, err);

        if (results.length === 0) {
            return res.json({
                status: "success",
                data: {
                    list: [],
                    message: "등록된 화장품이 없습니다. 화장품을 등록해보세요!"
                }
            });
        }

        return res.json({
            status: "success",
            data: results
        });
    });
});


/* 
    보유 화장품 삭제
    DELETE /api/cosmetics/user-cosmetics/:ucos_no
*/


router.delete('/user-cosmetics/:ucos_no', requireLogin, (req, res) => {
    try {
        const { ucos_no } = req.params;
        const user_no = req.user.user_no;

        if (!ucos_no || isNaN(ucos_no)) {
            throw new ValidationError("올바른 화장품 번호를 입력해주세요.");
        }

        const checkSql = `
            SELECT ucos_no FROM user_cosmetics
            WHERE ucos_no = ? AND user_no = ?
        `;

        conn.query(checkSql, [ucos_no, user_no], (err, results) => {
            if (err) return handleError(res, err);

            if (results.length === 0) {
                return handleError(res, new ValidationError(
                    "해당 화장품을 찾을 수 없거나 권한이 없습니다.", 403
                ));
            }

            conn.query("DELETE FROM user_cosmetics WHERE ucos_no = ?", [ucos_no], (err) => {
                if (err) return handleError(res, err);

                return res.json({
                    status: "success",
                    data: { message: "화장품이 목록에서 삭제되었습니다." }
                });
            });
        });

    } catch (error) {
        handleError(res, error);
    }
});

module.exports = router;