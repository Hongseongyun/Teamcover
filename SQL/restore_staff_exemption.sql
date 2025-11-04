-- ============================================
-- 운영진 면제 복구 SQL (1년 면제로 되돌리기)
-- ============================================
-- 목적: 운영진 해제로 인해 면제가 해제된 회원을 원래의 1년 면제 상태로 복구
-- ============================================

-- 1. 현재 상황 확인 (실행 전 확인용)
-- 특정 회원의 현재 납입 내역 확인
SELECT 
    p.id,
    p.month AS 월,
    p.is_exempt AS 면제여부,
    p.is_paid AS 납입여부,
    p.note AS 비고,
    p.updated_at AS 수정일시
FROM payments p
JOIN members m ON p.member_id = m.id
WHERE 
    m.name = '회원명'  -- 여기에 실제 회원명 입력
    AND p.payment_type = 'monthly'
    AND p.month LIKE '2025-%'  -- 현재 연도 (필요시 변경)
ORDER BY p.month;

-- 2. 복구 작업 (현재 연도 전체를 면제로 복구)
-- 주의: 실행 전에 반드시 백업을 권장합니다!
-- 
-- 방법 1: 특정 회원 지정 (가장 안전)
UPDATE payments p
SET 
    is_exempt = True,
    is_paid = False,
    note = CASE 
        WHEN p.note IS NULL OR TRIM(p.note) = '' THEN '운영진 회비 면제'
        WHEN p.note NOT LIKE '%운영진%' THEN TRIM(p.note) || ', 운영진 회비 면제'
        ELSE p.note
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE 
    p.payment_type = 'monthly'
    AND p.is_exempt = False  -- 현재 면제 해제된 상태
    AND p.month LIKE '2025-%'  -- 현재 연도 (필요시 변경)
    AND p.member_id = (
        SELECT id FROM members WHERE name = '회원명'  -- 여기에 실제 회원명 입력
    );

-- 3. 복구 후 확인 (실행 후 검증용)
SELECT 
    p.id,
    p.month AS 월,
    p.is_exempt AS 면제여부,
    p.is_paid AS 납입여부,
    p.note AS 비고,
    p.updated_at AS 수정일시
FROM payments p
JOIN members m ON p.member_id = m.id
WHERE 
    m.name = '회원명'  -- 여기에 실제 회원명 입력
    AND p.payment_type = 'monthly'
    AND p.month LIKE '2025-%'  -- 현재 연도
ORDER BY p.month;

-- ============================================
-- 방법 2: 특정 월만 복구 (예: 12월만)
-- ============================================
/*
UPDATE payments p
SET 
    is_exempt = True,
    is_paid = False,
    note = CASE 
        WHEN p.note IS NULL OR TRIM(p.note) = '' THEN '운영진 회비 면제'
        WHEN p.note NOT LIKE '%운영진%' THEN TRIM(p.note) || ', 운영진 회비 면제'
        ELSE p.note
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE 
    p.payment_type = 'monthly'
    AND p.is_exempt = False
    AND p.month = '2025-12'  -- 특정 월만 복구
    AND p.member_id = (
        SELECT id FROM members WHERE name = '회원명'  -- 여기에 실제 회원명 입력
    );
*/

-- ============================================
-- 방법 3: 여러 회원 일괄 복구 (주의 필요)
-- ============================================
-- 운영진이었던 모든 회원의 면제 복구
/*
UPDATE payments p
SET 
    is_exempt = True,
    is_paid = False,
    note = CASE 
        WHEN p.note IS NULL OR TRIM(p.note) = '' THEN '운영진 회비 면제'
        WHEN p.note NOT LIKE '%운영진%' THEN TRIM(p.note) || ', 운영진 회비 면제'
        ELSE p.note
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE 
    p.payment_type = 'monthly'
    AND p.is_exempt = False
    AND p.month LIKE '2025-%'  -- 현재 연도
    AND EXISTS (
        -- note에 '운영진'이 포함된 다른 달의 면제가 있는 회원만
        SELECT 1 
        FROM payments p2 
        WHERE p2.member_id = p.member_id 
        AND p2.payment_type = 'monthly'
        AND p2.is_exempt = True
        AND p2.note LIKE '%운영진%'
        LIMIT 1
    );
*/

-- ============================================
-- 방법 4: 납입 내역이 없는 월에 새로 생성
-- ============================================
-- 특정 회원의 2025년 전체 월에 대해 납입 내역이 없으면 생성
/*
DO $$
DECLARE
    member_id_val INTEGER;
    month_val TEXT;
    payment_date_val DATE;
BEGIN
    -- 회원 ID 가져오기
    SELECT id INTO member_id_val FROM members WHERE name = '회원명';  -- 여기에 실제 회원명 입력
    
    -- 1월부터 12월까지 반복
    FOR month_num IN 1..12 LOOP
        month_val := '2025-' || LPAD(month_num::TEXT, 2, '0');
        payment_date_val := (month_val || '-01')::DATE;
        
        -- 해당 월의 납입 내역이 없으면 생성
        IF NOT EXISTS (
            SELECT 1 FROM payments 
            WHERE member_id = member_id_val 
            AND payment_type = 'monthly' 
            AND month = month_val
        ) THEN
            INSERT INTO payments (
                member_id, 
                payment_type, 
                amount, 
                payment_date, 
                month, 
                is_paid, 
                is_exempt, 
                note,
                created_at,
                updated_at
            ) VALUES (
                member_id_val,
                'monthly',
                5000,
                payment_date_val,
                month_val,
                False,
                True,
                '운영진 회비 면제',
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            );
        END IF;
    END LOOP;
END $$;
*/

