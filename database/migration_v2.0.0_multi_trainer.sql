-- ═══════════════════════════════════════════════════════════════════════════
-- ATYLLA PRO — Migration v2.0.0: Multi-Trainer Support
-- Date: 2026-06-14
-- ═══════════════════════════════════════════════════════════════════════════
-- WARNING: Run a full backup (pg_dump) before executing this migration!
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose:
--   1. Add trainer_id to all 12 tables (per-trainer data isolation)
--   2. Backfill existing data → trainer: treneratylla@gmail.com
--   3. Update calendar_events UNIQUE constraint → (date, hour, trainer_id)
--   4. Fix calendar_events status CHECK → add 'cancelled'
--   5. Replace RLS policies → scoped by auth.uid() = trainer_id
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. ADD trainer_id COLUMNS
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE workout_types    ADD COLUMN trainer_id UUID REFERENCES auth.users(id);
ALTER TABLE muscle_groups    ADD COLUMN trainer_id UUID REFERENCES auth.users(id);
ALTER TABLE exercises        ADD COLUMN trainer_id UUID REFERENCES auth.users(id);
ALTER TABLE training_plans   ADD COLUMN trainer_id UUID REFERENCES auth.users(id);
ALTER TABLE plan_exercises   ADD COLUMN trainer_id UUID REFERENCES auth.users(id);
ALTER TABLE clients          ADD COLUMN trainer_id UUID REFERENCES auth.users(id);
ALTER TABLE calendar_events  ADD COLUMN trainer_id UUID REFERENCES auth.users(id);
ALTER TABLE workout_logs     ADD COLUMN trainer_id UUID REFERENCES auth.users(id);
ALTER TABLE measurements     ADD COLUMN trainer_id UUID REFERENCES auth.users(id);
ALTER TABLE absences         ADD COLUMN trainer_id UUID REFERENCES auth.users(id);
ALTER TABLE deleted_workouts ADD COLUMN trainer_id UUID REFERENCES auth.users(id);

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. BACKFILL existing data → treneratylla@gmail.com
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_trainer_id UUID;
BEGIN
    SELECT id INTO v_trainer_id FROM auth.users WHERE email = 'treneratylla@gmail.com';
    
    UPDATE workout_types    SET trainer_id = v_trainer_id;
    UPDATE muscle_groups    SET trainer_id = v_trainer_id;
    UPDATE exercises        SET trainer_id = v_trainer_id;
    UPDATE training_plans   SET trainer_id = v_trainer_id;
    UPDATE plan_exercises   SET trainer_id = v_trainer_id;
    UPDATE clients          SET trainer_id = v_trainer_id;
    UPDATE calendar_events  SET trainer_id = v_trainer_id;
    UPDATE workout_logs     SET trainer_id = v_trainer_id;
    UPDATE measurements     SET trainer_id = v_trainer_id;
    UPDATE absences         SET trainer_id = v_trainer_id;
    UPDATE deleted_workouts SET trainer_id = v_trainer_id;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. MAKE trainer_id NOT NULL
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE workout_types    ALTER COLUMN trainer_id SET NOT NULL;
ALTER TABLE muscle_groups    ALTER COLUMN trainer_id SET NOT NULL;
ALTER TABLE exercises        ALTER COLUMN trainer_id SET NOT NULL;
ALTER TABLE training_plans   ALTER COLUMN trainer_id SET NOT NULL;
ALTER TABLE plan_exercises   ALTER COLUMN trainer_id SET NOT NULL;
ALTER TABLE clients          ALTER COLUMN trainer_id SET NOT NULL;
ALTER TABLE calendar_events  ALTER COLUMN trainer_id SET NOT NULL;
ALTER TABLE workout_logs     ALTER COLUMN trainer_id SET NOT NULL;
ALTER TABLE measurements     ALTER COLUMN trainer_id SET NOT NULL;
ALTER TABLE absences         ALTER COLUMN trainer_id SET NOT NULL;
ALTER TABLE deleted_workouts ALTER COLUMN trainer_id SET NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. UPDATE UNIQUE CONSTRAINTS → scoped by trainer_id
-- ══════════════════════════════════════════════════════════════════════════════

-- workout_types: old UNIQUE(name) → UNIQUE(name, trainer_id)
ALTER TABLE workout_types DROP CONSTRAINT IF EXISTS workout_types_name_key;
ALTER TABLE workout_types ADD CONSTRAINT workout_types_name_trainer_key UNIQUE (name, trainer_id);

-- muscle_groups: old UNIQUE(name) → UNIQUE(name, trainer_id)
ALTER TABLE muscle_groups DROP CONSTRAINT IF EXISTS muscle_groups_name_key;
ALTER TABLE muscle_groups ADD CONSTRAINT muscle_groups_name_trainer_key UNIQUE (name, trainer_id);

-- training_plans: old UNIQUE(name) → UNIQUE(name, trainer_id)
ALTER TABLE training_plans DROP CONSTRAINT IF EXISTS training_plans_name_key;
ALTER TABLE training_plans ADD CONSTRAINT training_plans_name_trainer_key UNIQUE (name, trainer_id);

-- calendar_events: old UNIQUE(event_date, event_hour) → UNIQUE(event_date, event_hour, trainer_id)
ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_event_date_event_hour_key;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_date_hour_trainer_key 
    UNIQUE (event_date, event_hour, trainer_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. FIX calendar_events status CHECK → add 'cancelled'
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE calendar_events DROP CONSTRAINT IF EXISTS calendar_events_status_check;
ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_status_check
    CHECK (status IN ('active', 'deleted', 'cancelled'));

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. DROP OLD RLS POLICIES
-- ══════════════════════════════════════════════════════════════════════════════

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
        EXECUTE format('DROP POLICY IF EXISTS "Authenticated full access" ON %I', tbl);
    END LOOP;
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. CREATE NEW RLS POLICIES (scoped by trainer_id = auth.uid())
-- ══════════════════════════════════════════════════════════════════════════════

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
DROP POLICY IF EXISTS "Authenticated full access" ON trainer_profiles;
CREATE POLICY "trainer_isolation" ON trainer_profiles
    FOR ALL TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════════
-- 8. INDEXES for trainer_id (performance)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_clients_trainer ON clients(trainer_id);
CREATE INDEX IF NOT EXISTS idx_calendar_trainer ON calendar_events(trainer_id);
CREATE INDEX IF NOT EXISTS idx_workout_logs_trainer ON workout_logs(trainer_id);
CREATE INDEX IF NOT EXISTS idx_measurements_trainer ON measurements(trainer_id);
CREATE INDEX IF NOT EXISTS idx_absences_trainer ON absences(trainer_id);
CREATE INDEX IF NOT EXISTS idx_plans_trainer ON training_plans(trainer_id);
CREATE INDEX IF NOT EXISTS idx_plan_exercises_trainer ON plan_exercises(trainer_id);

COMMIT;
