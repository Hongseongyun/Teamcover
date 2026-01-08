-- 클럽 홍보 관련 필드 추가
-- 클럽 사진 URL 저장
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 클럽 해시태그 저장 (JSON 배열 형태)
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS hashtags JSONB DEFAULT '[]'::jsonb;

-- 해시태그 인덱스 추가 (검색 성능 향상)
CREATE INDEX IF NOT EXISTS idx_clubs_hashtags ON clubs USING GIN (hashtags);

-- 클럽 상세 설명 (홍보 페이지용)
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS promotion_description TEXT;

