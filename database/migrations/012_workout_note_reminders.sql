-- Local preparation only. Requires migrations 007-011; no data is deleted.
BEGIN;
ALTER TABLE public.calendar_events ADD COLUMN IF NOT EXISTS note_acknowledged_at timestamptz;

CREATE OR REPLACE FUNCTION public.workout_note_text(p_note text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp AS $$
    SELECT btrim(regexp_replace(coalesce(p_note, ''), '\[BILLING:[^]]*\]', '', 'g'));
$$;

CREATE OR REPLACE FUNCTION public.reset_workout_note_read() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
BEGIN
    IF public.workout_note_text(NEW.note) IS DISTINCT FROM public.workout_note_text(OLD.note)
       OR NEW.client_id IS DISTINCT FROM OLD.client_id
       OR NEW.partner_client_id IS DISTINCT FROM OLD.partner_client_id
       OR NEW.trainer_id IS DISTINCT FROM OLD.trainer_id THEN
        NEW.note_acknowledged_at := NULL;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS calendar_reset_note_read ON public.calendar_events;
CREATE TRIGGER calendar_reset_note_read
BEFORE UPDATE OF note,client_id,partner_client_id,trainer_id ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.reset_workout_note_read();

CREATE OR REPLACE FUNCTION public.acknowledge_workout_note_v1(p_event_id uuid, p_expected_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
    actor uuid := auth.uid();
    source public.calendar_events%ROWTYPE;
BEGIN
    IF actor IS NULL THEN RAISE EXCEPTION 'Unauthorized trainer' USING ERRCODE = '42501'; END IF;
    SELECT * INTO source FROM public.calendar_events
        WHERE id = p_event_id AND trainer_id = actor FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Note not accessible' USING ERRCODE = '42501'; END IF;
    IF source.note IS DISTINCT FROM p_expected_note THEN
        RAISE EXCEPTION 'Treść notatki zmieniła się. Otwórz ją ponownie przed oznaczeniem jako przeczytana.';
    END IF;
    IF public.workout_note_text(source.note) = '' OR source.status = 'deleted' THEN
        RAISE EXCEPTION 'Ta notatka nie jest już dostępna. Odśwież kalendarz.';
    END IF;
    UPDATE public.calendar_events
        SET note_acknowledged_at = coalesce(note_acknowledged_at, clock_timestamp())
        WHERE id = source.id RETURNING * INTO source;
    RETURN jsonb_build_object('id', source.id, 'note_acknowledged_at', source.note_acknowledged_at);
END;
$$;
REVOKE ALL ON FUNCTION public.acknowledge_workout_note_v1(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_workout_note_v1(uuid,text) TO authenticated;
CREATE INDEX IF NOT EXISTS calendar_unread_note_owner ON public.calendar_events(trainer_id,client_id,event_date,event_hour)
    WHERE status = 'active' AND note_acknowledged_at IS NULL AND note IS NOT NULL;
CREATE INDEX IF NOT EXISTS calendar_unread_note_partner ON public.calendar_events(trainer_id,partner_client_id,event_date,event_hour)
    WHERE status = 'active' AND note_acknowledged_at IS NULL AND note IS NOT NULL;
NOTIFY pgrst, 'reload schema';
COMMIT;
