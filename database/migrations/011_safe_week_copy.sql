-- Atylla Pro 2.1.6. Additive migration; requires migrations 007-010.
-- Does not modify existing training, absence or billing records.
BEGIN;
DO $$ BEGIN
  IF to_regprocedure('public.save_calendar_workout_v4(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Najpierw zainstaluj migrację 010.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.copy_week_safe_v1(p_monday date, p_items jsonb, p_commit boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp
AS $$
DECLARE
  actor uuid := auth.uid(); item jsonb; ev public.calendar_events%ROWTYPE;
  day date; hour int; cid uuid; partner uuid; typ uuid; plan uuid; replace_slot boolean;
  absence_rows jsonb; decision text; fingerprint text; can_replace boolean; result jsonb := '[]'::jsonb;
  inserted int := 0; replaced int := 0; skipped int := 0; changed_id uuid;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF p_monday IS NULL OR extract(isodow FROM p_monday)<>1
     OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Nieprawidłowy tydzień lub lista.'; END IF;
  IF jsonb_array_length(p_items) NOT BETWEEN 1 AND 96 THEN RAISE EXCEPTION 'Wybierz od 1 do 96 pozycji.'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_items) x GROUP BY x->>'key' HAVING count(*)>1) THEN
    RAISE EXCEPTION 'Powtórzone pozycje.';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,0));
  -- Also serialize legacy direct upserts and absence deletion, which do not take the advisory lock.
  LOCK TABLE public.calendar_events,public.absences,public.workout_logs,public.client_packages IN SHARE ROW EXCLUSIVE MODE;
  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    day := (item->>'event_date')::date; hour := (item->>'event_hour')::int;
    cid := (item->>'client_id')::uuid; partner := (item->>'partner_client_id')::uuid;
    typ := (item->>'workout_type_id')::uuid; plan := (item->>'plan_id')::uuid;
    replace_slot := coalesce((item->>'replace')::boolean,false);
    IF day IS NULL OR hour IS NULL OR day NOT BETWEEN p_monday AND p_monday+5 OR hour NOT BETWEEN 6 AND 21 THEN
      RAISE EXCEPTION 'Termin poza wybranym tygodniem lub godzinami.';
    END IF;
    IF cid IS NULL OR NOT EXISTS(SELECT 1 FROM public.clients WHERE id=cid AND trainer_id=actor)
       OR (partner IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients WHERE id=partner AND trainer_id=actor)) THEN
      RAISE EXCEPTION 'Client not owned' USING ERRCODE='42501';
    END IF;
    IF partner=cid THEN RAISE EXCEPTION 'Uczestnicy treningu muszą być różni.'; END IF;
    IF typ IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.workout_types WHERE id=typ AND trainer_id=actor) THEN
      RAISE EXCEPTION 'Type not owned' USING ERRCODE='42501'; END IF;
    IF plan IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.training_plans WHERE id=plan AND trainer_id=actor) THEN
      RAISE EXCEPTION 'Plan not owned' USING ERRCODE='42501'; END IF;
    SELECT * INTO ev FROM public.calendar_events WHERE trainer_id=actor AND event_date=day AND event_hour=hour;
    SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb) INTO absence_rows
      FROM public.absences a WHERE a.trainer_id=actor AND a.client_id IN (cid,partner)
      AND a.absence_date=day AND (a.absence_hour IS NULL OR a.absence_hour=hour);
    can_replace := ev.id IS NOT NULL AND ev.is_settled IS FALSE
      AND NOT EXISTS(SELECT 1 FROM public.workout_logs WHERE trainer_id=actor AND calendar_event_id=ev.id)
      AND NOT EXISTS(SELECT 1 FROM public.client_packages WHERE trainer_id=actor AND (start_training_id=ev.id OR end_training_id=ev.id));
    IF (day + make_time(hour,0,0)) AT TIME ZONE 'Europe/Warsaw' <= clock_timestamp() THEN
      decision := 'past'; can_replace := false;
    ELSIF (SELECT count(*) FROM jsonb_array_elements(p_items) x WHERE (x->>'event_date')::date=day AND (x->>'event_hour')::int=hour)>1 THEN
      decision := 'duplicate'; can_replace := false;
    ELSIF jsonb_array_length(absence_rows)>0 THEN
      decision := 'absence'; can_replace := false;
    ELSIF ev.id IS NULL THEN decision := 'add'; can_replace := false;
    ELSIF ev.status='active' AND ev.client_id=cid AND ev.partner_client_id IS NOT DISTINCT FROM partner THEN
      decision := 'existing'; can_replace := false;
    ELSIF NOT can_replace THEN decision := 'protected';
    ELSIF replace_slot THEN decision := 'replace';
    ELSE decision := 'conflict'; END IF;
    fingerprint := md5(jsonb_build_array(to_jsonb(ev),absence_rows,item-'fingerprint',decision)::text);
    IF p_commit AND (item->>'fingerprint') IS DISTINCT FROM fingerprint THEN
      RAISE EXCEPTION 'Dane zmieniły się od podglądu. Odśwież podgląd przed zapisem.';
    END IF;
    changed_id := NULL;
    IF p_commit AND decision='add' THEN
      INSERT INTO public.calendar_events(trainer_id,client_id,partner_client_id,event_date,event_hour,
        workout_type_id,plan_id,main_group,added_groups,status,is_settled,is_replacement)
      VALUES(actor,cid,partner,day,hour,typ,plan,item->>'main_group',coalesce(nullif(item->'added_groups','null'::jsonb),'[]'::jsonb),'active',false,false)
      RETURNING id INTO changed_id;
      inserted := inserted+1;
    ELSIF p_commit AND decision='replace' THEN
      UPDATE public.calendar_events SET client_id=cid,partner_client_id=partner,workout_type_id=typ,plan_id=plan,
        main_group=item->>'main_group',added_groups=coalesce(nullif(item->'added_groups','null'::jsonb),'[]'::jsonb),
        status='active',is_settled=false,is_replacement=false,replaced_client_id=NULL,note=NULL,updated_at=clock_timestamp()
        WHERE id=ev.id AND trainer_id=actor RETURNING id INTO changed_id;
      replaced := replaced+1;
    ELSIF p_commit THEN skipped := skipped+1;
    END IF;
    result := result || jsonb_build_array(jsonb_build_object('key',item->>'key','action',decision,
      'fingerprint',fingerprint,'can_replace',can_replace,'occupied_client_id',ev.client_id,'event_id',changed_id,
      'event_date',day,'event_hour',hour));
  END LOOP;
  RETURN jsonb_build_object('rows',result,'inserted',inserted,'replaced',replaced,'skipped',skipped,'committed',p_commit);
END;
$$;
REVOKE ALL ON FUNCTION public.copy_week_safe_v1(date,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.copy_week_safe_v1(date,jsonb,boolean) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT to_regprocedure('public.copy_week_safe_v1(date,jsonb,boolean)') IS NOT NULL AS installed;
