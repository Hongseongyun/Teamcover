-- 댓글 대댓글 및 좋아요 기능 추가 (PostgreSQL)

-- Comment 테이블에 parent_id 컬럼 추가
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id INTEGER;
ALTER TABLE comments ADD CONSTRAINT fk_comments_parent 
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE;

-- CommentLike 테이블 생성
CREATE TABLE IF NOT EXISTS comment_likes (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id);

