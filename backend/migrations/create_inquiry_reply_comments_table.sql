-- 문의 답변 댓글 테이블 생성
CREATE TABLE IF NOT EXISTS inquiry_reply_comments (
    id SERIAL PRIMARY KEY,
    inquiry_id INTEGER NOT NULL REFERENCES inquiries(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inquiry_reply_comments_inquiry_id ON inquiry_reply_comments(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_reply_comments_user_id ON inquiry_reply_comments(user_id);


