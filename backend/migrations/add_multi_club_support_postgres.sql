-- ============================================
-- 다중 클럽 지원 마이그레이션 스크립트 (PostgreSQL)
-- ============================================

-- 1. Club 테이블 생성
CREATE TABLE IF NOT EXISTS clubs (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_points_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER,
    CONSTRAINT fk_clubs_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 2. ClubMember 테이블 생성 (사용자-클럽 다대다 관계)
CREATE TABLE IF NOT EXISTS club_members (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    club_id INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_club_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_club_members_club FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE CASCADE,
    CONSTRAINT unique_user_club UNIQUE(user_id, club_id),
    CONSTRAINT check_role CHECK (role IN ('member', 'admin', 'owner'))
);

-- 3. 기존 테이블에 club_id 컬럼 추가 (이미 존재하는 경우 스킵)
DO $$ 
BEGIN
    -- members 테이블에 club_id 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='members' AND column_name='club_id') THEN
        ALTER TABLE members ADD COLUMN club_id INTEGER;
    END IF;
    
    -- scores 테이블에 club_id 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='scores' AND column_name='club_id') THEN
        ALTER TABLE scores ADD COLUMN club_id INTEGER;
    END IF;
    
    -- points 테이블에 club_id 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='points' AND column_name='club_id') THEN
        ALTER TABLE points ADD COLUMN club_id INTEGER;
    END IF;
    
    -- payments 테이블에 club_id 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='payments' AND column_name='club_id') THEN
        ALTER TABLE payments ADD COLUMN club_id INTEGER;
    END IF;
    
    -- posts 테이블에 club_id 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='posts' AND column_name='club_id') THEN
        ALTER TABLE posts ADD COLUMN club_id INTEGER;
    END IF;
    
    -- fund_state 테이블에 club_id 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='fund_state' AND column_name='club_id') THEN
        ALTER TABLE fund_state ADD COLUMN club_id INTEGER;
    END IF;
    
    -- fund_ledger 테이블에 club_id 추가
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='fund_ledger' AND column_name='club_id') THEN
        ALTER TABLE fund_ledger ADD COLUMN club_id INTEGER;
    END IF;
END $$;

-- 4. 기본 클럽 생성 (이미 존재하지 않는 경우에만) - 'Teamcover' 클럽으로 생성
INSERT INTO clubs (name, description, is_points_enabled, created_at, updated_at)
SELECT 'Teamcover', '기존 데이터를 위한 Teamcover 클럽', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM clubs WHERE name = 'Teamcover');

-- 5. 기존 데이터를 Teamcover 클럽에 연결 (서브쿼리 사용)
UPDATE members 
SET club_id = (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1)
WHERE club_id IS NULL;

UPDATE scores 
SET club_id = (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1)
WHERE club_id IS NULL;

UPDATE points 
SET club_id = (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1)
WHERE club_id IS NULL;

UPDATE payments 
SET club_id = (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1)
WHERE club_id IS NULL;

UPDATE posts 
SET club_id = (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1)
WHERE club_id IS NULL;

UPDATE fund_state 
SET club_id = (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1)
WHERE club_id IS NULL;

UPDATE fund_ledger 
SET club_id = (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1)
WHERE club_id IS NULL;

-- 6. 기존 사용자들을 Teamcover 클럽에 가입시킴
INSERT INTO club_members (user_id, club_id, role, joined_at)
SELECT 
    u.id, 
    (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1),
    CASE 
        WHEN u.role = 'super_admin' THEN 'owner'
        WHEN u.role = 'admin' THEN 'admin'
        ELSE 'member'
    END,
    CURRENT_TIMESTAMP
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM club_members cm 
    WHERE cm.user_id = u.id 
    AND cm.club_id = (SELECT id FROM clubs WHERE name = 'Teamcover' LIMIT 1)
);

-- 8. 외래키 제약조건 추가 (club_id에 대한)
DO $$
BEGIN
    -- members 테이블 외래키
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_members_club'
    ) THEN
        ALTER TABLE members 
        ADD CONSTRAINT fk_members_club 
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL;
    END IF;
    
    -- scores 테이블 외래키
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_scores_club'
    ) THEN
        ALTER TABLE scores 
        ADD CONSTRAINT fk_scores_club 
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL;
    END IF;
    
    -- points 테이블 외래키
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_points_club'
    ) THEN
        ALTER TABLE points 
        ADD CONSTRAINT fk_points_club 
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL;
    END IF;
    
    -- payments 테이블 외래키
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_payments_club'
    ) THEN
        ALTER TABLE payments 
        ADD CONSTRAINT fk_payments_club 
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL;
    END IF;
    
    -- posts 테이블 외래키
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_posts_club'
    ) THEN
        ALTER TABLE posts 
        ADD CONSTRAINT fk_posts_club 
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL;
    END IF;
    
    -- fund_state 테이블 외래키
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_fund_state_club'
    ) THEN
        ALTER TABLE fund_state 
        ADD CONSTRAINT fk_fund_state_club 
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL;
    END IF;
    
    -- fund_ledger 테이블 외래키
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_fund_ledger_club'
    ) THEN
        ALTER TABLE fund_ledger 
        ADD CONSTRAINT fk_fund_ledger_club 
        FOREIGN KEY (club_id) REFERENCES clubs(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 9. 인덱스 생성 (성능 향상)
CREATE INDEX IF NOT EXISTS idx_members_club_id ON members(club_id);
CREATE INDEX IF NOT EXISTS idx_scores_club_id ON scores(club_id);
CREATE INDEX IF NOT EXISTS idx_points_club_id ON points(club_id);
CREATE INDEX IF NOT EXISTS idx_payments_club_id ON payments(club_id);
CREATE INDEX IF NOT EXISTS idx_posts_club_id ON posts(club_id);
CREATE INDEX IF NOT EXISTS idx_fund_state_club_id ON fund_state(club_id);
CREATE INDEX IF NOT EXISTS idx_fund_ledger_club_id ON fund_ledger(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user_id ON club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_club_members_club_id ON club_members(club_id);

-- 10. updated_at 자동 업데이트 트리거 함수 (clubs 테이블용)
CREATE OR REPLACE FUNCTION update_clubs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_update_clubs_updated_at ON clubs;
CREATE TRIGGER trigger_update_clubs_updated_at
    BEFORE UPDATE ON clubs
    FOR EACH ROW
    EXECUTE FUNCTION update_clubs_updated_at();

-- 마이그레이션 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '✅ 다중 클럽 지원 마이그레이션이 완료되었습니다.';
    RAISE NOTICE '   - clubs 테이블 생성 완료';
    RAISE NOTICE '   - club_members 테이블 생성 완료';
    RAISE NOTICE '   - 기존 테이블에 club_id 컬럼 추가 완료';
    RAISE NOTICE '   - 기본 클럽 생성 및 데이터 마이그레이션 완료';
    RAISE NOTICE '   - 외래키 제약조건 및 인덱스 생성 완료';
END $$;

