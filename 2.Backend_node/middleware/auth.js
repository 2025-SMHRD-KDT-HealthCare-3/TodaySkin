const jwt = require('jsonwebtoken');
const { ValidationError } = require('./errorHandler');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// ============================================================
// JWT 인증 미들웨어 (쿠키 방식)
// - 쿠키에서 토큰 꺼내서 검증
// - 검증 성공 시 req.user에 디코딩된 유저 정보 저장
// - 에러는 res에 직접 관여하지 않고 next(err)로 전달
// ============================================================

const requireLogin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null)
                  || req.cookies?.token;

    if (!token) {
        return next(new ValidationError("로그인이 필요합니다.", 401));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // // { user_no, nick, skin_type, gender }
        next();
    } catch (err) {
        return next(new ValidationError("유효하지 않거나 만료된 토큰입니다.", 401));
    }
};

module.exports = { requireLogin };