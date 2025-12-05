-- 메시지 테이블에 is_deleted 컬럼 추가
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 기존 메시지들은 삭제되지 않은 상태로 설정
UPDATE messages SET is_deleted = FALSE WHERE is_deleted IS NULL;

