-- is_staff 컬럼 제거 및 member_role로 통합 마이그레이션
-- 실행 날짜: 2026-01-05

-- 1. is_staff가 true인 회원들의 member_role을 'staff'로 업데이트
-- (member_role이 이미 'club_leader'인 경우는 제외)
UPDATE members 
SET member_role = 'staff'
WHERE is_staff = true 
  AND (member_role IS NULL OR member_role = 'regular');

-- 2. member_role이 NULL인 경우 'regular'로 설정
UPDATE members 
SET member_role = 'regular'
WHERE member_role IS NULL;

-- 3. member_role에 NOT NULL 제약조건 추가 (이미 기본값이 있으므로 안전)
ALTER TABLE members 
ALTER COLUMN member_role SET NOT NULL;

-- 4. is_staff 컬럼 삭제
ALTER TABLE members 
DROP COLUMN IF EXISTS is_staff;

-- 마이그레이션 완료 확인
SELECT 
    COUNT(*) as total_members,
    COUNT(CASE WHEN member_role = 'club_leader' THEN 1 END) as club_leader_members,
    COUNT(CASE WHEN member_role = 'staff' THEN 1 END) as staff_members,
    COUNT(CASE WHEN member_role = 'regular' THEN 1 END) as regular_members,
    COUNT(CASE WHEN member_role IS NULL THEN 1 END) as null_members
FROM members;

