-- ============================================
-- 기존 사용자들이 Teamcover 클럽에 가입되어 있는지 확인 및 추가
-- ============================================

-- 1. Teamcover 클럽 ID 확인
DO $$
DECLARE
    teamcover_club_id INTEGER;
    users_count INTEGER;
    members_count INTEGER;
BEGIN
    -- Teamcover 클럽 찾기
    SELECT id INTO teamcover_club_id 
    FROM clubs 
    WHERE name = 'Teamcover' 
    LIMIT 1;

    IF teamcover_club_id IS NULL THEN
        RAISE NOTICE '⚠️ Teamcover 클럽을 찾을 수 없습니다.';
        RETURN;
    END IF;

    RAISE NOTICE '✅ Teamcover 클럽 ID: %', teamcover_club_id;

    -- 전체 사용자 수 확인
    SELECT COUNT(*) INTO users_count FROM users;
    RAISE NOTICE '전체 사용자 수: %', users_count;

    -- Teamcover에 가입한 사용자 수 확인
    SELECT COUNT(*) INTO members_count 
    FROM club_members 
    WHERE club_id = teamcover_club_id;
    RAISE NOTICE 'Teamcover 가입 사용자 수: %', members_count;

    -- 2. Teamcover에 가입하지 않은 사용자들을 가입시킴
    INSERT INTO club_members (user_id, club_id, role, joined_at)
    SELECT 
        u.id, 
        teamcover_club_id,
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
        AND cm.club_id = teamcover_club_id
    );

    GET DIAGNOSTICS users_count = ROW_COUNT;
    
    IF users_count > 0 THEN
        RAISE NOTICE '✅ %명의 사용자가 Teamcover 클럽에 가입되었습니다.', users_count;
    ELSE
        RAISE NOTICE '✅ 모든 사용자가 이미 Teamcover 클럽에 가입되어 있습니다.';
    END IF;

    -- 최종 확인
    SELECT COUNT(*) INTO members_count 
    FROM club_members 
    WHERE club_id = teamcover_club_id;
    RAISE NOTICE '최종 Teamcover 가입 사용자 수: %', members_count;

END $$;

