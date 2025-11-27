-- users 테이블에 active_token 컬럼 추가
-- 이 컬럼은 현재 활성화된 JWT 토큰을 저장합니다
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_token TEXT;

-- 기존 사용자들의 active_token은 NULL로 유지됩니다 (정상)
-- 새로운 로그인 시에만 값이 설정됩니다

