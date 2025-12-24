-- 문의 답변 댓글에 parent_id 필드 추가 (답글 기능)
ALTER TABLE inquiry_reply_comments 
ADD COLUMN parent_id INTEGER REFERENCES inquiry_reply_comments(id) ON DELETE CASCADE;

-- 문의 답변 댓글 좋아요 테이블 생성
CREATE TABLE IF NOT EXISTS inquiry_reply_comment_likes (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL REFERENCES inquiry_reply_comments(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(comment_id, user_id)
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_inquiry_reply_comment_likes_comment_id ON inquiry_reply_comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_reply_comment_likes_user_id ON inquiry_reply_comment_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_inquiry_reply_comments_parent_id ON inquiry_reply_comments(parent_id);

