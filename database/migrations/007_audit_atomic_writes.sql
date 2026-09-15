-- 007_audit_atomic_writes.sql
-- Prepared locally on 2026-09-13. NOT APPLIED to Supabase.
-- Requires schema + client_packages + shared packages migration 001.
-- Apply first to an isolated PostgreSQL/Supabase test database after review.
-- This transaction also replaces the unsafe historical RPC for existing callers.
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

CREATE OR REPLACE FUNCTION public.save_workout_batch_v2(
    p_client_id uuid, p_session_date date, p_week_number int,
    p_trainer_id uuid, p_logs jsonb
) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
    SELECT public.save_workout_batch_atomic(
        p_client_id, p_session_date, p_week_number, p_trainer_id, p_logs);
$$;
REVOKE ALL ON FUNCTION public.save_workout_batch_v2(uuid,date,int,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_workout_batch_v2(uuid,date,int,uuid,jsonb) TO authenticated;

-- Closed package boundaries must never silently become NULL or move.
-- The trigger sees hidden cross-tenant references too; it exposes no rows.
CREATE OR REPLACE FUNCTION public.protect_closed_package_anchor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.client_packages p
               WHERE p.end_training_id IS NOT NULL
                 AND (p.start_training_id = OLD.id OR p.end_training_id = OLD.id)) THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Trening wyznacza granicę zamkniętego pakietu. Nie można go usunąć.';
        ELSIF (OLD.event_date, OLD.event_hour, OLD.client_id)
              IS DISTINCT FROM (NEW.event_date, NEW.event_hour, NEW.client_id) THEN
            RAISE EXCEPTION 'Trening wyznacza granicę zamkniętego pakietu. Nie można go przenieść.';
        END IF;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_closed_package_anchor() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS audit_closed_anchor_guard ON public.calendar_events;
CREATE TRIGGER audit_closed_anchor_guard
BEFORE DELETE OR UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.protect_closed_package_anchor();

