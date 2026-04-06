USE sc_25K_HI3_p2_1;

-- 외래키 연결 한 번에 확인하는 SQL: 현재 스키마 안의 FK 관계를 전부 보여줌
SELECT
    TABLE_NAME AS child_table,
    COLUMN_NAME AS child_column,
    REFERENCED_TABLE_NAME AS parent_table,
    REFERENCED_COLUMN_NAME AS parent_column,
    CONSTRAINT_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY parent_table, child_table;


-- FK 관계에 따른 테이블 연결 순서
-- 필요시 최하위 자식테이블부터 부모순으로 데이터 삭제
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE daily_reports;
TRUNCATE TABLE actions;
TRUNCATE TABLE challenge_details;
TRUNCATE TABLE img_analyses;
TRUNCATE TABLE routines;
TRUNCATE TABLE user_cosmetics;
TRUNCATE TABLE challenges;
TRUNCATE TABLE uploads;
TRUNCATE TABLE cosmetics;
TRUNCATE TABLE users;

SET FOREIGN_KEY_CHECKS = 1;


-- 1. users 테이블 생성 
CREATE TABLE users
(
    user_no    INT            NOT NULL    AUTO_INCREMENT COMMENT '회원 고유번호',
    id         VARCHAR(30)    NOT NULL    COMMENT '아이디',
    pwd        VARCHAR(255)   NOT NULL    COMMENT '비밀번호',
    birthdate  DATE           NOT NULL    COMMENT '생년월일',
    gender     CHAR(1)        NOT NULL    CHECK (gender IN ('M','F')) COMMENT '성별',
    nick       VARCHAR(30)    NOT NULL    COMMENT '닉네임',
    skin_type   VARCHAR(20)    NOT NULL    COMMENT '피부 타입',
    joined_at  DATETIME       NOT NULL    DEFAULT NOW() COMMENT '가입 일자',
	PRIMARY KEY (user_no)
);

-- 테이블 Comment 설정 SQL - users
ALTER TABLE users COMMENT '회원';

-- Index 설정 SQL - users(id, nick, joined_at)
CREATE INDEX IX_users_1 ON users(id, nick, joined_at);

-- Unique Index 설정 SQL - users(id)
CREATE UNIQUE INDEX UQ_users_2 ON users(id);

-- Unique Index 설정 SQL - users(nick)
CREATE UNIQUE INDEX UQ_users_1 ON users(nick);


-- 2. cosmetics 테이블 생성
CREATE TABLE cosmetics
(
    cos_no    	   INT            NOT NULL    AUTO_INCREMENT COMMENT '화장품 고유번호',
    cos_name  	   VARCHAR(100)   NOT NULL    COMMENT '제품 명',
    cos_brand 	   VARCHAR(50)    NOT NULL    COMMENT '브랜드 명',
    cos_type  	   VARCHAR(30)    NOT NULL    COMMENT '제품 유형',
    cos_ingredient TEXT       	  NOT NULL    COMMENT '주요 성분',
	PRIMARY KEY (cos_no)
);

-- 테이블 Comment 설정 SQL - cosmetics
ALTER TABLE cosmetics COMMENT '화장품';


-- 3. routines 테이블 생성
CREATE TABLE routines
(
    routine_no    INT            NOT NULL    AUTO_INCREMENT COMMENT '루틴 고유번호',
    user_no       INT            NOT NULL    COMMENT '회원 고유번호',
    routine_time  VARCHAR(10)    NOT NULL    COMMENT '루틴 시기',
    cos_no        INT            NOT NULL    COMMENT '화장품 고유번호',
    routine_order INT		     NOT NULL    COMMENT '루틴 순서',
    created_at    DATETIME       NOT NULL    DEFAULT NOW() COMMENT '등록 일자',
	PRIMARY KEY (routine_no)
);

-- 테이블 Comment 설정 SQL - routines
ALTER TABLE routines COMMENT '화장 루틴';

-- Index 설정 SQL - routines(created_at)
CREATE INDEX IX_routines_1 ON routines(created_at);

-- Foreign Key 설정 SQL - routines(cos_no) -> cosmetics(cos_no)
ALTER TABLE routines
  ADD CONSTRAINT FK_routines_cos_no_cosmetics_cos_no FOREIGN KEY (cos_no)
      REFERENCES cosmetics(cos_no) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 설정 SQL - routines(user_no) -> users(user_no)
