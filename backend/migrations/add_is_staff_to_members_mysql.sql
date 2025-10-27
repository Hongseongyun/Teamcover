-- Members 테이블에 is_staff 컬럼 추가 (MySQL용)

-- is_staff 컬럼 추가 (운영진 여부, 기본값: false)
ALTER TABLE members 
ADD COLUMN is_staff BOOLEAN DEFAULT FALSE NOT NULL;

-- 기존 데이터에 대한 인덱스는 불필요하므로 추가하지 않음
