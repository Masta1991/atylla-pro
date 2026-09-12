-- 006_save_workout_batch_atomic.sql (T7, NIE WYKONANE automatycznie)
-- Jednorazowo wkleić RAZ w SQL Editor Supabase (najpierw TESTOWY, po odbiorze PROD).
-- Daje atomowy zapis sesji: DELETE + INSERT w jednej transakcji.
-- Backend używa RPC gdy istnieje; bez niego działa guarded replace z odtworzeniem.
-- Idempotentna: CREATE OR REPLACE.

CREATE OR REPLACE FUNCTION public.save_workout_batch_atomic(
    p_client_id uuid,
    p_session_date date,
    p_week_number int,
    p_trainer_id uuid,
    p_logs jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    inserted jsonb;
BEGIN
    DELETE FROM public.workout_logs
    WHERE client_id = p_client_id AND session_date = p_session_date;

    IF jsonb_array_length(COALESCE(p_logs, '[]'::jsonb)) = 0 THEN
        RETURN '[]'::jsonb;
    END IF;

    WITH ins AS (
        INSERT INTO public.workout_logs
            (client_id, exercise_id, weight_kg, reps, week_number, session_date, trainer_id)
        SELECT
            p_client_id,
            (x->>'exercise_id')::uuid,
            NULLIF(x->>'weight_kg', '')::double precision,
            NULLIF(x->>'reps', '')::int,
            COALESCE((x->>'week_number')::int, p_week_number),
            p_session_date,
            p_trainer_id
        FROM jsonb_array_elements(p_logs) AS x
        RETURNING to_jsonb(public.workout_logs.*)
    )
    SELECT COALESCE(jsonb_agg(ins.*), '[]'::jsonb) INTO inserted FROM ins;

    RETURN inserted;
END;
$$;
