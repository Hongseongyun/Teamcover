-- 회원 테이블에 is_deleted 컬럼 추가 (Soft Delete 지원)
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- 기존 데이터는 모두 삭제되지 않은 상태로 설정
UPDATE members SET is_deleted = FALSE WHERE is_deleted IS NULL;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_members_is_deleted ON members(is_deleted);

