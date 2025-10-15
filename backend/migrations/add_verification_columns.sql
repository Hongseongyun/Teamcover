-- User 테이블에 인증 관련 컬럼 추가
-- 이 스크립트는 기존 데이터베이스에 새로운 컬럼을 안전하게 추가합니다.

-- 1. is_verified 컬럼 추가 (인증 완료 여부)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- 2. verification_method 컬럼 추가 (인증 방식: email, code, auto)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verification_method VARCHAR(20);

-- 3. verification_code 컬럼 추가 (인증 코드)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verification_code VARCHAR(10);

-- 4. verification_code_expires 컬럼 추가 (인증 코드 만료 시간)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verification_code_expires TIMESTAMP;

-- 5. verified_at 컬럼 추가 (인증 완료 시간)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;

-- 기존 사용자들을 인증 완료 상태로 설정
UPDATE users 
SET 
  is_verified = TRUE,
  verified_at = COALESCE(created_at, NOW()),
  verification_method = CASE 
    WHEN google_id IS NOT NULL THEN 'auto'
    WHEN password_hash IS NOT NULL THEN 'email'
    ELSE 'auto'
  END
WHERE is_verified IS NULL OR is_verified = FALSE;

-- 결과 확인
SELECT 
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE is_verified = TRUE) as verified_users,
  COUNT(*) FILTER (WHERE is_verified = FALSE) as unverified_users
FROM users;