ALTER TABLE routines
  ADD CONSTRAINT FK_routines_user_no_users_user_no FOREIGN KEY (user_no)
      REFERENCES users(user_no) ON DELETE RESTRICT ON UPDATE RESTRICT;
      
      

-- Foreign Key 삭제 SQL - routines(cos_no)
-- ALTER TABLE routines
-- DROP FOREIGN KEY FK_routines_cos_no_cosmetics_cos_no;


-- 4. challenges 테이블 생성
CREATE TABLE challenges
(
    chal_no      INT            NOT NULL    AUTO_INCREMENT COMMENT '챌린지 고유번호',
    user_no      INT            NOT NULL    COMMENT '회원 고유번호',
    chal_name    VARCHAR(50)    NOT NULL    COMMENT '챌린지 명',
    chal_type 	 INT 			NOT NULL 	CHECK (chal_type IN (7, 14)) COMMENT '챌린지 타입',
    start_date   DATE           NOT NULL    COMMENT '시작 일자',
    end_date     DATE           NOT NULL    COMMENT '종료 일자',
    chal_status  VARCHAR(20)    NOT NULL    COMMENT '챌린지 상태',
    created_at   DATETIME       NOT NULL    DEFAULT NOW() COMMENT '등록 일자',
	PRIMARY KEY (chal_no)
);

-- 테이블 Comment 설정 SQL - challenges
ALTER TABLE challenges COMMENT '챌린지';

-- Index 설정 SQL - challenges(created_at)
CREATE INDEX IX_challenges_1 ON challenges(created_at);

-- Foreign Key 설정 SQL - challenges(user_no) -> users(user_no)
ALTER TABLE challenges
  ADD CONSTRAINT FK_challenges_user_no_users_user_no FOREIGN KEY (user_no)
      REFERENCES users(user_no) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - challenges(user_no)
-- ALTER TABLE challenges
-- DROP FOREIGN KEY FK_challenges_user_no_users_user_no;


-- 5. challenge_details 테이블 생성
CREATE TABLE challenge_details
(
    detail_no   INT        NOT NULL    AUTO_INCREMENT COMMENT '세부 고유번호',
    chal_no     INT        NOT NULL    COMMENT '챌린지 고유번호',
    routine_no  INT        NOT NULL    COMMENT '루틴 고유번호',
    created_at  DATETIME   NOT NULL    DEFAULT NOW() COMMENT '등록 일자',
	PRIMARY KEY (detail_no)
);

-- 테이블 Comment 설정 SQL - challenge_details
ALTER TABLE challenge_details COMMENT '챌린지 세부내용';

-- Index 설정 SQL - challenge_details(created_at)
CREATE INDEX IX_challenge_details_1 ON challenge_details(created_at);

-- Foreign Key 설정 SQL - challenge_details(chal_no) -> challenges(chal_no)
ALTER TABLE challenge_details
  ADD CONSTRAINT FK_challenge_details_chal_no_challenges_chal_no FOREIGN KEY (chal_no)
      REFERENCES challenges(chal_no) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - challenge_details(chal_no)
-- ALTER TABLE challenge_details
-- DROP FOREIGN KEY FK_challenge_details_chal_no_challenges_chal_no;

ALTER TABLE challenge_details
  ADD CONSTRAINT FK_challenge_details_routine_no_routines_routine_no FOREIGN KEY (routine_no)
      REFERENCES routines(routine_no) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - challenge_details(routine_no)
-- ALTER TABLE challenge_details
-- DROP FOREIGN KEY FK_challenge_details_routine_no_routines_routine_no;


-- 6. uploads 테이블 생성
CREATE TABLE uploads
(
	upload_no    INT            NOT NULL    AUTO_INCREMENT COMMENT '업로드 고유번호',
    user_no      INT            NOT NULL    COMMENT '회원 고유번호',
    file_name    VARCHAR(255)   NOT NULL    COMMENT '파일 이름',
    file_size    INT            NOT NULL    DEFAULT 0 	  COMMENT '파일 사이즈',
    file_ext     VARCHAR(10)    NOT NULL    COMMENT '파일 확장자',
    uploaded_at  DATETIME       NOT NULL    DEFAULT NOW() COMMENT '업로드 날짜',
	PRIMARY KEY (upload_no)
);

-- 테이블 Comment 설정 SQL - uploads
ALTER TABLE uploads COMMENT '사진 업로드';

