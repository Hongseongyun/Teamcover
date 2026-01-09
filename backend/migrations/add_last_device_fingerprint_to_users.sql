-- users 테이블에 last_device_fingerprint 컬럼 추가
-- 마지막 로그인한 기기 식별자 (User-Agent + IP 해시)

ALTER TABLE users 
ADD COLUMN last_device_fingerprint VARCHAR(64) NULL;

