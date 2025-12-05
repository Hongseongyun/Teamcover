-- Inquiry 모델에 club_id, reply, replied_by, replied_at 필드 추가
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS club_id INTEGER REFERENCES clubs(id);
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS reply TEXT;
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS replied_by INTEGER REFERENCES users(id);
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS replied_at TIMESTAMP;


