-- LOCAL ONLY. Apply after 007 to an isolated database first.
BEGIN;

-- Fail migration visibly if legacy data contains duplicate open packages;
-- never silently choose one or remove real settlements.
CREATE UNIQUE INDEX IF NOT EXISTS audit_one_open_package_per_client
ON public.client_packages(client_id) WHERE end_training_id IS NULL;

-- A closed package is a historical settlement, including its interior events.
-- Updates of notes/exercises remain possible; billing facts cannot be rewritten.
CREATE OR REPLACE FUNCTION public.protect_closed_package_anchor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE protected boolean;
BEGIN
    IF TG_OP='INSERT' THEN
        IF NOT EXISTS(SELECT 1 FROM public.calendar_events WHERE id=NEW.id) AND EXISTS (
            SELECT 1 FROM public.client_packages p
            JOIN public.calendar_events s ON s.id=p.start_training_id
            JOIN public.calendar_events e ON e.id=p.end_training_id
            WHERE (NEW.client_id=p.client_id OR NEW.client_id=ANY(COALESCE(p.shared_client_ids,'{}'::uuid[])))
              AND (NEW.event_date,NEW.event_hour)>=(s.event_date,s.event_hour)
              AND (NEW.event_date,NEW.event_hour)<=(e.event_date,e.event_hour)
        ) THEN RAISE EXCEPTION 'Nie można dopisać treningu do zamkniętego pakietu.'; END IF;
        RETURN NEW;
    END IF;
    IF TG_OP='UPDATE' AND OLD.client_id IS DISTINCT FROM NEW.client_id AND EXISTS(
        SELECT 1 FROM public.client_packages WHERE start_training_id=OLD.id
    ) THEN RAISE EXCEPTION 'Trening jest kotwicą pakietu. Nie można zmienić klienta.'; END IF;
    SELECT EXISTS (
        SELECT 1 FROM public.client_packages p
        JOIN public.calendar_events s ON s.id=p.start_training_id
        JOIN public.calendar_events e ON e.id=p.end_training_id
        WHERE p.end_training_id IS NOT NULL
          AND (OLD.id IN (s.id,e.id) OR
            ((OLD.client_id=p.client_id OR OLD.client_id=ANY(COALESCE(p.shared_client_ids,'{}'::uuid[])))
             AND (OLD.event_date,OLD.event_hour)>=(s.event_date,s.event_hour)
             AND (OLD.event_date,OLD.event_hour)<=(e.event_date,e.event_hour)))
    ) INTO protected;
    IF TG_OP='UPDATE' AND (OLD.client_id,OLD.event_date,OLD.event_hour)
        IS DISTINCT FROM (NEW.client_id,NEW.event_date,NEW.event_hour) AND EXISTS (
            SELECT 1 FROM public.client_packages p
            JOIN public.calendar_events s ON s.id=p.start_training_id
            JOIN public.calendar_events e ON e.id=p.end_training_id
            WHERE (NEW.client_id=p.client_id OR NEW.client_id=ANY(COALESCE(p.shared_client_ids,'{}'::uuid[])))
              AND (NEW.event_date,NEW.event_hour)>=(s.event_date,s.event_hour)
              AND (NEW.event_date,NEW.event_hour)<=(e.event_date,e.event_hour)
        ) THEN RAISE EXCEPTION 'Nie można przenieść treningu do zamkniętego pakietu.'; END IF;
    IF protected THEN
        IF TG_OP='DELETE' THEN
            RAISE EXCEPTION 'Trening należy do zamkniętego pakietu. Nie można go usunąć.';
        ELSIF (OLD.event_date,OLD.event_hour,OLD.client_id,OLD.status,OLD.is_settled)
            IS DISTINCT FROM (NEW.event_date,NEW.event_hour,NEW.client_id,NEW.status,NEW.is_settled) THEN
            RAISE EXCEPTION 'Trening należy do zamkniętego pakietu. Nie można zmienić rozliczenia.';
        END IF;
    END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_closed_package_anchor() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS audit_closed_anchor_guard ON public.calendar_events;
