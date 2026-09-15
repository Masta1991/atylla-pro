-- Atylla Pro: read-only catalog and duplicate-count diagnostic.
-- Run as postgres in the same Supabase project. Returns no client records.
WITH app_tables(name) AS (
  VALUES ('workout_types'),('muscle_groups'),('exercises'),
    ('training_plans'),('plan_exercises'),('clients'),
    ('calendar_events'),('workout_logs'),('measurements'),
    ('absences'),('deleted_workouts'),('trainer_profiles'),('client_packages')
),
required_indexes(name) AS (
  VALUES ('muscle_groups_trainer_lower_name_uidx'),
    ('workout_types_trainer_lower_name_uidx'),
    ('training_plans_trainer_lower_name_uidx'),
    ('exercises_group_lower_name_uidx'),
    ('audit_one_open_package_per_client')
),
required_functions(signature) AS (
  VALUES ('public.save_workout_batch_atomic(uuid,date,integer,uuid,jsonb)'),
    ('public.save_workout_batch_v2(uuid,date,integer,uuid,jsonb)'),
    ('public.calendar_mutation_v2(text,jsonb)'),
    ('public.record_absence_v3(jsonb)'),
    ('public.save_calendar_workout_v3(jsonb)'),
    ('public.billing_cycle_v1(uuid,text,timestamptz,date)')
)
SELECT jsonb_pretty(jsonb_build_object(
  'tables_and_rls', (
    SELECT jsonb_agg(jsonb_build_object(
      'table', t.name, 'exists', c.oid IS NOT NULL,
      'rls_enabled', c.relrowsecurity,
      'authenticated_select', has_table_privilege('authenticated',c.oid,'SELECT'),
      'authenticated_insert', has_table_privilege('authenticated',c.oid,'INSERT'),
      'authenticated_update', has_table_privilege('authenticated',c.oid,'UPDATE'),
      'authenticated_delete', has_table_privilege('authenticated',c.oid,'DELETE'),
      'policies', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'name',policyname,'roles',roles,'command',cmd,
          'permissive',permissive,'using',qual,'check',with_check
        ) ORDER BY policyname)
        FROM pg_policies WHERE schemaname='public' AND tablename=t.name
      ),'[]'::jsonb)
    ) ORDER BY t.name)
    FROM app_tables t
    LEFT JOIN pg_class c ON c.oid=to_regclass('public.'||t.name)
  ),
  'indexes', (
    SELECT jsonb_agg(jsonb_build_object(
      'name', r.name, 'exists', i.indexrelid IS NOT NULL,
      'valid', i.indisvalid, 'unique', i.indisunique,
      'definition', pg_get_indexdef(i.indexrelid)
    ) ORDER BY r.name)
    FROM required_indexes r
    LEFT JOIN pg_index i ON i.indexrelid=to_regclass('public.'||r.name)
  ),
  'constraints', (
    SELECT jsonb_agg(jsonb_build_object(
      'table',c.relname,'name',k.conname,
      'validated',k.convalidated,'definition',pg_get_constraintdef(k.oid)
    ) ORDER BY c.relname,k.conname)
    FROM pg_constraint k
    JOIN pg_class c ON c.oid=k.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname IN ('calendar_events','client_packages','absences')
  ),
  'functions', (
    SELECT jsonb_agg(jsonb_build_object(
      'signature',r.signature,'exists',p.oid IS NOT NULL,
      'security_definer',p.prosecdef,'settings',p.proconfig,
      'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
      'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE')
    ) ORDER BY r.signature)
    FROM required_functions r
    LEFT JOIN pg_proc p ON p.oid=to_regprocedure(r.signature)
  ),
  'anchor_trigger', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name',t.tgname,'enabled',t.tgenabled,
      'definition',pg_get_triggerdef(t.oid),
      'function_definition',pg_get_functiondef(t.tgfoid)
    ))
    FROM pg_trigger t
    WHERE t.tgrelid=to_regclass('public.calendar_events')
      AND t.tgname='audit_closed_anchor_guard' AND NOT t.tgisinternal
  ),'[]'::jsonb),
  'duplicate_name_groups', jsonb_build_object(
    'muscle_groups', (SELECT count(*) FROM (
      SELECT 1 FROM public.muscle_groups
      GROUP BY trainer_id,lower(name) HAVING count(*)>1
    ) d),
    'workout_types', (SELECT count(*) FROM (
      SELECT 1 FROM public.workout_types
      GROUP BY trainer_id,lower(name) HAVING count(*)>1
    ) d),
    'training_plans', (SELECT count(*) FROM (
      SELECT 1 FROM public.training_plans
      GROUP BY trainer_id,lower(name) HAVING count(*)>1
    ) d),
    'exercises', (SELECT count(*) FROM (
      SELECT 1 FROM public.exercises
      GROUP BY muscle_group_id,lower(name) HAVING count(*)>1
    ) d)
  )
)) AS audit;
