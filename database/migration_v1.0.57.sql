-- ============================================================================
-- ATYLLA PRO — Migration v1.0.57
-- Adds missing columns that exist in Pydantic models / frontend payloads
-- but were absent from the original schema.sql
-- Run this in Supabase SQL Editor
-- ============================================================================

-- 1. Add columns to training_plans
ALTER TABLE training_plans ADD COLUMN IF NOT EXISTS workout_type_id UUID REFERENCES workout_types(id) ON DELETE SET NULL;

-- 2. Add columns to plan_exercises
ALTER TABLE plan_exercises ADD COLUMN IF NOT EXISTS sets_data JSONB DEFAULT '[]'::JSONB;

-- 3. Add columns to exercises
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'KG';

-- 4. Add columns to clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS default_plan_id UUID REFERENCES training_plans(id) ON DELETE SET NULL;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'package';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS package_purchase_date DATE;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS package_size INT DEFAULT 10;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS package_current_count INT DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS payment_history JSONB DEFAULT '[]'::JSONB;

-- 5. Add columns to calendar_events
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES training_plans(id) ON DELETE SET NULL;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT FALSE;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS main_group TEXT;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS added_groups JSONB DEFAULT '[]'::JSONB;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS is_replacement BOOLEAN DEFAULT FALSE;
ALTER TABLE calendar_events ADD COLUMN IF NOT EXISTS replaced_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- 6. Create absences table (if not exists)
CREATE TABLE IF NOT EXISTS absences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    absence_date    DATE NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, absence_date)
);

CREATE INDEX IF NOT EXISTS idx_absences_client ON absences(client_id);
CREATE INDEX IF NOT EXISTS idx_absences_date ON absences(absence_date);

-- 7. Enable RLS + policy for absences (if not already)
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE policyname = 'Authenticated full access' AND tablename = 'absences'
    ) THEN
        CREATE POLICY "Authenticated full access" ON absences
        FOR ALL TO authenticated
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;
