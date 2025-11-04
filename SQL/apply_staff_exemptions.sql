-- ============================================
-- 현재 운영진 회원들의 1년 면제 일괄 적용 SQL
-- ============================================
-- 목적: 이미 운영진으로 설정되어 있지만 면제가 적용되지 않은 회원들에게 면제 적용
-- ============================================

-- 1. 현재 운영진 회원 확인
SELECT 
    m.id,
    m.name AS 회원명,
    m.is_staff AS 운영진여부
FROM members m
WHERE m.is_staff = True
ORDER BY m.name;

-- 2. 운영진 회원 중 면제가 없는 월 확인
SELECT 
    m.name AS 회원명,
    p.month AS 월,
    p.is_exempt AS 면제여부,
    p.note AS 비고
FROM members m
LEFT JOIN payments p ON p.member_id = m.id 
    AND p.payment_type = 'monthly' 
    AND p.month LIKE '2025-%'  -- 현재 연도 (필요시 변경)
WHERE m.is_staff = True
ORDER BY m.name, p.month;

-- 3. 운영진 회원들의 1년 면제 일괄 적용
-- 주의: 실행 전에 반드시 백업을 권장합니다!
DO $$
DECLARE
    member_record RECORD;
    month_num INTEGER;
    month_key TEXT;
    payment_date_val DATE;
    existing_payment_id INTEGER;
    current_year_val INTEGER := 2025;  -- 현재 연도 (필요시 변경)
BEGIN
    -- 현재 운영진인 모든 회원에 대해 처리
    FOR member_record IN 
        SELECT id, name FROM members WHERE is_staff = True
    LOOP
        RAISE NOTICE '운영진 회원 처리: % (ID: %)', member_record.name, member_record.id;
        
        -- 1월부터 12월까지 반복
        FOR month_num IN 1..12 LOOP
            month_key := current_year_val || '-' || LPAD(month_num::TEXT, 2, '0');
            payment_date_val := (month_key || '-01')::DATE;
            
            -- 해당 월의 납입 내역이 있는지 확인
            SELECT id INTO existing_payment_id
            FROM payments
            WHERE member_id = member_record.id
            AND payment_type = 'monthly'
            AND month = month_key;
            
            IF existing_payment_id IS NOT NULL THEN
                -- 기존 납입 내역이 있으면 면제로 설정
                UPDATE payments
                SET 
                    is_exempt = True,
                    is_paid = False,
                    note = CASE 
                        WHEN note IS NULL OR TRIM(note) = '' THEN '운영진 회비 면제'
                        WHEN note NOT LIKE '%운영진%' THEN TRIM(note) || ', 운영진 회비 면제'
                        ELSE note
                    END,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = existing_payment_id;
                
                RAISE NOTICE '  기존 납입 내역 업데이트: %', month_key;
            ELSE
                -- 납입 내역이 없으면 새로 생성 (면제 상태)
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
                    member_record.id,
                    'monthly',
                    5000,
                    payment_date_val,
                    month_key,
                    False,
                    True,
                    '운영진 회비 면제',
                    CURRENT_TIMESTAMP,
                    CURRENT_TIMESTAMP
                );
                
                RAISE NOTICE '  새 납입 내역 생성: %', month_key;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '운영진 회원 면제 적용 완료!';
END $$;

-- 4. 적용 결과 확인
SELECT 
    m.name AS 회원명,
    p.month AS 월,
    p.is_exempt AS 면제여부,
    p.note AS 비고
FROM members m
JOIN payments p ON p.member_id = m.id 
    AND p.payment_type = 'monthly' 
    AND p.month LIKE '2025-%'  -- 현재 연도
WHERE m.is_staff = True
    AND p.is_exempt = True
ORDER BY m.name, p.month;

-- ============================================
-- 간단한 방법: UPDATE만 사용 (납입 내역이 이미 있는 경우)
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
    AND p.month LIKE '2025-%'  -- 현재 연도
    AND EXISTS (
        SELECT 1 FROM members m
        WHERE m.id = p.member_id
        AND m.is_staff = True
    );
*/

