-- Payments 테이블에 is_exempt 컬럼 추가 (PostgreSQL용)

-- is_exempt 컬럼 추가 (면제 여부, 기본값: false)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS is_exempt BOOLEAN DEFAULT FALSE NOT NULL;

-- 코멘트 추가
COMMENT ON COLUMN payments.is_exempt IS '면제 여부 (TRUE: 면제, FALSE: 납입 대상)';

-- 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_payments_is_exempt ON payments(is_exempt);

