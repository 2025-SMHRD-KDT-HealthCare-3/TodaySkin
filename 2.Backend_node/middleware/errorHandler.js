// 커스텀 에러 클래스

class ValidationError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = statusCode;
    }
}


// 공통 에러 핸들러 미들웨어
// - Express 에러 핸들러는 인자가 반드시 4개 (err, req, res, next)
// - 라우터에서 next(err)로 에러를 올리면 여기서 처리
// - res에 직접 관여하지 않고 모든 에러를 여기서 통일 처리


const errorHandler = (err, req, res, next) => {
    if (err instanceof ValidationError) {
        return res.status(err.statusCode).json({
            status: "error",
            data: { message: err.message }
        });
    }

    console.error('[SERVER ERROR]', err);
    return res.status(500).json({
        status: "error",
        data: { message: "서버 오류" }
    });
};

module.exports = { ValidationError, errorHandler };