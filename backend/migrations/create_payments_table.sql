-- 납입 관리 테이블 생성
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    payment_type VARCHAR(20) NOT NULL,
    amount INTEGER NOT NULL,
    payment_date DATE NOT NULL,
    month VARCHAR(10),
    is_paid BOOLEAN DEFAULT TRUE,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_payments_member_id ON payments(member_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_is_paid ON payments(is_paid);

-- 코멘트 추가
COMMENT ON TABLE payments IS '납입 관리 테이블';
COMMENT ON COLUMN payments.id IS '납입 내역 ID (기본키)';
COMMENT ON COLUMN payments.member_id IS '회원 ID (외래키)';
COMMENT ON COLUMN payments.payment_type IS '납입 유형 (monthly: 월회비, game: 정기전 게임비)';
COMMENT ON COLUMN payments.amount IS '납입 금액';
COMMENT ON COLUMN payments.payment_date IS '납입일';
COMMENT ON COLUMN payments.month IS '월 (YYYY-MM 형식, 검색/통계용)';
COMMENT ON COLUMN payments.is_paid IS '납입 여부 (TRUE: 완료, FALSE: 미납)';
COMMENT ON COLUMN payments.note IS '비고';
COMMENT ON COLUMN payments.created_at IS '등록 시간';
COMMENT ON COLUMN payments.updated_at IS '수정 시간';

