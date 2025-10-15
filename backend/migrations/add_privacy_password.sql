-- User 테이블에 개인정보 보호 비밀번호 컬럼 추가

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS privacy_password_hash VARCHAR(128);

-- 결과 확인
SELECT COUNT(*) as total_users
FROM users;

SELECT 
  email,
  name,
  role,
  CASE 
    WHEN privacy_password_hash IS NOT NULL THEN '설정됨'
    ELSE '미설정'
  END as privacy_password_status
FROM users
LIMIT 10;

