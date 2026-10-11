-- Local candidate, Atylla Pro 2.1.25. Requires 010 and 011. No historical data rewrite.
BEGIN;
DO $$ BEGIN
    IF to_regprocedure('public.save_calendar_workout_v4(jsonb)') IS NULL
       OR to_regprocedure('public.copy_week_safe_v1(date,jsonb,boolean)') IS NULL THEN
        RAISE EXCEPTION 'Najpierw zainstaluj migracje 010 i 011.';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.record_absence_v4(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp
AS $$
DECLARE
    actor uuid := auth.uid();
    cid uuid := (p_payload->>'client_id')::uuid;
    day date := (p_payload->>'absence_date')::date;
    hour int := (p_payload->>'absence_hour')::int;
    mode text := COALESCE(p_payload->>'mode','cancel');
    schedule jsonb;
    ev public.calendar_events%ROWTYPE;
    result public.absences%ROWTYPE;
BEGIN
    IF actor IS NULL OR NOT EXISTS (SELECT 1 FROM public.clients WHERE id=cid AND trainer_id=actor) THEN
        RAISE EXCEPTION 'Client not owned' USING ERRCODE='42501';
    END IF;
    IF day IS NULL OR hour IS NULL OR hour NOT BETWEEN 6 AND 21 THEN
        RAISE EXCEPTION 'Nieprawidłowy termin nieobecności.';
    END IF;
    IF NOT (p_payload ? 'expected_event_id' AND p_payload ? 'expected_updated_at') THEN
        RAISE EXCEPTION 'Odśwież aplikację i listę terminów przed zapisem.';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,0));
    IF mode='schedule' THEN
        SELECT training_schedule INTO schedule FROM public.clients
            WHERE id=cid AND trainer_id=actor FOR SHARE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Client not owned' USING ERRCODE='42501'; END IF;
    END IF;
    -- Same leading order as copy_week_safe_v1; includes legacy direct writes.
    -- Do not lock packages after calendar: billing_cycle_v1 locks them first.
    LOCK TABLE public.calendar_events,public.absences IN SHARE ROW EXCLUSIVE MODE;

    IF mode NOT IN ('cancel','schedule') THEN RAISE EXCEPTION 'Nieprawidłowy rodzaj absencji.'; END IF;
    IF mode='schedule' THEN
        IF COALESCE((p_payload->>'paid')::boolean,true) OR
           p_payload->>'expected_event_id' IS NOT NULL OR p_payload->>'expected_updated_at' IS NOT NULL THEN
            RAISE EXCEPTION 'Planowana absencja bez treningu nie jest płatnym odwołaniem.';
        END IF;
        -- Check the entire slot, not only this client's membership. A booking
        -- inserted after the preview must never be changed by a scheduled absence.
        IF EXISTS (SELECT 1 FROM public.calendar_events WHERE trainer_id=actor
                   AND event_date=day AND event_hour=hour) THEN
            RAISE EXCEPTION 'Termin został zmieniony. Odśwież listę terminów.';
        END IF;
        SELECT * INTO result FROM public.absences WHERE trainer_id=actor AND client_id=cid
            AND absence_date=day AND absence_hour=hour ORDER BY created_at,id LIMIT 1 FOR UPDATE;
        IF result.id IS NOT NULL THEN RETURN to_jsonb(result); END IF;
        IF (day+make_time(hour,0,0)) AT TIME ZONE 'Europe/Warsaw' <= clock_timestamp() THEN
            RAISE EXCEPTION 'Planowana absencja musi dotyczyć przyszłego terminu.';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(schedule,'[]'::jsonb)) s
            WHERE s->>'day'=(extract(isodow FROM day)::int-1)::text AND s->>'hour'=hour::text) THEN
            RAISE EXCEPTION 'Termin nie należy do aktualnego stałego harmonogramu. Odśwież listę terminów.';
        END IF;
        INSERT INTO public.absences(client_id,absence_date,absence_hour,trainer_id)
        VALUES(cid,day,hour,actor) RETURNING * INTO result;
        RETURN to_jsonb(result);
    END IF;
    IF COALESCE((p_payload->>'paid')::boolean,true) IS NOT TRUE THEN
        RAISE EXCEPTION 'Odwołanie bez płatności jest obecnie wyłączone.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.calendar_events WHERE trainer_id=actor
        AND (client_id=cid OR partner_client_id=cid) AND event_date=day
        AND (hour IS NULL OR event_hour=hour)) THEN
        RAISE EXCEPTION 'Brak treningu w tym terminie. Odśwież listę terminów.';
    END IF;
    FOR ev IN SELECT * FROM public.calendar_events WHERE trainer_id=actor
        AND (client_id=cid OR partner_client_id=cid) AND event_date=day
        AND (hour IS NULL OR event_hour=hour) ORDER BY event_hour,id FOR UPDATE
    LOOP
        IF ev.status='deleted' OR (ev.status='cancelled' AND ev.is_settled IS NOT TRUE) THEN
            RAISE EXCEPTION 'Trening został usunięty. Odśwież listę terminów.';
        END IF;
        IF (
            ev.id IS DISTINCT FROM (p_payload->>'expected_event_id')::uuid OR
            (ev.updated_at IS DISTINCT FROM (p_payload->>'expected_updated_at')::timestamptz
             AND NOT (ev.status='cancelled' AND ev.is_settled IS TRUE))
        ) THEN
            RAISE EXCEPTION 'Trening został zmieniony. Odśwież listę terminów.';
        END IF;
        -- Repeating a confirmed cancellation does not mutate its revision or billing.
        IF ev.status<>'cancelled' OR ev.is_settled IS NOT TRUE THEN
            UPDATE public.calendar_events SET status='cancelled',is_settled=true,
                updated_at=clock_timestamp() WHERE id=ev.id AND trainer_id=actor;
        END IF;
    END LOOP;
    SELECT * INTO result FROM public.absences WHERE trainer_id=actor AND client_id=cid
        AND absence_date=day AND absence_hour IS NOT DISTINCT FROM hour ORDER BY created_at,id LIMIT 1 FOR UPDATE;
    IF result.id IS NULL THEN
        INSERT INTO public.absences(client_id,absence_date,absence_hour,trainer_id)
        VALUES(cid,day,hour,actor) RETURNING * INTO result;
    END IF;
    RETURN to_jsonb(result);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_absences_v1(p_items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp
AS $$
DECLARE item jsonb; result jsonb := '[]'::jsonb;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
    IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 30 THEN
        RAISE EXCEPTION 'Wybierz od 1 do 30 terminów.';
    END IF;
    FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
        result := result || jsonb_build_array(public.record_absence_v4(item));
    END LOOP;
    RETURN result;
END;
$$;

-- Removing an absence removes the scheduling block only. It never rewrites
-- a paid cancellation, package anchor, exercise log or closed settlement.
CREATE OR REPLACE FUNCTION public.delete_absence_v1(p_absence_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp
AS $$
DECLARE actor uuid := auth.uid();
BEGIN
    IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,0));
    DELETE FROM public.absences WHERE id=p_absence_id AND trainer_id=actor;
    RETURN '{"status":"deleted"}'::jsonb;
END;
$$;

REVOKE ALL ON FUNCTION public.record_absence_v4(jsonb),public.record_absences_v1(jsonb),public.delete_absence_v1(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_absence_v4(jsonb),public.record_absences_v1(jsonb),public.delete_absence_v1(uuid) TO authenticated;
-- Retire the old path, including direct SDK callers, instead of retaining a bypass.
REVOKE ALL ON FUNCTION public.record_absence_v3(jsonb) FROM PUBLIC,anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
