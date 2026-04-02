/*
 * errorHandler — 커스텀 에러 클래스 + 공통 에러 핸들러
 - ValidationError: 입력값 검증 실패 등 클라이언트 에러 (기본 400)
 - errorHandler: Express 에러 핸들러 미들웨어 (인자 4개 필수)
 - 라우터에서 next(err)로 올린 모든 에러를 여기서 통일 처리
 
 * HTTP 상태 코드
 - 200  OK              요청 성공 (로그인 성공 등)
 - 201  Created         데이터 생성 성공 (회원가입 완료)
 - 400  Bad Request     잘못된 요청 (필수값 누락, 형식 오류, 중복 데이터)
 - 401  Unauthorized    권한 없음 (아이디/비번 불일치, 세션 만료)
 - 500  Internal Error  서버 내부 오류 (DB 연결 실패 등)
 - 502  Bad Gateway     외부 서버 오류 (FastAPI 연결 실패 등)
*/

class ValidationError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'ValidationError';
        this.statusCode = statusCode;
    }
}

const errorHandler = (err, req, res, next) => {
    /* 클라이언트 에러 — 예상된 에러 (입력값 오류 등) */
    if (err instanceof ValidationError) {
        return res.status(err.statusCode).json({
            status: "error",
            data: { message: err.message }
        });
    }

    /* Axios 에러 — FastAPI 등 외부 서버 응답 실패 */
    if (err.isAxiosError) {
        console.error('[EXTERNAL API ERROR]', {
            url: err.config?.url,
            status: err.response?.status,
            data: err.response?.data,
        });
        return res.status(502).json({
            status: "error",
            data: { message: "외부 서버 연결에 실패했습니다." }
        });
    }

    /* 서버 에러 — 예상하지 못한 에러 (간결하게 로그) */
    console.error('[SERVER ERROR]', err.message || err);
    return res.status(500).json({
        status: "error",
        data: { message: "서버 오류" }
    });
};

module.exports = { ValidationError, errorHandler };