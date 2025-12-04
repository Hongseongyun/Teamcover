-- 클럽 멤버 가입 승인 시스템을 위한 마이그레이션
-- ClubMember 테이블에 status, requested_at, approved_at, approved_by 컬럼 추가

-- status 컬럼 추가 (기본값: 'approved' - 기존 데이터는 모두 승인된 것으로 처리)
ALTER TABLE club_members 
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'approved';

-- requested_at 컬럼 추가 (가입 요청 시간)
ALTER TABLE club_members 
ADD COLUMN IF NOT EXISTS requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- approved_at 컬럼 추가 (승인 시간)
ALTER TABLE club_members 
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL;

-- approved_by 컬럼 추가 (승인한 사용자 ID)
ALTER TABLE club_members 
ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id);

-- 기존 데이터의 requested_at를 joined_at로 설정
UPDATE club_members 
SET requested_at = joined_at 
WHERE requested_at IS NULL;

-- 기존 데이터의 approved_at를 joined_at로 설정 (이미 가입된 것으로 간주)
UPDATE club_members 
SET approved_at = joined_at 
WHERE approved_at IS NULL AND status = 'approved';

-- 인덱스 추가 (승인 대기 요청 조회 성능 향상)
CREATE INDEX IF NOT EXISTS idx_club_members_status ON club_members(status);
CREATE INDEX IF NOT EXISTS idx_club_members_club_status ON club_members(club_id, status);

