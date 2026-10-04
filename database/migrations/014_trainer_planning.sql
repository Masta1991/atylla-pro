-- Additive planning storage; no calendar or billing mutations.
BEGIN;
CREATE TABLE IF NOT EXISTS public.trainer_planning_preferences (
    trainer_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    preferences jsonb NOT NULL CHECK (jsonb_typeof(preferences) = 'object'),
    revision integer NOT NULL CHECK (revision > 0),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS public.trainer_planning_analyses (
    trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    months integer NOT NULL CHECK (months IN (3,6)),
    goal text NOT NULL CHECK (goal IN ('balance','time','income')),
    preferences jsonb NOT NULL,
    answers jsonb NOT NULL,
    questions jsonb NOT NULL,
    result jsonb NOT NULL,
    request_payload jsonb NOT NULL,
    request_fingerprint text NOT NULL,
    PRIMARY KEY (trainer_id,id),
    CHECK (octet_length(result::text) <= 200000),
    CHECK (octet_length(request_payload::text) <= 100000)
);
CREATE INDEX IF NOT EXISTS trainer_planning_recent ON public.trainer_planning_analyses(trainer_id,created_at DESC);
ALTER TABLE public.trainer_planning_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainer_planning_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS planning_preferences_owner ON public.trainer_planning_preferences;
CREATE POLICY planning_preferences_owner ON public.trainer_planning_preferences TO authenticated
    USING (trainer_id=auth.uid()) WITH CHECK (trainer_id=auth.uid());
DROP POLICY IF EXISTS planning_analyses_owner ON public.trainer_planning_analyses;
CREATE POLICY planning_analyses_owner ON public.trainer_planning_analyses TO authenticated
    USING (trainer_id=auth.uid()) WITH CHECK (trainer_id=auth.uid());
REVOKE ALL ON public.trainer_planning_preferences,public.trainer_planning_analyses FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.trainer_planning_preferences,public.trainer_planning_analyses TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_trainer_planning_preferences_v1(p jsonb, actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE item jsonb; start_hour integer; end_hour integer; key text;
BEGIN
    IF actor IS NULL THEN RAISE EXCEPTION 'Unauthorized trainer' USING ERRCODE='42501'; END IF;
    IF p IS NULL OR jsonb_typeof(p) <> 'object' OR octet_length(p::text)>80000 THEN RAISE EXCEPTION 'Nieprawidłowe preferencje.'; END IF;
    FOREACH key IN ARRAY ARRAY['start_hour','session_minutes','start_on_hour','goal','max_consecutive','end_hour','allowed_weekdays','protected_windows','locked_client_ids','session_price'] LOOP
        IF NOT p ? key THEN RAISE EXCEPTION 'Niepełne preferencje.'; END IF;
    END LOOP;
    IF (SELECT count(*) FROM jsonb_object_keys(p)) <> 10 THEN RAISE EXCEPTION 'Nieprawidłowe pola preferencji.'; END IF;
    IF jsonb_typeof(p->'start_hour') <> 'number' OR (p->>'start_hour') !~ '^([6-9]|1[0-9]|2[01])$'
       OR p->'session_minutes' <> '60'::jsonb OR p->'start_on_hour' <> 'true'::jsonb
       OR jsonb_typeof(p->'goal') IS DISTINCT FROM 'string'
       OR p->>'goal' NOT IN ('balance','time','income') THEN RAISE EXCEPTION 'Nieprawidłowe reguły grafiku.'; END IF;
    start_hour := (p->>'start_hour')::integer;
    IF p->'end_hour' <> 'null'::jsonb THEN
        IF jsonb_typeof(p->'end_hour') <> 'number' OR (p->>'end_hour') !~ '^([7-9]|1[0-9]|2[0-2])$' THEN RAISE EXCEPTION 'Nieprawidłowy koniec dnia.'; END IF;
        end_hour := (p->>'end_hour')::integer;
        IF end_hour <= start_hour THEN RAISE EXCEPTION 'Nieprawidłowy koniec dnia.'; END IF;
    END IF;
    IF p->'max_consecutive' <> 'null'::jsonb AND (jsonb_typeof(p->'max_consecutive') <> 'number' OR (p->>'max_consecutive') !~ '^([1-9]|1[0-6])$') THEN
        RAISE EXCEPTION 'Nieprawidłowy limit sesji.';
    END IF;
    IF p->'session_price' <> 'null'::jsonb THEN
        IF jsonb_typeof(p->'session_price') <> 'number' THEN RAISE EXCEPTION 'Nieprawidłowa stawka.'; END IF;
        IF (p->>'session_price')::numeric NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Nieprawidłowa stawka.'; END IF;
    END IF;
    IF p->'allowed_weekdays' <> 'null'::jsonb THEN
        IF jsonb_typeof(p->'allowed_weekdays') <> 'array' THEN RAISE EXCEPTION 'Nieprawidłowe dni.'; END IF;
        IF jsonb_array_length(p->'allowed_weekdays') NOT BETWEEN 0 AND 7 THEN RAISE EXCEPTION 'Nieprawidłowe dni.'; END IF;
        IF EXISTS(SELECT 1 FROM jsonb_array_elements(p->'allowed_weekdays') d WHERE jsonb_typeof(d)<>'number' OR d::text !~ '^[0-6]$')
           OR (SELECT count(DISTINCT d) FROM jsonb_array_elements(p->'allowed_weekdays') d) <> jsonb_array_length(p->'allowed_weekdays') THEN
            RAISE EXCEPTION 'Nieprawidłowe dni.';
        END IF;
    END IF;
    IF jsonb_typeof(p->'protected_windows') <> 'array' OR jsonb_typeof(p->'locked_client_ids') <> 'array' THEN RAISE EXCEPTION 'Nieprawidłowe ograniczenia.'; END IF;
    IF jsonb_array_length(p->'protected_windows')>100 OR jsonb_array_length(p->'locked_client_ids')>1000 THEN RAISE EXCEPTION 'Za dużo ograniczeń.'; END IF;
    FOR item IN SELECT * FROM jsonb_array_elements(p->'protected_windows') LOOP
        IF jsonb_typeof(item)<>'object' OR NOT item ?& ARRAY['start_hour','end_hour']
           OR jsonb_typeof(item->'start_hour')<>'number' OR (item->>'start_hour') !~ '^([6-9]|1[0-9]|2[01])$'
           OR jsonb_typeof(item->'end_hour')<>'number' OR (item->>'end_hour') !~ '^([7-9]|1[0-9]|2[0-2])$'
           OR (item->>'end_hour')::integer <= (item->>'start_hour')::integer
           OR ((item->>'weekday') IS NULL) = ((item->>'date') IS NULL) THEN RAISE EXCEPTION 'Nieprawidłowe chronione okno.'; END IF;
        IF item->>'weekday' IS NOT NULL AND (jsonb_typeof(item->'weekday')<>'number' OR (item->>'weekday') !~ '^[0-6]$') THEN RAISE EXCEPTION 'Nieprawidłowy dzień okna.'; END IF;
        IF item->>'date' IS NOT NULL THEN
            IF (item->>'date') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Nieprawidłowa data okna.'; END IF;
            PERFORM (item->>'date')::date;
        END IF;
    END LOOP;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p->'locked_client_ids') i
              WHERE NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=i::uuid AND c.trainer_id=actor)) THEN
        RAISE EXCEPTION 'Nie znaleziono wskazanego klienta.' USING ERRCODE='42501';
    END IF;
    IF (SELECT count(DISTINCT i) FROM jsonb_array_elements_text(p->'locked_client_ids') i) <> jsonb_array_length(p->'locked_client_ids') THEN RAISE EXCEPTION 'Powtórzony klient.'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.write_trainer_planning_preferences_v1(p_actor uuid,p_preferences jsonb,p_expected_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=p_actor; current_revision integer; saved public.trainer_planning_preferences%ROWTYPE;
BEGIN
    PERFORM public.validate_trainer_planning_preferences_v1(p_preferences,actor);
    IF p_expected_revision IS NULL OR p_expected_revision<0 THEN RAISE EXCEPTION 'Nieprawidłowa wersja preferencji.'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,0));
    SELECT revision INTO current_revision FROM public.trainer_planning_preferences WHERE trainer_id=actor;
    IF coalesce(current_revision,0) <> p_expected_revision THEN RAISE EXCEPTION 'Preferencje zmieniły się. Odśwież je przed zapisem.'; END IF;
    INSERT INTO public.trainer_planning_preferences(trainer_id,preferences,revision)
    VALUES(actor,p_preferences,p_expected_revision+1)
    ON CONFLICT(trainer_id) DO UPDATE SET preferences=EXCLUDED.preferences,revision=EXCLUDED.revision,updated_at=clock_timestamp()
    RETURNING * INTO saved;
    RETURN jsonb_build_object('preferences',saved.preferences,'revision',saved.revision);
