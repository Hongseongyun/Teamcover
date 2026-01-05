-- 회원등급(member_role) 컬럼 추가 마이그레이션
-- 실행 날짜: 2026-01-05

-- 1. member_role 컬럼 추가
ALTER TABLE members 
ADD COLUMN IF NOT EXISTS member_role VARCHAR(20) DEFAULT 'regular';

-- 2. 기존 데이터 마이그레이션
-- is_staff가 true인 경우 'staff'로, false인 경우 'regular'로 설정
UPDATE members 
SET member_role = CASE 
    WHEN is_staff = true THEN 'staff'
    ELSE 'regular'
END
WHERE member_role IS NULL;

-- 3. NOT NULL 제약조건 추가 (기본값이 있으므로 안전)
ALTER TABLE members 
ALTER COLUMN member_role SET NOT NULL;

-- 4. 기본값 명시적 설정 (향후 추가되는 레코드용)
ALTER TABLE members 
ALTER COLUMN member_role SET DEFAULT 'regular';

-- 5. (선택사항) 인덱스 추가 (회원등급으로 필터링하는 경우 성능 향상)
CREATE INDEX IF NOT EXISTS idx_members_member_role ON members(member_role);

-- 마이그레이션 완료 확인
SELECT 
    COUNT(*) as total_members,
    COUNT(CASE WHEN member_role = 'regular' THEN 1 END) as regular_members,
    COUNT(CASE WHEN member_role = 'staff' THEN 1 END) as staff_members,
    COUNT(CASE WHEN member_role = 'club_leader' THEN 1 END) as club_leader_members,
    COUNT(CASE WHEN member_role IS NULL THEN 1 END) as null_members
FROM members;