-- Index 설정 SQL - uploads(uploaded_at)
CREATE INDEX IX_uploads_1 ON uploads(uploaded_at);

-- Foreign Key 설정 SQL - uploads(user_no) -> users(user_no)
ALTER TABLE uploads
  ADD CONSTRAINT FK_uploads_user_no_users_user_no FOREIGN KEY (user_no)
      REFERENCES users(user_no) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - uploads(user_no)
-- ALTER TABLE uploads
-- DROP FOREIGN KEY FK_uploads_user_no_users_user_no;


-- 7. actions 테이블 생성
CREATE TABLE actions
(
    action_no    INT        NOT NULL    AUTO_INCREMENT COMMENT '실행 고유번호',
    user_no      INT        NOT NULL    COMMENT '회원 고유번호',
    detail_no    INT        NOT NULL    COMMENT '챌린지 세부 고유번호',
    action_yn    CHAR(1)    NOT NULL    COMMENT '실행 여부',
    created_at   DATETIME   NOT NULL    DEFAULT NOW() COMMENT '등록 일자',
	PRIMARY KEY (action_no)
);

-- 테이블 Comment 설정 SQL - actions
ALTER TABLE actions COMMENT '루틴 실천';

-- Index 설정 SQL - actions(created_at)
CREATE INDEX IX_actions_1 ON actions(created_at);

-- Foreign Key 설정 SQL - actions(user_no) -> users(user_no)
ALTER TABLE actions
  ADD CONSTRAINT FK_actions_user_no_users_user_no FOREIGN KEY (user_no)
      REFERENCES users(user_no) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - actions(user_no)
-- ALTER TABLE actions
-- DROP FOREIGN KEY FK_actions_user_no_users_user_no;

-- Foreign Key 설정 SQL - actions(detail_no) -> challenge_details(detail_no)
ALTER TABLE actions
  ADD CONSTRAINT FK_actions_detail_no_challenge_details_detail_no FOREIGN KEY (detail_no)
      REFERENCES challenge_details(detail_no) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - actions(detail_no)
-- ALTER TABLE actions
-- DROP FOREIGN KEY FK_actions_detail_no_challenge_details_detail_no;


-- 8. img_analyses 테이블 생성
CREATE TABLE img_analyses
(
    anls_no         INT            NOT NULL    AUTO_INCREMENT COMMENT '분석 고유번호',
    upload_no       INT            NOT NULL    COMMENT '업로드 고유번호',
    model_name      VARCHAR(100)   NOT NULL    COMMENT '모델 명',
    anls_result     TEXT           NOT NULL    COMMENT '분석 결과',
    acne_score      NUMERIC(5,2)   NOT NULL    DEFAULT 0.0 COMMENT '여드름 점수',
    pore_score      NUMERIC(5,2)   NOT NULL    DEFAULT 0.0 COMMENT '모공 점수',
    total_score     NUMERIC(5,2)   NOT NULL    DEFAULT 0.0 COMMENT '전체 점수',
    processing_img  VARCHAR(255)   NOT NULL    COMMENT '참고 파일 명',
    created_at      DATETIME       NOT NULL    DEFAULT NOW() COMMENT '분석 날짜',
	PRIMARY KEY (anls_no)
);

-- 테이블 Comment 설정 SQL - img_analyses
ALTER TABLE img_analyses COMMENT '이미지 분석';

-- Index 설정 SQL - img_analyses(created_at)
CREATE INDEX IX_img_analyses_1 ON img_analyses(created_at);

-- Foreign Key 설정 SQL - img_analyses(upload_no) -> uploads(upload_no)
ALTER TABLE img_analyses
  ADD CONSTRAINT FK_img_analyses_upload_no_uploads_upload_no FOREIGN KEY (upload_no)
      REFERENCES uploads(upload_no) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - img_analyses(upload_no)
-- ALTER TABLE img_analyses
-- DROP FOREIGN KEY FK_img_analyses_upload_no_uploads_upload_no;


-- 9. user_cosmetics 테이블 생성
CREATE TABLE user_cosmetics
(
    ucos_no     INT          NOT NULL    AUTO_INCREMENT COMMENT '보유 고유번호',
    user_no     INT          NOT NULL    COMMENT '회원 고유번호',
    cos_no      INT          NOT NULL    COMMENT '화장품 고유번호',
    source      VARCHAR(10)  NOT NULL    DEFAULT '보유' COMMENT '보유 여부',
    expired_at  DATE         NOT NULL    COMMENT '유통기한',
    created_at  DATETIME     NOT NULL    DEFAULT NOW() COMMENT '등록 일자',
	PRIMARY KEY (ucos_no)
);

