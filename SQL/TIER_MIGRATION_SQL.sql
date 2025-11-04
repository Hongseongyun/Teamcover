-- 티어 시스템 마이그레이션 SQL
-- 실행 순서대로 실행해주세요

-- 1. members 테이블에 tier 컬럼 추가
ALTER TABLE members 
ADD COLUMN tier VARCHAR(20) NULL;

-- 2. scores 테이블에 시즌 정보 컬럼 추가
ALTER TABLE scores 
ADD COLUMN is_regular_season BOOLEAN DEFAULT TRUE;

ALTER TABLE scores 
ADD COLUMN season_year INTEGER NULL;

ALTER TABLE scores 
ADD COLUMN season_half VARCHAR(10) NULL;

-- 3. 기존 스코어에 시즌 정보 설정
-- 상반기 (1-6월) 스코어 업데이트
UPDATE scores 
SET 
    season_year = EXTRACT(YEAR FROM game_date),
    season_half = 'first_half',
    is_regular_season = TRUE
WHERE EXTRACT(MONTH FROM game_date) BETWEEN 1 AND 6;

-- 하반기 (7-12월) 스코어 업데이트
UPDATE scores 
SET 
    season_year = EXTRACT(YEAR FROM game_date),
    season_half = 'second_half',
    is_regular_season = TRUE
WHERE EXTRACT(MONTH FROM game_date) BETWEEN 7 AND 12;

-- 4. 기존 level 데이터를 tier로 마이그레이션 (레거시 호환성)
UPDATE members 
SET tier = CASE 
    WHEN level = '초급' THEN '아이언'
    WHEN level = '중급' THEN '브론즈'
    WHEN level = '고급' THEN '실버'
    WHEN level = '프로' THEN '골드'
    ELSE '배치'
END
WHERE tier IS NULL;

-- 5. level이 없는 회원들을 배치로 설정
UPDATE members 
SET tier = '배치'
WHERE tier IS NULL;

-- 6. 마이그레이션 완료 확인 쿼리
-- 회원별 티어 분포 확인
SELECT 
    tier,
    COUNT(*) as count
FROM members 
GROUP BY tier 
ORDER BY 
    CASE tier
        WHEN '배치' THEN 0
        WHEN '아이언' THEN 1
        WHEN '브론즈' THEN 2
        WHEN '실버' THEN 3
        WHEN '골드' THEN 4
        WHEN '플레티넘' THEN 5
        WHEN '다이아' THEN 6
        WHEN '마스터' THEN 7
        WHEN '챌린저' THEN 8
    END;

-- 스코어 시즌 정보 설정 확인
SELECT 
    season_year,
    season_half,
    COUNT(*) as count
FROM scores 
WHERE is_regular_season = TRUE
GROUP BY season_year, season_half
ORDER BY season_year DESC, season_half;
