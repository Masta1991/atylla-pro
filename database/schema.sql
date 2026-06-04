-- ═══════════════════════════════════════════════════════════════════════════
-- ATYLLA PRO — Supabase (PostgreSQL) Schema
-- Migrated from Google Sheets: TrainerApp_Data
-- ═══════════════════════════════════════════════════════════════════════════
-- NOTE: Uses gen_random_uuid() — available in Supabase by default (pgcrypto)
--       Paste this entire file into Supabase SQL Editor and click RUN
-- ═══════════════════════════════════════════════════════════════════════════

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. CONFIGURATION TABLES
-- ============================================================================

-- Workout types (RodzajeTreningu)
CREATE TABLE workout_types (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Muscle groups / body parts (Partie)
CREATE TABLE muscle_groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- Exercises (Cwiczenia)
CREATE TABLE exercises (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    muscle_group_id UUID NOT NULL REFERENCES muscle_groups(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    unit            TEXT DEFAULT 'KG',
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(muscle_group_id, name)
);

-- ============================================================================
-- 2. TRAINING PLANS
-- ============================================================================

CREATE TABLE training_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,
    workout_type_id UUID REFERENCES workout_types(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE plan_exercises (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id         UUID NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
    exercise_id     UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
    sort_order      INT NOT NULL DEFAULT 0,
    sets_data       JSONB DEFAULT '[]'::JSONB,
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
    -- ProgresjaSilowa: JSON array of exercise IDs for strength progression tracking
    strength_progression JSONB DEFAULT '[]'::JSONB,
    -- Harmonogram: JSON array of {day, hour, plan_id}
    training_schedule JSONB DEFAULT '[]'::JSONB,
    -- Billing / packages
    billing_type            TEXT DEFAULT 'package',
    package_purchase_date   DATE,
    package_size            INT DEFAULT 10,
    package_current_count   INT DEFAULT 0,
    payment_history         JSONB DEFAULT '[]'::JSONB,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_clients_name ON clients(name);

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
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(event_date, event_hour)
);

CREATE INDEX idx_calendar_date ON calendar_events(event_date);
CREATE INDEX idx_calendar_client ON calendar_events(client_id);

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
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_workout_client ON workout_logs(client_id);
CREATE INDEX idx_workout_date ON workout_logs(session_date);
CREATE INDEX idx_workout_client_date ON workout_logs(client_id, session_date);

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
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_measurements_client ON measurements(client_id);
CREATE INDEX idx_measurements_date ON measurements(client_id, measure_date);

-- ============================================================================
-- 7. ABSENCES (Absencje)
-- ============================================================================

CREATE TABLE absences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    absence_date    DATE NOT NULL,
    absence_hour    INT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, absence_date, absence_hour)
);

CREATE INDEX idx_absences_client ON absences(client_id);
CREATE INDEX idx_absences_date ON absences(absence_date);

-- ============================================================================
-- 8. DELETED WORKOUTS AUDIT LOG (UsunieteTreningi)
-- ============================================================================

CREATE TABLE deleted_workouts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_date      DATE NOT NULL,
    event_hour      INT NOT NULL,
    client_name     TEXT,
    workout_type    TEXT,
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
-- 10. ROW LEVEL SECURITY (RLS)
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

-- Allow authenticated users to read/write their own data
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'workout_types','muscle_groups','exercises',
            'training_plans','plan_exercises','clients',
            'calendar_events','workout_logs','measurements',
            'absences','deleted_workouts','trainer_profiles'
        ])
    LOOP
        EXECUTE format(
            'CREATE POLICY "Authenticated full access" ON %I
             FOR ALL TO authenticated
             USING (true)
             WITH CHECK (true)',
            tbl
        );
    END LOOP;
END $$;

-- ============================================================================
-- 11. SEED DATA
-- ============================================================================

INSERT INTO workout_types (name) VALUES
    ('Push'), ('Pull'), ('FBW'), ('PPL Push'), ('PPL Pull'),
    ('Upper'), ('Lower'), ('Nogi'), ('Barki + Łydki'), ('Klatka + Triceps'),
    ('Plecy + Biceps'), ('Cardio');

INSERT INTO muscle_groups (name) VALUES
    ('KLATKA PIERSIOWA'), ('PLECY'), ('BARKI'), ('BICEPS'),
    ('TRICEPS'), ('PRZEDRAMIONA'), ('NOGI'), ('ŁYDKI'),
    ('BRZUCH'), ('CARDIO');