CREATE TRIGGER audit_closed_anchor_guard BEFORE INSERT OR DELETE OR UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.protect_closed_package_anchor();

CREATE OR REPLACE FUNCTION public.record_absence_v3(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
    actor uuid := auth.uid();
    cid uuid := (p_payload->>'client_id')::uuid;
    day date := (p_payload->>'absence_date')::date;
    hour int := (p_payload->>'absence_hour')::int;
    paid boolean := COALESCE((p_payload->>'paid')::boolean,false);
    result public.absences%ROWTYPE;
BEGIN
    IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.clients WHERE id=cid AND trainer_id=actor) THEN
        RAISE EXCEPTION 'Client not owned' USING ERRCODE='42501';
    END IF;
    IF day IS NULL OR (hour IS NOT NULL AND hour NOT BETWEEN 6 AND 21) THEN
        RAISE EXCEPTION 'Nieprawidłowy termin nieobecności.';
    END IF;
    -- Same lock as workout, swap and deletion writes. Repeating the same request
    -- is idempotent, including whole-day absences (NULL is not SQL-unique).
    PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,0));
    IF paid AND NOT EXISTS (SELECT 1 FROM public.calendar_events
        WHERE trainer_id=actor AND client_id=cid AND event_date=day
          AND (hour IS NULL OR event_hour=hour)) THEN
        RAISE EXCEPTION 'Brak treningu do odwołania z płatnością.';
    END IF;
    UPDATE public.calendar_events
       SET status=CASE WHEN paid THEN 'cancelled' ELSE 'deleted' END,
           is_settled=paid, updated_at=now()
     WHERE trainer_id=actor AND client_id=cid AND event_date=day
       AND (hour IS NULL OR event_hour=hour);
    SELECT * INTO result FROM public.absences
     WHERE trainer_id=actor AND client_id=cid AND absence_date=day
       AND absence_hour IS NOT DISTINCT FROM hour ORDER BY created_at,id LIMIT 1 FOR UPDATE;
    IF result.id IS NULL THEN
        INSERT INTO public.absences(client_id,absence_date,absence_hour,trainer_id)
        VALUES(cid,day,hour,actor) RETURNING * INTO result;
    END IF;
    -- Keep package anchors (even deleted/free): a durable waiting boundary.
    RETURN to_jsonb(result);
