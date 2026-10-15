-- ============================================================
-- TeleDentist — KURULUM DURUMU FONKSİYONU
-- Uygulamanın "Sistem Durumu" kartı bunu okur.
-- Eksik parçaları tek bakışta gösterir.
-- ============================================================

CREATE OR REPLACE FUNCTION public.setup_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required_fn   text[] := ARRAY['is_hekim','is_admin','create_account','resolve_login_id',
                                  'admin_set_password','admin_update_profile'];
  v_required_tbl  text[] := ARRAY['profiles','teeth','triage','hygiene','anxiety',
                                  'appointments','notifications','clinical_notes',
                                  'kayit_istekleri','referrals','parent_child','photos'];
  v_required_cols text[] := ARRAY['username','branch','tc_no','birth_date','gender','phone',
                                  'address','city','district','blood','insurance','school',
                                  'occupation','near_name','near_phone','near_relation',
                                  'reminder_days','last_visit'];
  v_appt_cols     text[] := ARRAY['appt_date','appt_time','is_online','patient_id','approved_at'];

  v_fns       text[] := ARRAY[]::text[];
  v_tbls      text[] := ARRAY[]::text[];
  v_pcols     text[] := ARRAY[]::text[];
  v_acols     text[] := ARRAY[]::text[];
  v_buckets   text[] := ARRAY[]::text[];

  v_miss_fn   text[] := ARRAY[]::text[];
  v_miss_tbl  text[] := ARRAY[]::text[];
  v_miss_cols text[] := ARRAY[]::text[];
  v_miss_acols text[] := ARRAY[]::text[];
  v_miss_buck text[] := ARRAY[]::text[];

  f text;
  b text;
BEGIN
  -- Fonksiyonlar
  SELECT coalesce(array_agg(proname), '{}') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = ANY(v_required_fn);

  FOREACH f IN ARRAY v_required_fn LOOP
    IF NOT (f = ANY(v_fns)) THEN v_miss_fn := array_append(v_miss_fn, f); END IF;
  END LOOP;

  -- Tablolar
  SELECT coalesce(array_agg(table_name), '{}') INTO v_tbls
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = ANY(v_required_tbl);

  FOREACH f IN ARRAY v_required_tbl LOOP
    IF NOT (f = ANY(v_tbls)) THEN v_miss_tbl := array_append(v_miss_tbl, f); END IF;
  END LOOP;

  -- profiles kolonları
  SELECT coalesce(array_agg(column_name), '{}') INTO v_pcols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = ANY(v_required_cols);

  FOREACH f IN ARRAY v_required_cols LOOP
    IF NOT (f = ANY(v_pcols)) THEN v_miss_cols := array_append(v_miss_cols, f); END IF;
  END LOOP;

  -- appointments kolonları
  SELECT coalesce(array_agg(column_name), '{}') INTO v_acols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = ANY(v_appt_cols);

  FOREACH f IN ARRAY v_appt_cols LOOP
    IF NOT (f = ANY(v_acols)) THEN v_miss_acols := array_append(v_miss_acols, f); END IF;
  END LOOP;

  -- Storage kovaları
  BEGIN
    SELECT coalesce(array_agg(id), '{}') INTO v_buckets FROM storage.buckets WHERE id IN ('xrays','photos');
    FOREACH b IN ARRAY ARRAY['xrays','photos'] LOOP
      IF NOT (b = ANY(v_buckets)) THEN v_miss_buck := array_append(v_miss_buck, b); END IF;
    END LOOP;
  EXCEPTION WHEN others THEN
    v_miss_buck := ARRAY['xrays','photos'];
  END;

  RETURN jsonb_build_object(
    'ok', array_length(v_miss_fn,1) IS NULL
      AND array_length(v_miss_tbl,1) IS NULL
      AND array_length(v_miss_cols,1) IS NULL
      AND array_length(v_miss_acols,1) IS NULL
      AND array_length(v_miss_buck,1) IS NULL,
    'functions', v_fns,
    'tables', v_tbls,
    'profile_columns', v_pcols,
    'appointment_columns', v_acols,
    'buckets', v_buckets,
    'missing_functions', v_miss_fn,
    'missing_tables', v_miss_tbl,
    'missing_profile_columns', v_miss_cols,
    'missing_appointment_columns', v_miss_acols,
    'missing_buckets', v_miss_buck
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.setup_status() TO authenticated, anon;
