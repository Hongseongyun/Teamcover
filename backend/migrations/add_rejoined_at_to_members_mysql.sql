-- Members 테이블에 rejoined_at 컬럼 추가 (MySQL용)

-- rejoined_at 컬럼 추가 (재가입일, NULL 허용)
ALTER TABLE members 
ADD COLUMN rejoined_at DATETIME NULL;

-- 기존 데이터는 NULL로 유지 (재가입한 회원만 값이 있음)
