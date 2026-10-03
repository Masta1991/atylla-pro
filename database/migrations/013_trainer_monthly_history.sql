-- Additive preparation. Apply only via an approved release; no billing writes.
BEGIN;
CREATE TABLE IF NOT EXISTS public.trainer_monthly_history (
    trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    year integer NOT NULL CHECK (year BETWEEN 2000 AND 2100),
    month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
    training_count integer NOT NULL CHECK (training_count BETWEEN 0 AND 10000),
    updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (trainer_id, year, month)
);
ALTER TABLE public.trainer_monthly_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS trainer_month_owner ON public.trainer_monthly_history;
CREATE POLICY trainer_month_owner ON public.trainer_monthly_history TO authenticated
    USING (trainer_id = auth.uid()) WITH CHECK (trainer_id = auth.uid());
REVOKE ALL ON public.trainer_monthly_history FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.trainer_monthly_history TO authenticated;

CREATE OR REPLACE FUNCTION public.save_trainer_month_v1(p_year integer, p_month integer, p_count integer, p_expected timestamptz DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor uuid := auth.uid(); result public.trainer_monthly_history%ROWTYPE;
BEGIN
    IF actor IS NULL THEN RAISE EXCEPTION 'Unauthorized trainer' USING ERRCODE='42501'; END IF;
    IF p_year IS NULL OR p_month IS NULL OR p_count IS NULL OR p_year NOT BETWEEN 2000 AND 2100 OR p_month NOT BETWEEN 1 AND 12 OR p_count NOT BETWEEN 0 AND 10000 THEN
        RAISE EXCEPTION 'Nieprawidłowe dane miesiąca.';
    END IF;
    IF make_date(p_year,p_month,1) >= date_trunc('month', now() AT TIME ZONE 'Europe/Warsaw')::date THEN
        RAISE EXCEPTION 'Wpisz zakończony miesiąc.';
    END IF;
    IF p_expected IS NULL THEN
        INSERT INTO public.trainer_monthly_history(trainer_id,year,month,training_count)
        VALUES(actor,p_year,p_month,p_count) ON CONFLICT DO NOTHING RETURNING * INTO result;
    ELSE
        UPDATE public.trainer_monthly_history SET training_count=p_count, updated_at=clock_timestamp()
        WHERE trainer_id=actor AND year=p_year AND month=p_month AND updated_at=p_expected RETURNING * INTO result;
    END IF;
    IF result.trainer_id IS NULL THEN RAISE EXCEPTION 'Dane zmieniły się. Odśwież raport przed zapisem.'; END IF;
    RETURN to_jsonb(result);
END; $$;
CREATE OR REPLACE FUNCTION public.delete_trainer_month_v1(p_year integer, p_month integer, p_expected timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE actor uuid := auth.uid(); removed uuid;
BEGIN
    IF actor IS NULL THEN RAISE EXCEPTION 'Unauthorized trainer' USING ERRCODE='42501'; END IF;
    IF p_year IS NULL OR p_month IS NULL OR p_year NOT BETWEEN 2000 AND 2100 OR p_month NOT BETWEEN 1 AND 12 THEN RAISE EXCEPTION 'Nieprawidłowy miesiąc.'; END IF;
    IF make_date(p_year,p_month,1) >= date_trunc('month', now() AT TIME ZONE 'Europe/Warsaw')::date THEN RAISE EXCEPTION 'Wpisz zakończony miesiąc.'; END IF;
    DELETE FROM public.trainer_monthly_history WHERE trainer_id=actor AND year=p_year AND month=p_month AND updated_at=p_expected RETURNING trainer_id INTO removed;
    IF removed IS NULL THEN RAISE EXCEPTION 'Dane zmieniły się. Odśwież raport przed usunięciem.'; END IF;
    RETURN jsonb_build_object('deleted',true);
END; $$;
REVOKE ALL ON FUNCTION public.save_trainer_month_v1(integer,integer,integer,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_trainer_month_v1(integer,integer,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_trainer_month_v1(integer,integer,integer,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_trainer_month_v1(integer,integer,timestamptz) TO authenticated;
COMMIT;
