-- 회비 잔액 및 그래프 데이터 캐시 테이블 생성
-- 장부 변경 시마다 계산된 결과를 저장하여 프론트엔드 로딩 속도 향상

CREATE TABLE IF NOT EXISTS fund_balance_cache (
    id SERIAL PRIMARY KEY,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    current_balance BIGINT NOT NULL DEFAULT 0,
    balance_series JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- balance_series 구조:
    -- {
    --   "labels": ["2025-11", "2025-12", ...],
    --   "paymentBalances": [100000, 150000, ...],
    --   "credits": [50000, 30000, ...],
    --   "debits": [20000, 40000, ...],
    --   "pointBalances": [10000, 15000, ...]
    -- }
    last_calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 클럽별로 하나의 캐시만 유지
CREATE UNIQUE INDEX IF NOT EXISTS idx_fund_balance_cache_club_id 
ON fund_balance_cache(club_id);

-- 업데이트 시간 인덱스 (최신 캐시 확인용)
CREATE INDEX IF NOT EXISTS idx_fund_balance_cache_updated_at 
ON fund_balance_cache(updated_at);

-- 코멘트 추가
COMMENT ON TABLE fund_balance_cache IS '회비 잔액 및 그래프 데이터 캐시 테이블';
COMMENT ON COLUMN fund_balance_cache.club_id IS '클럽 ID';
COMMENT ON COLUMN fund_balance_cache.current_balance IS '현재 회비 잔액';
COMMENT ON COLUMN fund_balance_cache.balance_series IS '그래프 데이터 (JSON)';
COMMENT ON COLUMN fund_balance_cache.last_calculated_at IS '마지막 계산 시간';