END;
$$;
REVOKE ALL ON FUNCTION public.record_absence_v3(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_absence_v3(jsonb) TO authenticated;

-- Calendar metadata + exercise log replacement are one transaction. Optimistic
-- version check prevents a stale editor/autosave reviving a cancelled session.
CREATE OR REPLACE FUNCTION public.save_calendar_workout_v3(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
    actor uuid := auth.uid();
    old_ev public.calendar_events%ROWTYPE;
    new_ev public.calendar_events%ROWTYPE;
    cid uuid := (p_payload->>'client_id')::uuid;
    day date := (p_payload->>'event_date')::date;
    hour int := (p_payload->>'event_hour')::int;
    expected uuid := (p_payload->>'expected_event_id')::uuid;
    version timestamptz := (p_payload->>'expected_updated_at')::timestamptz;
    ref_id uuid;
    field text;
    logs jsonb := COALESCE(p_payload->'exercises','[]'::jsonb);
    saved_logs jsonb := '[]'::jsonb;
BEGIN
    IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM public.clients WHERE id=cid AND trainer_id=actor) THEN
        RAISE EXCEPTION 'Client not owned' USING ERRCODE='42501';
    END IF;
    IF day IS NULL OR hour IS NULL OR hour NOT BETWEEN 6 AND 21
       OR jsonb_typeof(logs) IS DISTINCT FROM 'array' OR jsonb_array_length(logs)>1000 THEN
        RAISE EXCEPTION 'Nieprawidłowy trening.';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,0));
    SELECT * INTO old_ev FROM public.calendar_events
      WHERE trainer_id=actor AND event_date=day AND event_hour=hour FOR UPDATE;
    IF old_ev.id IS DISTINCT FROM expected OR
       (old_ev.id IS NOT NULL AND (version IS NULL OR old_ev.updated_at IS DISTINCT FROM version)) THEN
        RAISE EXCEPTION 'Trening został zmieniony. Odśwież widok przed zapisem.';
    END IF;
    IF old_ev.id IS NOT NULL AND old_ev.client_id IS DISTINCT FROM cid
       AND EXISTS(SELECT 1 FROM public.client_packages WHERE start_training_id=old_ev.id OR end_training_id=old_ev.id) THEN
        RAISE EXCEPTION 'Trening jest kotwicą pakietu. Nie można zmienić klienta.';
    END IF;
    FOREACH field IN ARRAY ARRAY['partner_client_id','replaced_client_id'] LOOP
        ref_id := (p_payload->>field)::uuid;
        IF ref_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE id=ref_id AND trainer_id=actor) THEN
            RAISE EXCEPTION 'Client not owned' USING ERRCODE='42501';
        END IF;
    END LOOP;
    ref_id := (p_payload->>'workout_type_id')::uuid;
    IF ref_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.workout_types WHERE id=ref_id AND trainer_id=actor) THEN
        RAISE EXCEPTION 'Workout type not owned' USING ERRCODE='42501';
    END IF;
    ref_id := (p_payload->>'plan_id')::uuid;
    IF ref_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.training_plans WHERE id=ref_id AND trainer_id=actor) THEN
        RAISE EXCEPTION 'Plan not owned' USING ERRCODE='42501';
    END IF;
    IF jsonb_array_length(logs)>0 AND EXISTS(SELECT 1 FROM public.calendar_events
        WHERE trainer_id=actor AND client_id=cid AND event_date=day AND event_hour<>hour AND status<>'deleted') THEN
        RAISE EXCEPTION 'Kilka treningów klienta jednego dnia. Logi dzienne są niejednoznaczne — zapis zablokowany.';
    END IF;
    INSERT INTO public.calendar_events(id,event_date,event_hour,client_id,trainer_id,
        workout_type_id,plan_id,partner_client_id,note,main_group,added_groups,
        is_replacement,replaced_client_id,status,is_settled,updated_at)
    VALUES(COALESCE(old_ev.id,gen_random_uuid()),day,hour,cid,actor,
        (p_payload->>'workout_type_id')::uuid,(p_payload->>'plan_id')::uuid,
        (p_payload->>'partner_client_id')::uuid,p_payload->>'note',p_payload->>'main_group',
        COALESCE(p_payload->'added_groups','[]'::jsonb),COALESCE((p_payload->>'is_replacement')::boolean,false),
        (p_payload->>'replaced_client_id')::uuid,
        CASE WHEN p_payload->>'reactivate'='true' AND old_ev.status='deleted' THEN 'active' ELSE COALESCE(old_ev.status,'active') END,
        COALESCE(old_ev.is_settled,false),clock_timestamp())
    ON CONFLICT(id) DO UPDATE SET client_id=EXCLUDED.client_id,
        workout_type_id=EXCLUDED.workout_type_id,plan_id=EXCLUDED.plan_id,
        partner_client_id=EXCLUDED.partner_client_id,note=EXCLUDED.note,main_group=EXCLUDED.main_group,
        added_groups=EXCLUDED.added_groups,is_replacement=EXCLUDED.is_replacement,
        replaced_client_id=EXCLUDED.replaced_client_id,status=EXCLUDED.status,updated_at=EXCLUDED.updated_at
    RETURNING * INTO new_ev;
    IF new_ev.status='active' THEN
        DELETE FROM public.absences WHERE trainer_id=actor AND client_id=cid AND absence_date=day AND absence_hour=hour;
    END IF;
    IF jsonb_array_length(logs)>0 THEN
        saved_logs := public.save_workout_batch_v2(cid,day,1,actor,logs);
    END IF;
    RETURN jsonb_build_object('event',to_jsonb(new_ev),'logs',saved_logs);
END;
$$;
REVOKE ALL ON FUNCTION public.save_calendar_workout_v3(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_calendar_workout_v3(jsonb) TO authenticated;
COMMIT;
