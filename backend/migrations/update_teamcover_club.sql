-- ============================================
-- 기존 데이터를 'Teamcover' 클럽으로 업데이트
-- (이미 '기본 클럽'으로 마이그레이션된 경우)
-- ============================================

-- 1. '기본 클럽'이 있으면 'Teamcover'로 이름 변경
UPDATE clubs 
SET name = 'Teamcover', 
    description = '기존 데이터를 위한 Teamcover 클럽'
WHERE name = '기본 클럽';

-- 2. 'Teamcover' 클럽이 없으면 생성
INSERT INTO clubs (name, description, is_points_enabled, created_at, updated_at)
SELECT 'Teamcover', '기존 데이터를 위한 Teamcover 클럽', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM clubs WHERE name = 'Teamcover');

-- 3. 기존 데이터를 Teamcover 클럽에 연결
UPDATE members 
SET club_id = (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1)
WHERE club_id IS NULL OR club_id != (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1);

UPDATE scores 
SET club_id = (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1)
WHERE club_id IS NULL OR club_id != (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1);

UPDATE points 
SET club_id = (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1)
WHERE club_id IS NULL OR club_id != (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1);

UPDATE payments 
SET club_id = (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1)
WHERE club_id IS NULL OR club_id != (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1);

UPDATE posts 
SET club_id = (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1)
WHERE club_id IS NULL OR club_id != (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1);

UPDATE fund_state 
SET club_id = (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1)
WHERE club_id IS NULL OR club_id != (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1);

UPDATE fund_ledger 
SET club_id = (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1)
WHERE club_id IS NULL OR club_id != (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1);

-- 4. 기존 사용자들을 Teamcover 클럽에 가입시킴 (이미 가입한 경우는 스킵)
INSERT INTO club_members (user_id, club_id, role, joined_at)
SELECT 
    u.id, 
    (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1),
    CASE 
        WHEN u.role = 'super_admin' THEN 'owner'
        WHEN u.role = 'admin' THEN 'admin'
        ELSE 'member'
    END,
    CURRENT_TIMESTAMP
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM club_members cm 
    WHERE cm.user_id = u.id 
    AND cm.club_id = (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1)
);

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ Teamcover 클럽으로 데이터 마이그레이션 완료';
END $$;

