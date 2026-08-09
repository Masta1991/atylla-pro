-- ============================================================================
-- NOWA TABELA: Pakiety Klientów (Moduł Rozliczeń SSOT)
-- ============================================================================

CREATE TABLE IF NOT EXISTS client_packages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    size              INT NOT NULL DEFAULT 10,
    start_training_id UUID NOT NULL REFERENCES calendar_events(id) ON DELETE RESTRICT,
    end_training_id   UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
    "offset"          INT NOT NULL DEFAULT 0,
    trainer_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT check_positive_size CHECK (size > 0),
    CONSTRAINT check_positive_offset CHECK ("offset" >= 0)
);

-- Indeksy do szybkiego wyszukiwania historii pakietów dla kalendarza
CREATE INDEX IF NOT EXISTS idx_client_packages_client ON client_packages(client_id);
CREATE INDEX IF NOT EXISTS idx_client_packages_trainer ON client_packages(trainer_id);

-- Włączenie Row Level Security (RLS) dla izolacji per-trener
ALTER TABLE client_packages ENABLE ROW LEVEL SECURITY;

-- Zdefiniowanie polisy izolacyjnej (każdy trener widzi tylko swoje pakiety)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'client_packages' AND policyname = 'trainer_isolation'
    ) THEN
        CREATE POLICY "trainer_isolation" ON client_packages
             FOR ALL TO authenticated
             USING (trainer_id = auth.uid())
             WITH CHECK (trainer_id = auth.uid());
    END IF;
END $$;
