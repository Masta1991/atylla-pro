-- Corrected historical migration. New local code requires migration 007.
-- Local preparation only: not executed on Supabase.
BEGIN;

CREATE OR REPLACE FUNCTION public.save_workout_batch_atomic(
    p_client_id uuid, p_session_date date, p_week_number int,
    p_trainer_id uuid, p_logs jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
    actor uuid := auth.uid();
    inserted jsonb;
BEGIN
    IF actor IS NULL OR actor IS DISTINCT FROM p_trainer_id THEN
        RAISE EXCEPTION 'Unauthorized trainer' USING ERRCODE = '42501';
    END IF;
    IF p_session_date IS NULL OR p_week_number IS NULL
       OR jsonb_typeof(p_logs) IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_logs) NOT BETWEEN 1 AND 1000 THEN
        RAISE EXCEPTION 'Trening musi zawierać od 1 do 1000 ćwiczeń.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id AND trainer_id = actor) THEN
        RAISE EXCEPTION 'Client not owned' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(p_logs) x
        WHERE NOT EXISTS (
            SELECT 1 FROM public.exercises e
            WHERE e.id = (x->>'exercise_id')::uuid AND e.trainer_id = actor
        )
    ) THEN
        RAISE EXCEPTION 'Exercise not owned' USING ERRCODE = '42501';
    END IF;
    -- Serialize all audited writes for one trainer (including calendar moves).
    PERFORM pg_advisory_xact_lock(hashtextextended(actor::text, 0));
    DELETE FROM public.workout_logs
    WHERE client_id = p_client_id AND session_date = p_session_date AND trainer_id = actor;
    WITH ins AS (
        INSERT INTO public.workout_logs
            (client_id, exercise_id, weight_kg, reps, week_number, session_date, trainer_id)
        SELECT p_client_id, (x->>'exercise_id')::uuid,
               NULLIF(x->>'weight_kg', '')::numeric,
               NULLIF(x->>'reps', '')::int, p_week_number, p_session_date, actor
        FROM jsonb_array_elements(p_logs) x
        RETURNING *
    )
    SELECT COALESCE(jsonb_agg(to_jsonb(ins)), '[]'::jsonb) INTO inserted FROM ins;
    RETURN inserted;
END;
$$;
REVOKE ALL ON FUNCTION public.save_workout_batch_atomic(uuid,date,int,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_workout_batch_atomic(uuid,date,int,uuid,jsonb) TO authenticated;

COMMIT;