CREATE OR REPLACE FUNCTION public.calendar_mutation_v2(p_action text, p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp
AS $$
DECLARE
    actor uuid := auth.uid();
    first_ev public.calendar_events%ROWTYPE;
    second_ev public.calendar_events%ROWTYPE;
    replacement public.calendar_events%ROWTYPE;
    pkg public.client_packages%ROWTYPE;
    d1 date; d2 date; h1 int; h2 int;
    week_start date; week_end date;
    temporary_date date := DATE '1970-01-01';
    item jsonb;
    ids uuid[];
    item_client uuid; item_partner uuid; item_type uuid; item_plan uuid; item_replaced uuid;
    package_result text := 'none';
BEGIN
    IF actor IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;
    IF p_action IS NULL OR p_action NOT IN ('swap','replace_week','clear_week','delete','delete_start') THEN
        RAISE EXCEPTION 'Nieznana operacja kalendarza.';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(actor::text, 0));

    IF p_action = 'swap' THEN
        d1 := (p_data->>'date1')::date; d2 := (p_data->>'date2')::date;
        h1 := (p_data->>'hour1')::int; h2 := (p_data->>'hour2')::int;
        IF d1 IS NULL OR d2 IS NULL OR h1 IS NULL OR h2 IS NULL
           OR h1 NOT BETWEEN 6 AND 21 OR h2 NOT BETWEEN 6 AND 21 THEN
            RAISE EXCEPTION 'Nieprawidłowy termin.';
        END IF;
        SELECT * INTO first_ev FROM public.calendar_events
        WHERE trainer_id = actor AND event_date = d1 AND event_hour = h1 FOR UPDATE;
        SELECT * INTO second_ev FROM public.calendar_events
        WHERE trainer_id = actor AND event_date = d2 AND event_hour = h2 FOR UPDATE;
        IF first_ev.id IS NULL AND second_ev.id IS NULL THEN
            RAISE EXCEPTION 'Brak treningów do przeniesienia.';
        END IF;
        IF d1 = d2 AND h1 = h2 THEN RETURN '{"status":"swapped"}'::jsonb; END IF;
        -- Logs identify a client/day, not a calendar event. Refuse ambiguous moves.
        IF d1 <> d2 AND EXISTS (
            SELECT 1 FROM public.calendar_events e
            WHERE e.trainer_id = actor AND e.event_date IN (d1,d2)
              AND e.client_id IN (first_ev.client_id,second_ev.client_id)
              AND e.id IS DISTINCT FROM first_ev.id AND e.id IS DISTINCT FROM second_ev.id
              AND e.status <> 'deleted'
        ) THEN
            RAISE EXCEPTION 'Klient ma inny trening w jednym z tych dni. Przeniesienie logów byłoby niejednoznaczne.';
        END IF;
        IF d1 <> d2 AND EXISTS (
            SELECT 1 FROM public.workout_logs l WHERE l.trainer_id = actor AND (
                (l.client_id = first_ev.client_id AND l.session_date = d2
                 AND first_ev.client_id IS DISTINCT FROM second_ev.client_id)
                OR (l.client_id = second_ev.client_id AND l.session_date = d1
                    AND second_ev.client_id IS DISTINCT FROM first_ev.client_id)
            )
        ) THEN
            RAISE EXCEPTION 'W dniu docelowym istnieją już logi tego klienta.';
        END IF;
        IF first_ev.id IS NOT NULL AND second_ev.id IS NOT NULL THEN
            WHILE temporary_date IN (d1,d2) OR EXISTS (
                SELECT 1 FROM public.calendar_events
                WHERE trainer_id = actor AND event_date = temporary_date AND event_hour = 6
            ) LOOP temporary_date := temporary_date - 1; END LOOP;
            UPDATE public.calendar_events SET event_date=temporary_date,event_hour=6,updated_at=now()
            WHERE id=first_ev.id AND trainer_id=actor;
            UPDATE public.calendar_events SET event_date=d1,event_hour=h1,updated_at=now()
            WHERE id=second_ev.id AND trainer_id=actor;
            UPDATE public.calendar_events SET event_date=d2,event_hour=h2,updated_at=now()
            WHERE id=first_ev.id AND trainer_id=actor;
        ELSIF first_ev.id IS NOT NULL THEN
            UPDATE public.calendar_events SET event_date=d2,event_hour=h2,updated_at=now()
            WHERE id=first_ev.id AND trainer_id=actor;
        ELSE
            UPDATE public.calendar_events SET event_date=d1,event_hour=h1,updated_at=now()
            WHERE id=second_ev.id AND trainer_id=actor;
        END IF;
        IF d1 <> d2 THEN
            UPDATE public.workout_logs SET session_date = CASE
                WHEN client_id=first_ev.client_id AND session_date=d1 THEN d2 ELSE d1 END,
                updated_at=now()
            WHERE trainer_id=actor AND (
                (client_id=first_ev.client_id AND session_date=d1)
                OR (client_id=second_ev.client_id AND session_date=d2));
        END IF;
        DELETE FROM public.absences WHERE trainer_id=actor AND (
            (client_id=first_ev.client_id AND absence_date=d2 AND absence_hour=h2)
            OR (client_id=second_ev.client_id AND absence_date=d1 AND absence_hour=h1));
        RETURN '{"status":"swapped"}'::jsonb;
    END IF;

    IF p_action IN ('replace_week','clear_week') THEN
        week_start := (p_data->>'monday_date')::date;
        IF week_start IS NULL OR extract(isodow FROM week_start) <> 1 THEN
            RAISE EXCEPTION 'Wskaż poniedziałek.';
        END IF;
        week_end := week_start + CASE WHEN p_action='replace_week' THEN 5 ELSE 6 END;
        IF p_action='replace_week' THEN
            IF jsonb_typeof(p_data->'events') IS DISTINCT FROM 'array'
               OR jsonb_array_length(p_data->'events') > 96 THEN
                RAISE EXCEPTION 'Nieprawidłowa lista treningów tygodnia.';
            END IF;
            IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_data->'events') x
                       GROUP BY x->>'event_date', x->>'event_hour' HAVING count(*)>1) THEN
                RAISE EXCEPTION 'Powtórzony termin w tygodniu.';
            END IF;
            FOR item IN SELECT value FROM jsonb_array_elements(p_data->'events') LOOP
                d1 := (item->>'event_date')::date; h1 := (item->>'event_hour')::int;
                IF d1 IS NULL OR h1 IS NULL OR d1 NOT BETWEEN week_start AND week_end OR h1 NOT BETWEEN 6 AND 21 THEN
                    RAISE EXCEPTION 'Trening poza wybranym tygodniem lub godzinami.';
                END IF;
                IF EXISTS (SELECT 1 FROM public.calendar_events WHERE trainer_id=actor
                           AND event_date=d1 AND event_hour=h1 AND is_settled IS TRUE) THEN
                    RAISE EXCEPTION 'Nie można zastąpić opłaconego treningu.';
                END IF;
                item_client := (item->>'client_id')::uuid;
                item_partner := (item->>'partner_client_id')::uuid;
                item_replaced := (item->>'replaced_client_id')::uuid;
                item_type := (item->>'workout_type_id')::uuid;
                item_plan := (item->>'plan_id')::uuid;
                IF EXISTS (SELECT 1 FROM unnest(ARRAY[item_client,item_partner,item_replaced]) cid
                           WHERE cid IS NOT NULL AND NOT EXISTS (
                               SELECT 1 FROM public.clients WHERE id=cid AND trainer_id=actor)) THEN
                    RAISE EXCEPTION 'Client not owned' USING ERRCODE='42501';
                END IF;
                IF item_type IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM public.workout_types WHERE id=item_type AND trainer_id=actor
                ) THEN RAISE EXCEPTION 'Type not owned' USING ERRCODE='42501'; END IF;
                IF item_plan IS NOT NULL AND NOT EXISTS (
                    SELECT 1 FROM public.training_plans WHERE id=item_plan AND trainer_id=actor
                ) THEN RAISE EXCEPTION 'Plan not owned' USING ERRCODE='42501'; END IF;
            END LOOP;
        END IF;
        SELECT coalesce(array_agg(id),'{}'::uuid[]) INTO ids FROM public.calendar_events
        WHERE trainer_id=actor AND event_date BETWEEN week_start AND week_end AND is_settled IS FALSE;
        -- Closed anchors reject the entire transaction, before package cancellations.
        IF EXISTS (SELECT 1 FROM public.client_packages WHERE end_training_id IS NOT NULL
                   AND (start_training_id=ANY(ids) OR end_training_id=ANY(ids))) THEN
            RAISE EXCEPTION 'Tydzień zawiera granicę zamkniętego pakietu.';
        END IF;
        IF EXISTS (SELECT 1 FROM public.client_packages WHERE trainer_id=actor
            AND end_training_id IS NULL AND start_training_id=ANY(ids)) THEN
            RAISE EXCEPTION 'Tydzień zawiera początek aktywnego pakietu. Przenieś początek przed zmianą tygodnia.';
        END IF;
        DELETE FROM public.calendar_events WHERE trainer_id=actor AND id=ANY(ids);
        -- Keep session logs for week template operations, matching existing behavior.
        IF p_action='replace_week' THEN
            FOR item IN SELECT value FROM jsonb_array_elements(p_data->'events') LOOP
                INSERT INTO public.calendar_events (
                    trainer_id,event_date,event_hour,client_id,partner_client_id,workout_type_id,
                    plan_id,status,is_settled,note,main_group,added_groups,is_replacement,replaced_client_id
                ) VALUES (
                    actor,(item->>'event_date')::date,(item->>'event_hour')::int,
                    (item->>'client_id')::uuid,(item->>'partner_client_id')::uuid,
                    (item->>'workout_type_id')::uuid,(item->>'plan_id')::uuid,
                    coalesce(item->>'status','active'),coalesce((item->>'is_settled')::boolean,false),
                    item->>'note',item->>'main_group',coalesce(item->'added_groups','[]'::jsonb),
                    coalesce((item->>'is_replacement')::boolean,false),(item->>'replaced_client_id')::uuid
                );
                DELETE FROM public.absences WHERE trainer_id=actor
                AND client_id=(item->>'client_id')::uuid
                AND absence_date=(item->>'event_date')::date AND absence_hour=(item->>'event_hour')::int;
            END LOOP;
            RETURN '{"status":"replaced"}'::jsonb;
        END IF;
        RETURN '{"status":"cleared"}'::jsonb;
    END IF;

    d1 := (p_data->>'event_date')::date; h1 := (p_data->>'event_hour')::int;
    SELECT * INTO first_ev FROM public.calendar_events
    WHERE trainer_id=actor AND event_date=d1 AND event_hour=h1 FOR UPDATE;
    IF first_ev.id IS NULL THEN RAISE EXCEPTION 'Nie znaleziono treningu.'; END IF;
    IF EXISTS (SELECT 1 FROM public.client_packages WHERE end_training_id IS NOT NULL
               AND (start_training_id=first_ev.id OR end_training_id=first_ev.id)) THEN
        RAISE EXCEPTION 'Trening wyznacza granicę zamkniętego pakietu. Nie można go usunąć.';
    END IF;
    IF p_action='delete_start' AND (p_data->>'mode') IS DISTINCT FROM 'cancel'
       AND (p_data->>'mode') IS DISTINCT FROM 'repoint' THEN
        RAISE EXCEPTION 'Nieznany tryb usunięcia początku pakietu.';
    END IF;
    FOR pkg IN SELECT * FROM public.client_packages
               WHERE trainer_id=actor AND start_training_id=first_ev.id AND end_training_id IS NULL FOR UPDATE LOOP
        IF p_action <> 'delete_start' THEN
            RAISE EXCEPTION 'Trening rozpoczyna aktywny pakiet. Wybierz anulowanie lub nowy początek.';
        END IF;
        IF p_data->>'mode' = 'cancel' THEN
            DELETE FROM public.client_packages WHERE id=pkg.id AND trainer_id=actor;
            package_result := 'cancelled';
        ELSE
            SELECT * INTO replacement FROM public.calendar_events
            WHERE trainer_id=actor AND id=(p_data->>'new_event_id')::uuid FOR UPDATE;
            IF replacement.id IS NULL OR replacement.status='deleted'
               OR (replacement.status='cancelled' AND NOT coalesce(replacement.is_settled,false))
               OR (replacement.event_date,replacement.event_hour) <= (first_ev.event_date,first_ev.event_hour)
               OR replacement.client_id IS NULL
               OR NOT (replacement.client_id=pkg.client_id OR replacement.client_id=ANY(pkg.shared_client_ids)) THEN
                RAISE EXCEPTION 'Nowy początek musi być kolejnym treningiem tego pakietu.';
            END IF;
            IF EXISTS (SELECT 1 FROM public.client_packages other WHERE other.id<>pkg.id
                       AND (other.start_training_id=replacement.id OR other.end_training_id=replacement.id)) THEN
                RAISE EXCEPTION 'Nowy początek jest już granicą innego pakietu.';
            END IF;
            UPDATE public.client_packages SET start_training_id=replacement.id,updated_at=now()
            WHERE id=pkg.id AND trainer_id=actor;
            package_result := 'repointed';
        END IF;
    END LOOP;
    IF first_ev.client_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.calendar_events WHERE trainer_id=actor AND client_id=first_ev.client_id
        AND event_date=d1 AND id<>first_ev.id AND status<>'deleted'
    ) AND EXISTS (SELECT 1 FROM public.workout_logs WHERE trainer_id=actor
                  AND client_id=first_ev.client_id AND session_date=d1) THEN
        RAISE EXCEPTION 'Klient ma kilka treningów tego dnia. Nie można jednoznacznie usunąć logów.';
    END IF;
    INSERT INTO public.deleted_workouts(event_date,event_hour,client_name,workout_type,trainer_id)
    VALUES (d1,h1,
        (SELECT name FROM public.clients WHERE id=first_ev.client_id AND trainer_id=actor),
        (SELECT name FROM public.workout_types WHERE id=first_ev.workout_type_id AND trainer_id=actor),actor);
    DELETE FROM public.workout_logs WHERE trainer_id=actor AND client_id=first_ev.client_id AND session_date=d1;
    DELETE FROM public.absences WHERE trainer_id=actor AND client_id=first_ev.client_id
    AND absence_date=d1 AND absence_hour=h1;
    DELETE FROM public.calendar_events WHERE trainer_id=actor AND id=first_ev.id;
    RETURN jsonb_build_object('status','deleted','package',package_result,'new_start_event_id',replacement.id);
END;
$$;
REVOKE ALL ON FUNCTION public.calendar_mutation_v2(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calendar_mutation_v2(text,jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
