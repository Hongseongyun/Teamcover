-- ============================================
-- 클럽 이름 수정 및 데이터 마이그레이션
-- 1. 첫 번째 클럽(id=1) -> 'Teamcover'로 설정
-- 2. 두 번째 클럽(id=2) -> 'Teamstrike'로 설정
-- 3. 기존 데이터는 모두 Teamcover(id=1)로 연결
-- ============================================

-- 1. 첫 번째 클럽(id=1)을 'Teamcover'로 설정
UPDATE clubs 
SET name = 'Teamcover',
    description = '기존 데이터를 위한 Teamcover 클럽',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 1;

-- 2. 두 번째 클럽(id=2)을 'Teamstrike'로 설정
UPDATE clubs 
SET name = 'Teamstrike',
    description = 'Teamstrike 볼링 클럽',
    updated_at = CURRENT_TIMESTAMP
WHERE id = 2;

-- 3. 기존 데이터를 모두 Teamcover(id=1)로 연결
-- (현재 club_id가 2인 모든 데이터를 1로 변경)

UPDATE members 
SET club_id = 1 
WHERE club_id = 2;

UPDATE scores 
SET club_id = 1 
WHERE club_id = 2;

UPDATE points 
SET club_id = 1 
WHERE club_id = 2;

UPDATE payments 
SET club_id = 1 
WHERE club_id = 2;

UPDATE posts 
SET club_id = 1 
WHERE club_id = 2;

UPDATE fund_state 
SET club_id = 1 
WHERE club_id = 2;

UPDATE fund_ledger 
SET club_id = 1 
WHERE club_id = 2;

-- 4. club_members 테이블에서 club_id=2인 멤버십을 club_id=1로 변경
-- (단, 같은 user_id가 이미 club_id=1에 가입되어 있으면 중복 방지를 위해 삭제)
UPDATE club_members cm1
SET club_id = 1
WHERE club_id = 2
  AND NOT EXISTS (
    SELECT 1 FROM club_members cm2 
    WHERE cm2.user_id = cm1.user_id 
      AND cm2.club_id = 1
  );

-- 중복된 멤버십 삭제 (club_id=2에 남아있는 것들)
DELETE FROM club_members 
WHERE club_id = 2;

-- 완료 메시지
DO $$
DECLARE
    teamcover_count INTEGER;
    teamstrike_count INTEGER;
BEGIN
    -- Teamcover 클럽 확인
    SELECT COUNT(*) INTO teamcover_count FROM clubs WHERE id = 1 AND name = 'Teamcover';
    
    -- Teamstrike 클럽 확인
    SELECT COUNT(*) INTO teamstrike_count FROM clubs WHERE id = 2 AND name = 'Teamstrike';
    
    IF teamcover_count > 0 AND teamstrike_count > 0 THEN
        RAISE NOTICE '✅ 클럽 이름 수정 및 데이터 마이그레이션이 완료되었습니다.';
        RAISE NOTICE '   - 첫 번째 클럽(id=1): Teamcover';
        RAISE NOTICE '   - 두 번째 클럽(id=2): Teamstrike';
        RAISE NOTICE '   - 기존 데이터는 모두 Teamcover로 연결되었습니다.';
    ELSE
        RAISE NOTICE '⚠️ 클럽 이름 수정 중 오류가 발생했을 수 있습니다.';
    END IF;
END $$;

