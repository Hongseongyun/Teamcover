-- 클럽 즐겨찾기 테이블 생성
CREATE TABLE IF NOT EXISTS club_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    club_id INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
    UNIQUE (user_id, club_id)
);

CREATE INDEX IF NOT EXISTS idx_club_favorites_user_id ON club_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_club_favorites_club_id ON club_favorites(club_id);

