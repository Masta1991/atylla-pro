-- Apply after 008. All billing reads and writes share one transaction.
BEGIN;
CREATE OR REPLACE FUNCTION public.billing_cycle_v1(
    p_client_id uuid, p_action text, p_expected_updated_at timestamptz,
    p_end_date date DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp
AS $$
DECLARE
    actor uuid := auth.uid();
    client public.clients%ROWTYPE;
    completed integer;
    members uuid[];
BEGIN
    IF actor IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE='42501'; END IF;
    IF p_action NOT IN ('close','reset') OR p_action IS NULL THEN
        RAISE EXCEPTION 'Nieprawidłowa operacja.';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.clients WHERE id=p_client_id AND trainer_id=actor) THEN
        RAISE EXCEPTION 'Client not owned' USING ERRCODE='42501';
    END IF;
    -- Match existing write RPC lock ordering. Table locks also cover legacy
    -- direct REST writers and inserts (row locks alone miss new events/links).
    -- These rare operations briefly serialize writes, including other trainers.
    PERFORM pg_advisory_xact_lock(hashtextextended(actor::text,0));
    LOCK TABLE public.clients, public.client_packages, public.calendar_events,
        public.absences IN SHARE ROW EXCLUSIVE MODE;
    SELECT * INTO client FROM public.clients
        WHERE id=p_client_id AND trainer_id=actor FOR UPDATE;
    IF client.id IS NULL THEN RAISE EXCEPTION 'Client not owned' USING ERRCODE='42501'; END IF;
    IF p_expected_updated_at IS NULL OR client.updated_at IS DISTINCT FROM p_expected_updated_at THEN
        RAISE EXCEPTION 'Rozliczenie zostało zmienione. Odśwież dane przed kolejną próbą.';
    END IF;
    IF p_action='close' THEN
        IF COALESCE(client.billing_type,'single')='package' THEN
            RAISE EXCEPTION 'Pakiet zamyka przepływ end-at, nie close-cycle';
        END IF;
        IF client.package_purchase_date IS NULL THEN RAISE EXCEPTION 'Brak otwartego cyklu'; END IF;
        IF p_end_date IS NULL OR p_end_date<client.package_purchase_date THEN
            RAISE EXCEPTION 'Koniec nie może być przed startem cyklu';
        END IF;
        -- Same one-level, bidirectional membership as monthly_share_group.
        SELECT array_agg(id) INTO members FROM public.clients
        WHERE trainer_id=actor AND (id=p_client_id
            OR id=ANY(COALESCE(client.shared_monthly_with,'{}'::uuid[]))
            OR p_client_id=ANY(COALESCE(shared_monthly_with,'{}'::uuid[])));
        SELECT count(*) INTO completed FROM public.calendar_events e
        WHERE e.trainer_id=actor AND e.client_id=ANY(members)
          AND e.event_date BETWEEN client.package_purchase_date AND p_end_date
          AND ((e.status='cancelled' AND e.is_settled IS TRUE)
            OR (e.status='active' AND
                ((e.event_date + make_interval(hours=>e.event_hour+1)) AT TIME ZONE 'Europe/Warsaw')
                    <= statement_timestamp()));
        UPDATE public.clients SET payment_history=COALESCE(payment_history,'[]'::jsonb)
            || jsonb_build_array(jsonb_build_object('action','end','end_date',p_end_date,
                'purchase_date',client.package_purchase_date,'archived_at',clock_timestamp(),
                'package_size',0,'completed_count',completed)),
            package_purchase_date=NULL, package_current_count=0,
            updated_at=clock_timestamp()
        WHERE id=p_client_id AND trainer_id=actor RETURNING * INTO client;
    ELSE
        DELETE FROM public.client_packages WHERE client_id=p_client_id AND trainer_id=actor;
        UPDATE public.client_packages
            SET shared_client_ids=array_remove(shared_client_ids,p_client_id), updated_at=clock_timestamp()
            WHERE trainer_id=actor AND p_client_id=ANY(shared_client_ids);
        UPDATE public.clients
            SET shared_monthly_with=array_remove(shared_monthly_with,p_client_id), updated_at=clock_timestamp()
            WHERE trainer_id=actor AND id<>p_client_id AND p_client_id=ANY(shared_monthly_with);
        UPDATE public.clients SET package_purchase_date=NULL, package_current_count=0,
            package_size=0, shared_monthly_with='{}'::uuid[], updated_at=clock_timestamp()
            WHERE id=p_client_id AND trainer_id=actor RETURNING * INTO client;
    END IF;
    RETURN to_jsonb(client);
END;
$$;
REVOKE ALL ON FUNCTION public.billing_cycle_v1(uuid,text,timestamptz,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.billing_cycle_v1(uuid,text,timestamptz,date) TO authenticated;
COMMIT;