-- 테이블 Comment 설정 SQL - user_cosmetics
ALTER TABLE user_cosmetics COMMENT '회원 보유화장품';

-- Foreign Key 설정 SQL - user_cosmetics(user_no) -> users(user_no)
ALTER TABLE user_cosmetics
  ADD CONSTRAINT FK_user_cosmetics_user_no_users_user_no FOREIGN KEY (user_no)
      REFERENCES users(user_no) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - user_cosmetics(user_no)
-- ALTER TABLE user_cosmetics
-- DROP FOREIGN KEY FK_user_cosmetics_user_no_users_user_no;

-- Foreign Key 설정 SQL - user_cosmetics(cos_no) -> cosmetics(cos_no)
ALTER TABLE user_cosmetics
  ADD CONSTRAINT FK_user_cosmetics_cos_no_cosmetics_cos_no FOREIGN KEY (cos_no)
      REFERENCES cosmetics(cos_no) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - user_cosmetics(cos_no)
-- ALTER TABLE user_cosmetics
-- DROP FOREIGN KEY FK_user_cosmetics_cos_no_cosmetics_cos_no;


-- 10. daily_reports 테이블 생성
CREATE TABLE daily_reports
(
    report_no         INT            NOT NULL    AUTO_INCREMENT COMMENT '리포트 고유번호', 
    action_no         INT            NULL    COMMENT '실행 고유번호', 
    user_no           INT            NOT NULL    COMMENT '회원 고유번호', 
    chal_no           INT            NOT NULL    COMMENT '챌린지 고유번호', 
    anls_no           INT            NOT NULL    COMMENT '이미지분석 고유번호', 
    line_comment      VARCHAR(255)   NOT NULL    COMMENT '한줄 코멘트', 
    overall_score    INT            NOT NULL    DEFAULT 0 	   COMMENT '종합 평가 점수', 
    created_at        DATETIME       NOT NULL    DEFAULT NOW() COMMENT '등록 일자', 
	PRIMARY KEY (report_no)
);

-- 테이블 Comment 설정 SQL - daily_reports
ALTER TABLE daily_reports COMMENT '데일리 리포트';

-- Index 설정 SQL - daily_reports(created_at)
CREATE INDEX IX_daily_reports_1 ON daily_reports(created_at);

-- Foreign Key 설정 SQL - daily_reports(user_no) -> users(user_no)
ALTER TABLE daily_reports
  ADD CONSTRAINT FK_daily_reports_user_no_users_user_no FOREIGN KEY (user_no)
      REFERENCES users(user_no) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - daily_reports(user_no)
-- ALTER TABLE daily_reports
-- DROP FOREIGN KEY FK_daily_reports_user_no_users_user_no;

-- Foreign Key 설정 SQL - daily_reports(action_no) -> actions(action_no)
ALTER TABLE daily_reports
  ADD CONSTRAINT FK_daily_reports_action_no_actions_action_no FOREIGN KEY (action_no)
      REFERENCES actions(action_no) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - daily_reports(action_no)
-- ALTER TABLE daily_reports
-- DROP FOREIGN KEY FK_daily_reports_action_no_actions_action_no;

-- Foreign Key 설정 SQL - daily_reports(chal_no) -> challenges(chal_no)
ALTER TABLE daily_reports
  ADD CONSTRAINT FK_daily_reports_chal_no_challenges_chal_no FOREIGN KEY (chal_no)
      REFERENCES challenges(chal_no) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - daily_reports(chal_no)
-- ALTER TABLE daily_reports
-- DROP FOREIGN KEY FK_daily_reports_chal_no_challenges_chal_no;

-- Foreign Key 설정 SQL - daily_reports(anls_no) -> img_analyses(anls_no)
ALTER TABLE daily_reports
  ADD CONSTRAINT FK_daily_reports_anls_no_img_analyses_anls_no FOREIGN KEY (anls_no)
      REFERENCES img_analyses(anls_no) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Foreign Key 삭제 SQL - daily_reports(anls_no)
-- ALTER TABLE daily_reports
-- DROP FOREIGN KEY FK_daily_reports_anls_no_img_analyses_anls_no;