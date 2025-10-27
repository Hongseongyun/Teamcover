-- 납입 관리 테이블 생성 (MySQL 버전)
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    payment_type VARCHAR(20) NOT NULL,
    amount INT NOT NULL,
    payment_date DATE NOT NULL,
    month VARCHAR(10),
    is_paid BOOLEAN DEFAULT TRUE,
    note TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    
    INDEX idx_payments_member_id (member_id),
    INDEX idx_payments_payment_type (payment_type),
    INDEX idx_payments_month (month),
    INDEX idx_payments_payment_date (payment_date),
    INDEX idx_payments_is_paid (is_paid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='납입 관리 테이블';

-- 컬럼 코멘트 추가
ALTER TABLE payments MODIFY COLUMN id INT AUTO_INCREMENT COMMENT '납입 내역 ID (기본키)';
ALTER TABLE payments MODIFY COLUMN member_id INT COMMENT '회원 ID (외래키)';
ALTER TABLE payments MODIFY COLUMN payment_type VARCHAR(20) COMMENT '납입 유형 (monthly: 월회비, game: 정기전 게임비)';
ALTER TABLE payments MODIFY COLUMN amount INT COMMENT '납입 금액';
ALTER TABLE payments MODIFY COLUMN payment_date DATE COMMENT '납입일';
ALTER TABLE payments MODIFY COLUMN month VARCHAR(10) COMMENT '월 (YYYY-MM 형식, 검색/통계용)';
ALTER TABLE payments MODIFY COLUMN is_paid BOOLEAN COMMENT '납입 여부 (TRUE: 완료, FALSE: 미납)';
ALTER TABLE payments MODIFY COLUMN note TEXT COMMENT '비고';
ALTER TABLE payments MODIFY COLUMN created_at TIMESTAMP COMMENT '등록 시간';
ALTER TABLE payments MODIFY COLUMN updated_at TIMESTAMP COMMENT '수정 시간';

