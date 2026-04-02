/*
 * cosmeticsRouter — 화장품 검색 / 보유 화장품 관리 / 화장품 추천
 - GET    /api/cosmetics/search              화장품 검색
 - GET    /api/cosmetics/recommend           화장품 추천 (루틴 연계)
 - GET    /api/cosmetics/user-cosmetics      보유 화장품 목록 조회
 - POST   /api/cosmetics/user-cosmetics      보유 화장품 등록
 - PUT    /api/cosmetics/user-cosmetics/:ucos_no  유통기한 수정
 - DELETE /api/cosmetics/user-cosmetics/:ucos_no  보유 화장품 삭제
*/

const express = require('express');
const conn = require('../config/database');
const { requireLogin } = require('../middleware/auth');
const { ValidationError } = require('../middleware/errorHandler');

const router = express.Router();


// ============================================================
// 화장품 검색 (cosmetics 테이블)
// GET /api/cosmetics/search?keyword=검색어
// ============================================================

router.get('/search', requireLogin, async (req, res, next) => {
    try {
        const { keyword } = req.query;

        if (!keyword || !keyword.trim()) {
            throw new ValidationError('검색어를 입력해주세요.');
        }

        const sql = `
            SELECT cos_no, cos_name, cos_brand, cos_type
            FROM cosmetics
            WHERE cos_name LIKE ? OR cos_brand LIKE ?
            ORDER BY cos_name ASC
            LIMIT 20
        `;
        const searchTerm = `%${keyword.trim()}%`;
        const [results] = await conn.query(sql, [searchTerm, searchTerm]);

        /* 검색 결과 없음은 에러가 아닌 정상 응답 — 빈 배열 반환 */
        res.json({
            status: 'success',
            data: results
        });
    } catch (error) {
        next(error);
    }
});


// ============================================================
// 화장품 추천 (루틴 연계)
// GET /api/cosmetics/recommend
// ============================================================

router.get('/recommend', requireLogin, async (req, res, next) => {
    try {
        const user_no = req.user.user_no;

        /* 진행 중인 챌린지의 루틴에 필요하지만 미보유 중인 화장품 */
        const sql = `
            SELECT DISTINCT
                c.cos_no, c.cos_name, c.cos_brand, c.cos_type, c.cos_function
            FROM challenges ch
            JOIN challenge_details cd ON ch.chal_no = cd.chal_no
            JOIN routines r ON cd.routine_no = r.routine_no
            JOIN cosmetics c ON r.cos_no = c.cos_no
            LEFT JOIN user_cosmetics uc ON uc.user_no = ? AND uc.cos_no = c.cos_no
            WHERE ch.user_no = ?
              AND ch.chal_status = '진행중'
              AND uc.ucos_no IS NULL
        `;
        const [results] = await conn.query(sql, [user_no, user_no]);

        res.json({
            status: "success",
            data: {
                recommendation: results,
                message: results.length === 0
                    ? "현재 루틴에 필요한 모든 화장품을 보유하고 계시네요!"
                    : null
            }
        });
    } catch (error) {
        next(error);
    }
});


// ============================================================
// 보유 화장품 목록 조회
// GET /api/cosmetics/user-cosmetics
// ============================================================

router.get('/user-cosmetics', requireLogin, async (req, res, next) => {
    try {
        const sql = `
            SELECT uc.ucos_no, uc.cos_no, c.cos_name, c.cos_brand, c.cos_type, uc.expired_at
            FROM user_cosmetics uc
            JOIN cosmetics c ON uc.cos_no = c.cos_no
            WHERE uc.user_no = ?
            ORDER BY uc.created_at DESC
        `;
        const [results] = await conn.query(sql, [req.user.user_no]);

        res.json({
            status: "success",
            data: {
                list: results,
                message: results.length === 0 ? "등록된 화장품이 없습니다." : null
            }
        });
    } catch (error) {
        next(error);
    }
});


// ============================================================
// 보유 화장품 등록
// POST /api/cosmetics/user-cosmetics
// ============================================================

router.post('/user-cosmetics', requireLogin, async (req, res, next) => {
    try {
        const { cos_no, expired_at, source } = req.body;  // source 추가
        const user_no = req.user.user_no;

        if (!cos_no) throw new ValidationError("화장품을 선택해주세요.");

        /* 중복 등록 확인 */
        const [existing] = await conn.query(
            "SELECT ucos_no FROM user_cosmetics WHERE user_no = ? AND cos_no = ?",
            [user_no, cos_no]
        );
        if (existing.length > 0) {
            throw new ValidationError("이미 보관함에 등록된 화장품입니다.");
        }

        /* source가 '추천'이 아니면 기본값 '보유' */
        const validSource = source === '추천' ? '추천' : '보유';

        const sql = `
            INSERT INTO user_cosmetics (user_no, cos_no, source, expired_at, created_at)
            VALUES (?, ?, ?, ?, NOW())
        `;
        await conn.query(sql, [user_no, cos_no, validSource, expired_at || null]);

        res.status(201).json({
            status: "success",
            data: { message: "보유 화장품 등록이 완료되었습니다." }
        });
    } catch (error) {
        next(error);
    }
});


// ============================================================
// 보유 화장품 유통기한 수정
// PUT /api/cosmetics/user-cosmetics/:ucos_no
// ============================================================

router.put('/user-cosmetics/:ucos_no', requireLogin, async (req, res, next) => {
    try {
        const { ucos_no } = req.params;
        const { expired_at } = req.body;
        const user_no = req.user.user_no;

        if (!ucos_no || isNaN(ucos_no)) {
            throw new ValidationError("올바른 화장품 번호를 입력해주세요.");
        }

        /* 소유권 확인 */
        const [results] = await conn.query(
            "SELECT ucos_no FROM user_cosmetics WHERE ucos_no = ? AND user_no = ?",
            [ucos_no, user_no]
        );
        if (results.length === 0) {
            throw new ValidationError("해당 화장품을 찾을 수 없거나 권한이 없습니다.", 403);
        }

        await conn.query(
            "UPDATE user_cosmetics SET expired_at = ? WHERE ucos_no = ?",
            [expired_at || null, ucos_no]
        );

        res.json({
            status: "success",
            data: { message: "유통기한이 수정되었습니다." }
        });
    } catch (error) {
        next(error);
    }
});


// ============================================================
// 보유 화장품 삭제
// DELETE /api/cosmetics/user-cosmetics/:ucos_no
// ============================================================

router.delete('/user-cosmetics/:ucos_no', requireLogin, async (req, res, next) => {
    try {
        const { ucos_no } = req.params;
        const user_no = req.user.user_no;

        if (!ucos_no || isNaN(ucos_no)) {
            throw new ValidationError("올바른 화장품 번호를 입력해주세요.");
        }

        /* 소유권 확인 */
        const [results] = await conn.query(
            "SELECT ucos_no FROM user_cosmetics WHERE ucos_no = ? AND user_no = ?",
            [ucos_no, user_no]
        );
        if (results.length === 0) {
            throw new ValidationError("해당 화장품을 찾을 수 없거나 권한이 없습니다.", 403);
        }

        await conn.query("DELETE FROM user_cosmetics WHERE ucos_no = ?", [ucos_no]);

        res.json({
            status: "success",
            data: { message: "화장품이 목록에서 삭제되었습니다." }
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;