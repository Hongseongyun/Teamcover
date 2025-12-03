-- ============================================
-- 클럽 이름 변경: Teamcover -> 팀스트라이크
-- (id가 더 큰 것, 즉 나중에 생성된 것을 변경)
-- ============================================

-- 1. 나중에 생성된 Teamcover 클럽을 '팀스트라이크'로 변경
UPDATE clubs 
SET name = '팀스트라이크',
    description = '팀스트라이크 볼링 클럽',
    updated_at = CURRENT_TIMESTAMP
WHERE name = 'Teamcover' 
  AND id = (SELECT MAX(id) FROM clubs WHERE name = 'Teamcover');

-- 완료 메시지
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    IF updated_count > 0 THEN
        RAISE NOTICE '✅ 클럽 이름이 "팀스트라이크"로 변경되었습니다. (ID: %)', 
            (SELECT MAX(id) FROM clubs WHERE name = '팀스트라이크');
    ELSE
        RAISE NOTICE '⚠️ 변경할 클럽을 찾을 수 없습니다.';
    END IF;
END $$;