END; $$;

CREATE OR REPLACE FUNCTION public.save_trainer_planning_preferences_v1(p_preferences jsonb,p_expected_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
    RETURN public.write_trainer_planning_preferences_v1(auth.uid(),p_preferences,p_expected_revision);
END; $$;

-- Remove the earlier development-only signature; user tokens must never submit computed results.
DROP FUNCTION IF EXISTS public.save_trainer_planning_analysis_v1(jsonb,jsonb);
CREATE OR REPLACE FUNCTION public.save_trainer_planning_analysis_v1(p_actor uuid,p_request jsonb,p_snapshot jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor uuid:=p_actor; rid uuid; fingerprint text; saved public.trainer_planning_analyses%ROWTYPE;
        current_revision integer; expected integer; item jsonb; client_ref text;
BEGIN
    IF actor IS NULL THEN RAISE EXCEPTION 'Unauthorized trainer' USING ERRCODE='42501'; END IF;
    IF p_request IS NULL OR p_snapshot IS NULL OR jsonb_typeof(p_request)<>'object' OR jsonb_typeof(p_snapshot)<>'object'
       OR octet_length(p_request::text)>100000 OR octet_length(p_snapshot::text)>300000 THEN RAISE EXCEPTION 'Nieprawidłowa analiza.'; END IF;
    IF NOT p_request ?& ARRAY['request_id','months','preferences','answers','save_preferences','expected_revision'] THEN RAISE EXCEPTION 'Niepełna analiza.'; END IF;
    rid := (p_request->>'request_id')::uuid;
    IF rid IS NULL THEN RAISE EXCEPTION 'Brak identyfikatora analizy.'; END IF;
    fingerprint := encode(sha256(convert_to(p_request::text,'UTF8')),'hex');
    PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,0));
    SELECT * INTO saved FROM public.trainer_planning_analyses WHERE trainer_id=actor AND id=rid;
    IF FOUND THEN
        IF saved.request_fingerprint<>fingerprint OR saved.request_payload<>p_request THEN RAISE EXCEPTION 'Ten identyfikator analizy został już użyty z innymi odpowiedziami.'; END IF;
        RETURN to_jsonb(saved);
    END IF;
    PERFORM public.validate_trainer_planning_preferences_v1(p_request->'preferences',actor);
    IF jsonb_typeof(p_request->'months')<>'number' OR p_request->>'months' NOT IN ('3','6')
       OR jsonb_typeof(p_request->'expected_revision')<>'number' OR (p_request->>'expected_revision') !~ '^\d{1,9}$'
       OR jsonb_typeof(p_request->'save_preferences')<>'boolean'
       OR jsonb_typeof(p_request->'answers')<>'object' THEN RAISE EXCEPTION 'Nieprawidłowe parametry analizy.'; END IF;
    expected := (p_request->>'expected_revision')::integer;
    SELECT revision INTO current_revision FROM public.trainer_planning_preferences WHERE trainer_id=actor;
    IF coalesce(current_revision,0)<>expected THEN RAISE EXCEPTION 'Preferencje zmieniły się. Odśwież je przed analizą.'; END IF;
    IF NOT p_snapshot ?& ARRAY['months','preferences','answers','questions','result']
       OR p_snapshot->'months'<>p_request->'months'
       OR ((p_snapshot->'preferences')-'protected_windows')<>((p_request->'preferences')-'protected_windows')
       OR jsonb_typeof(p_snapshot->'answers') IS DISTINCT FROM 'object' OR jsonb_typeof(p_snapshot->'questions') IS DISTINCT FROM 'array'
       OR jsonb_typeof(p_snapshot->'result') IS DISTINCT FROM 'object' OR jsonb_typeof(p_snapshot->'result'->'proposals') IS DISTINCT FROM 'array'
       OR jsonb_array_length(p_snapshot->'questions')>40 OR jsonb_array_length(p_snapshot->'result'->'proposals')>56 THEN RAISE EXCEPTION 'Nieprawidłowy wynik analizy.'; END IF;
    PERFORM public.validate_trainer_planning_preferences_v1(p_snapshot->'preferences',actor);
    IF NOT (p_snapshot->'preferences'->'protected_windows') @> (p_request->'preferences'->'protected_windows') THEN RAISE EXCEPTION 'Nie można usunąć chronionych okien odpowiedzią analizy.'; END IF;
    -- Validate all client references in proposals independently of application validation.
    FOR item IN SELECT * FROM jsonb_array_elements(p_snapshot->'result'->'proposals') LOOP
        IF jsonb_typeof(item->'clients') IS DISTINCT FROM 'array' OR jsonb_typeof(item->'moves') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Nieprawidłowa propozycja.'; END IF;
        FOR client_ref IN
            SELECT c->>'id' FROM jsonb_array_elements(item->'clients') c
            UNION ALL SELECT jsonb_array_elements_text(m->'client_ids') FROM jsonb_array_elements(item->'moves') m
        LOOP
            IF client_ref IS NULL OR NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=client_ref::uuid AND c.trainer_id=actor) THEN
                RAISE EXCEPTION 'Nie znaleziono wskazanego klienta.' USING ERRCODE='42501';
            END IF;
        END LOOP;
    END LOOP;
    IF (p_request->>'save_preferences')::boolean THEN
        PERFORM public.write_trainer_planning_preferences_v1(actor,p_snapshot->'preferences',expected);
    END IF;
    INSERT INTO public.trainer_planning_analyses(trainer_id,id,months,goal,preferences,answers,questions,result,request_payload,request_fingerprint)
    VALUES(actor,rid,(p_snapshot->>'months')::integer,p_snapshot->'preferences'->>'goal',p_snapshot->'preferences',p_snapshot->'answers',p_snapshot->'questions',p_snapshot->'result',p_request,fingerprint)
    RETURNING * INTO saved;
    RETURN to_jsonb(saved);
END; $$;
REVOKE ALL ON FUNCTION public.validate_trainer_planning_preferences_v1(jsonb,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.write_trainer_planning_preferences_v1(uuid,jsonb,integer) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.save_trainer_planning_preferences_v1(jsonb,integer) FROM PUBLIC,anon,service_role;
REVOKE ALL ON FUNCTION public.save_trainer_planning_analysis_v1(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_trainer_planning_preferences_v1(jsonb,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_trainer_planning_analysis_v1(uuid,jsonb,jsonb) TO service_role;
COMMIT;
