-- 회비 및 포인트 월별 스냅샷 테이블 생성
-- 회비관리 페이지의 첫번째 섹션 계산 결과를 월별로 저장

CREATE TABLE IF NOT EXISTS fund_balance_snapshot (
    id SERIAL PRIMARY KEY,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    month VARCHAR(7) NOT NULL,  -- 'YYYY-MM' 형식
    fund_balance BIGINT NOT NULL DEFAULT 0,  -- 회비 잔액
    point_balance BIGINT NOT NULL DEFAULT 0,  -- 포인트 잔액
    credit BIGINT NOT NULL DEFAULT 0,  -- 적립
    debit BIGINT NOT NULL DEFAULT 0,  -- 소비
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 클럽별, 월별 유일성 보장
CREATE UNIQUE INDEX IF NOT EXISTS idx_fund_balance_snapshot_club_month 
ON fund_balance_snapshot(club_id, month);

-- 월별 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_fund_balance_snapshot_month 
ON fund_balance_snapshot(month);

-- 업데이트 시간 인덱스
CREATE INDEX IF NOT EXISTS idx_fund_balance_snapshot_updated_at 
ON fund_balance_snapshot(updated_at);

-- 코멘트 추가
COMMENT ON TABLE fund_balance_snapshot IS '회비 및 포인트 월별 스냅샷 테이블';
COMMENT ON COLUMN fund_balance_snapshot.club_id IS '클럽 ID';
COMMENT ON COLUMN fund_balance_snapshot.month IS '월 (YYYY-MM 형식)';
COMMENT ON COLUMN fund_balance_snapshot.fund_balance IS '해당 월 말일 기준 회비 잔액';
COMMENT ON COLUMN fund_balance_snapshot.point_balance IS '해당 월 말일 기준 포인트 잔액';
COMMENT ON COLUMN fund_balance_snapshot.credit IS '해당 월 적립 금액';
COMMENT ON COLUMN fund_balance_snapshot.debit IS '해당 월 소비 금액';
