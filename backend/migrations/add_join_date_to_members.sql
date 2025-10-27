-- Members 테이블에 join_date 컬럼 추가 (PostgreSQL용)

-- join_date 컬럼 추가 (가입일, nullable)
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS join_date DATE;

-- 코멘트 추가
COMMENT ON COLUMN members.join_date IS '가입일 (수정 가능)';

-- 기존 회원의 join_date를 created_at으로 채우기 (가입일이 없으면)
UPDATE members 
SET join_date = created_at 
WHERE join_date IS NULL;

