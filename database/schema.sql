-- ═══════════════════════════════════════════════════════════════════════════
-- ATYLLA PRO — Supabase (PostgreSQL) Schema v2.0.0
-- Multi-trainer support: each trainer has isolated data via trainer_id
-- ═══════════════════════════════════════════════════════════════════════════
-- NOTE: Uses gen_random_uuid() — available in Supabase by default (pgcrypto)
--       Paste this entire file into Supabase SQL Editor and click RUN
--       For NEW trainers, run seed_new_trainer.sql with their UUID after
--       creating the user in Supabase Auth.
-- ═══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. CONFIGURATION TABLES
-- ============================================================================

-- Workout types (RodzajeTreningu)
CREATE TABLE workout_types (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    trainer_id  UUID NOT NULL REFERENCES auth.users(id),
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(name, trainer_id)
);

-- Muscle groups / body parts (Partie)
CREATE TABLE muscle_groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    trainer_id  UUID NOT NULL REFERENCES auth.users(id),
    created_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE(name, trainer_id)
);

-- Exercises (Cwiczenia)
CREATE TABLE exercises (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    muscle_group_id UUID NOT NULL REFERENCES muscle_groups(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    unit            TEXT DEFAULT 'KG',
    trainer_id      UUID NOT NULL REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(muscle_group_id, name)
);

-- ============================================================================
-- 2. TRAINING PLANS
-- ============================================================================

CREATE TABLE training_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    workout_type_id UUID REFERENCES workout_types(id) ON DELETE SET NULL,
    trainer_id      UUID NOT NULL REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(name, trainer_id)
);

CREATE TABLE plan_exercises (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id         UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
    exercise_id     UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    sort_order      INT NOT NULL DEFAULT 0,
    sets_data       JSONB DEFAULT '[]'::JSONB,
    trainer_id      UUID NOT NULL REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(plan_id, exercise_id)
);

-- ============================================================================
-- 3. CLIENTS (Klienci)
-- ============================================================================

CREATE TABLE clients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    phone           TEXT,
    join_date       DATE,
    notes           TEXT,
    email           TEXT,
    default_workout_type_id UUID REFERENCES workout_types(id) ON DELETE SET NULL,
    default_plan_id UUID REFERENCES training_plans(id) ON DELETE SET NULL,
    strength_progression JSONB DEFAULT '[]'::JSONB,
    training_schedule JSONB DEFAULT '[]'::JSONB,
    billing_type            TEXT DEFAULT 'package',
    package_purchase_date   DATE,
    package_size            INT DEFAULT 10,
    package_current_count   INT DEFAULT 0,
    payment_history         JSONB DEFAULT '[]'::JSONB,
    trainer_id      UUID NOT NULL REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clients_name ON clients(name);
CREATE INDEX idx_clients_trainer ON clients(trainer_id);

-- ============================================================================
-- 4. CALENDAR / SCHEDULE (Kalendarz)
-- ============================================================================

CREATE TABLE calendar_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_date      DATE NOT NULL,
    event_hour      INT NOT NULL CHECK (event_hour >= 6 AND event_hour <= 21),
    client_id       UUID REFERENCES clients(id) ON DELETE SET NULL,
    workout_type_id UUID REFERENCES workout_types(id) ON DELETE SET NULL,
    plan_id         UUID REFERENCES training_plans(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted', 'cancelled')),
    is_settled      BOOLEAN DEFAULT FALSE,
    note            TEXT,
    main_group      TEXT,
    added_groups    JSONB DEFAULT '[]'::JSONB,
    is_replacement  BOOLEAN DEFAULT FALSE,
    replaced_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
    trainer_id      UUID NOT NULL REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(event_date, event_hour, trainer_id)
);

CREATE INDEX idx_calendar_date ON calendar_events(event_date);
CREATE INDEX idx_calendar_client ON calendar_events(client_id);
CREATE INDEX idx_calendar_trainer ON calendar_events(trainer_id);

-- ============================================================================
-- 5. WORKOUT LOGS (Treningi)
-- ============================================================================

CREATE TABLE workout_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    exercise_id     UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    weight_kg       NUMERIC(6,2),
    reps            INT,
    week_number     INT NOT NULL,
    session_date    DATE NOT NULL,
    trainer_id      UUID NOT NULL REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workout_client ON workout_logs(client_id);
CREATE INDEX idx_workout_date ON workout_logs(session_date);
CREATE INDEX idx_workout_client_date ON workout_logs(client_id, session_date);
CREATE INDEX idx_workout_logs_trainer ON workout_logs(trainer_id);

-- ============================================================================
-- 6. BODY MEASUREMENTS (Pomiary)
-- ============================================================================

CREATE TABLE measurements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    measure_date    DATE NOT NULL,
    weight_kg       NUMERIC(5,1),
    body_fat_pct    NUMERIC(4,1),
    muscle_mass_pct NUMERIC(4,1),
    trainer_id      UUID NOT NULL REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_measurements_client ON measurements(client_id);
CREATE INDEX idx_measurements_date ON measurements(client_id, measure_date);
CREATE INDEX idx_measurements_trainer ON measurements(trainer_id);

-- ============================================================================
-- 7. ABSENCES (Absencje)
-- ============================================================================

CREATE TABLE absences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    absence_date    DATE NOT NULL,
    absence_hour    INT,
    trainer_id      UUID NOT NULL REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, absence_date, absence_hour)
);

CREATE INDEX idx_absences_client ON absences(client_id);
CREATE INDEX idx_absences_date ON absences(absence_date);
CREATE INDEX idx_absences_trainer ON absences(trainer_id);

-- ============================================================================
-- 8. DELETED WORKOUTS AUDIT LOG (UsunieteTreningi)
-- ============================================================================

CREATE TABLE deleted_workouts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_date      DATE NOT NULL,
    event_hour      INT NOT NULL,
    client_name     TEXT,
    workout_type    TEXT,
    trainer_id      UUID NOT NULL REFERENCES auth.users(id),
    deleted_at      TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 9. AUTH USERS (for trainer login)
-- ============================================================================

-- Note: Supabase provides auth.users table automatically.
-- We extend it with a trainer profile.

CREATE TABLE trainer_profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name        TEXT,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 10. ROW LEVEL SECURITY (RLS) — Per-Trainer Isolation
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE workout_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE muscle_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE deleted_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainer_profiles ENABLE ROW LEVEL SECURITY;

-- Each trainer can only access their own data
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'workout_types','muscle_groups','exercises',
            'training_plans','plan_exercises','clients',
            'calendar_events','workout_logs','measurements',
            'absences','deleted_workouts'
        ])
    LOOP
        EXECUTE format(
            'CREATE POLICY "trainer_isolation" ON %I
             FOR ALL TO authenticated
             USING (trainer_id = auth.uid())
             WITH CHECK (trainer_id = auth.uid())',
            tbl
        );
    END LOOP;
END $$;

-- trainer_profiles uses id = auth.uid() (id references auth.users directly)
CREATE POLICY "trainer_isolation" ON trainer_profiles
    FOR ALL TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ============================================================================
-- 11. SEED DATA — Run manually after creating a user in Supabase Auth:
--     See: database/seed_new_trainer.sql (replace %(trainer_id)s with UUID)
-- ============================================================================
