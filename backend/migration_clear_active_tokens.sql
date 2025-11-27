-- 기존 active_token을 초기화하는 마이그레이션
-- 이전에 전체 토큰 문자열로 저장된 경우를 정리하기 위해
-- 모든 사용자의 active_token을 NULL로 설정
-- (다음 로그인 시 새로운 jti 방식으로 저장됨)

UPDATE users SET active_token = NULL;

-- 참고: 이 마이그레이션을 실행하면 모든 사용자가 다시 로그인해야 합니다.
-- 하지만 새로운 jti 방식으로 정확하게 작동하게 됩니다.

