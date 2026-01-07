-- 일정 관리 테이블 생성 (PostgreSQL)

-- 일정 테이블
CREATE TABLE IF NOT EXISTS schedules (
    id SERIAL PRIMARY KEY,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    schedule_type VARCHAR(20) NOT NULL CHECK (schedule_type IN ('regular', 'meeting', 'event')),
    title VARCHAR(200) NOT NULL,
    date DATE NOT NULL,
    time TIME NOT NULL,
    max_participants INTEGER NOT NULL DEFAULT 18,
    description TEXT,
    is_recurring BOOLEAN DEFAULT FALSE,
    recurring_config JSONB, -- 정기전 설정: { "day_of_week": 1, "week_type": "all|even|odd", "frequency": 4 }
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedules_club_id ON schedules(club_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);
CREATE INDEX IF NOT EXISTS idx_schedules_type ON schedules(schedule_type);
CREATE INDEX IF NOT EXISTS idx_schedules_recurring ON schedules(is_recurring);

-- 참석 테이블
CREATE TABLE IF NOT EXISTS schedule_attendances (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'attending' CHECK (status IN ('attending', 'rejected')),
    rejected_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    rejected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(schedule_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_attendances_schedule_id ON schedule_attendances(schedule_id);
CREATE INDEX IF NOT EXISTS idx_attendances_member_id ON schedule_attendances(member_id);
CREATE INDEX IF NOT EXISTS idx_attendances_status ON schedule_attendances(status);

-- updated_at 자동 업데이트를 위한 트리거 함수 (이미 존재할 수 있음)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- schedules 테이블 updated_at 트리거
DROP TRIGGER IF EXISTS update_schedules_updated_at ON schedules;
CREATE TRIGGER update_schedules_updated_at
    BEFORE UPDATE ON schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- schedule_attendances 테이블 updated_at 트리거
DROP TRIGGER IF EXISTS update_schedule_attendances_updated_at ON schedule_attendances;
CREATE TRIGGER update_schedule_attendances_updated_at
    BEFORE UPDATE ON schedule_attendances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