-- Seed exercises for Klatka Piersiowa (chest)
WITH chest AS (SELECT id FROM muscle_groups WHERE name = 'KLATKA PIERSIOWA')
INSERT INTO exercises (muscle_group_id, name)
SELECT chest.id, e FROM chest, unnest(ARRAY[
    'Wyciskanie sztangi na ławce płaskiej',
    'Wyciskanie sztangielek na ławce płaskiej',
    'Wyciskanie sztangi na ławce skośnej',
    'Wyciskanie sztangielek na ławce skośnej',
    'Rozpiętki ze sztangielkami',
    'Wyciskanie na maszynie',
    'Pompki'
]) AS e;

-- Seed exercises for Plecy (back)
WITH back AS (SELECT id FROM muscle_groups WHERE name = 'PLECY')
INSERT INTO exercises (muscle_group_id, name)
SELECT back.id, e FROM back, unnest(ARRAY[
    'Martwy ciąg',
    'Podciąganie na drążku',
    'Wiosłowanie sztangą',
    'Wiosłowanie sztangielką',
    'Ściąganie drążka wyciągu górnego',
    'Wiosłowanie na wyciągu dolnym',
    'Face Pull'
]) AS e;

-- Seed exercises for Barki (shoulders)
WITH shoulders AS (SELECT id FROM muscle_groups WHERE name = 'BARKI')
INSERT INTO exercises (muscle_group_id, name)
SELECT shoulders.id, e FROM shoulders, unnest(ARRAY[
    'Wyciskanie sztangi nad głowę',
    'Wyciskanie sztangielek siedząc',
    'Unoszenie sztangielek bokiem',
    'Unoszenie sztangielek przodem',
    'Unoszenie sztangielek w opadzie',
    'Arnoldki'
]) AS e;

-- Seed exercises for Biceps
WITH biceps AS (SELECT id FROM muscle_groups WHERE name = 'BICEPS')
INSERT INTO exercises (muscle_group_id, name)
SELECT biceps.id, e FROM biceps, unnest(ARRAY[
    'Uginanie sztangi stojąc',
    'Uginanie sztangielek stojąc',
    'Uginanie młotkowe',
    'Uginanie na modlitewniku',
    'Uginanie na wyciągu'
]) AS e;

-- Seed exercises for Triceps
WITH triceps AS (SELECT id FROM muscle_groups WHERE name = 'TRICEPS')
INSERT INTO exercises (muscle_group_id, name)
SELECT triceps.id, e FROM triceps, unnest(ARRAY[
    'Wyciskanie francuskie',
    'Prostowanie ramion na wyciągu',
    'Pompki na poręczach',
    'Wyciskanie wąskim chwytem',
    'Prostowanie sztangielki zza głowy'
]) AS e;

-- Seed exercises for Nogi (legs)
WITH legs AS (SELECT id FROM muscle_groups WHERE name = 'NOGI')
INSERT INTO exercises (muscle_group_id, name)
SELECT legs.id, e FROM legs, unnest(ARRAY[
    'Przysiady ze sztangą',
    'Przysiady wykroczne',
    'Prostowanie nóg na maszynie',
    'Uginanie nóg na maszynie',
    'Hack squat',
    'Wykroki ze sztangielkami'
]) AS e;

-- Seed exercises for Łydki (calves)
WITH calves AS (SELECT id FROM muscle_groups WHERE name = 'ŁYDKI')
INSERT INTO exercises (muscle_group_id, name)
SELECT calves.id, e FROM calves, unnest(ARRAY[
    'Wspięcia na palce stojąc',
    'Wspięcia na palce siedząc',
    'Wspięcia na palce na maszynie'
]) AS e;

-- Seed exercises for Brzuch (abs)
WITH abs AS (SELECT id FROM muscle_groups WHERE name = 'BRZUCH')
INSERT INTO exercises (muscle_group_id, name)
SELECT abs.id, e FROM abs, unnest(ARRAY[
    'Brzuszki',
    'Plank',
    'Unoszenie nóg w zwisie',
    'Russian twist',
    'Spięcia brzucha na maszynie'
]) AS e;

-- Seed exercises for Cardio
WITH cardio AS (SELECT id FROM muscle_groups WHERE name = 'CARDIO')
INSERT INTO exercises (muscle_group_id, name)
SELECT cardio.id, e FROM cardio, unnest(ARRAY[
    'Bieżnia',
    'Rower',
    'Wiosłowanie (ergometr)',
    'Skakanka',
    'Stepper'
]) AS e;
