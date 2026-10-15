-- ============================================================
-- TeleDentist — SÜPER ADMIN YÖNETİM FONKSİYONLARI
--   1) admin_set_password : kullanıcıya şifre atar
--   2) admin_update_profile: kullanıcının TÜM verisini düzenler
--      (e-posta değişirse giriş bilgisi olan auth.users da güncellenir)
-- Supabase > SQL Editor'de çalıştırın. IDEMPOTENT, veri silinmez.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ------------------------------------------------------------
-- 1) ŞİFRE ATAMA
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_password(p_user_id uuid, p_new_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE v_email text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Yetkisiz islem'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Kullanici secilmedi'; END IF;
  IF coalesce(length(p_new_password),0) < 6 THEN RAISE EXCEPTION 'Sifre en az 6 karakter olmali'; END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF v_email IS NULL THEN RAISE EXCEPTION 'Kullanici bulunamadi'; END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = p_user_id;

  -- Açık oturumları kapat: yeni şifreyle giriş zorunlu olsun
  BEGIN
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
  EXCEPTION WHEN others THEN NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'email', v_email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_password(uuid, text) TO authenticated;

-- ------------------------------------------------------------
-- 2) TÜM KULLANICI VERİSİNİ DÜZENLEME
--    p_patch içine gönderilen alanlar güncellenir, gönderilmeyenler korunur.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_profile(p_user_id uuid, p_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_old_email text;
  v_new_email text;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Yetkisiz islem'; END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'Kullanici secilmedi'; END IF;
  IF p_patch IS NULL THEN RAISE EXCEPTION 'Veri gonderilmedi'; END IF;

  IF jsonb_exists(p_patch, 'role') AND p_patch->>'role' NOT IN ('admin','hekim','hasta','ebeveyn') THEN
    RAISE EXCEPTION 'Gecersiz rol';
  END IF;

  SELECT email INTO v_old_email FROM auth.users WHERE id = p_user_id;
  IF v_old_email IS NULL THEN RAISE EXCEPTION 'Kullanici bulunamadi'; END IF;

  v_new_email := nullif(lower(trim(coalesce(p_patch->>'email',''))), '');

  -- Tam güncelleme; migration_v2 kolonları yoksa çekirdek alanlara düşer
  BEGIN
    UPDATE public.profiles SET
      name          = coalesce(nullif(p_patch->>'name',''), name),
      email         = coalesce(nullif(v_new_email,''), email),
      username      = CASE WHEN jsonb_exists(p_patch,'username')
                           THEN nullif(trim(p_patch->>'username'),'') ELSE username END,
      role          = coalesce(nullif(p_patch->>'role',''), role),
      branch        = coalesce(nullif(p_patch->>'branch',''), branch),
      tc_no         = coalesce(p_patch->>'tc_no', tc_no),
      birth_date    = coalesce(nullif(p_patch->>'birth_date','')::date, birth_date),
      gender        = coalesce(p_patch->>'gender', gender),
      phone         = coalesce(p_patch->>'phone', phone),
      address       = coalesce(p_patch->>'address', address),
      city          = coalesce(p_patch->>'city', city),
      district      = coalesce(p_patch->>'district', district),
      blood         = coalesce(p_patch->>'blood', blood),
      insurance     = coalesce(p_patch->>'insurance', insurance),
      school        = coalesce(p_patch->>'school', school),
      occupation    = coalesce(p_patch->>'occupation', occupation),
      near_name     = coalesce(p_patch->>'near_name', near_name),
      near_phone    = coalesce(p_patch->>'near_phone', near_phone),
      near_relation = coalesce(p_patch->>'near_relation', near_relation),
      note          = coalesce(p_patch->>'note', note),
      reminder_days = coalesce(nullif(p_patch->>'reminder_days','')::int, reminder_days),
      last_visit    = coalesce(nullif(p_patch->>'last_visit','')::date, last_visit),
      treatment_type= coalesce(p_patch->>'treatment_type', treatment_type),
      plaque_index  = coalesce(nullif(p_patch->>'plaque_index','')::numeric, plaque_index),
      anxiety_score = coalesce(nullif(p_patch->>'anxiety_score','')::int, anxiety_score)
    WHERE id = p_user_id;
  EXCEPTION WHEN undefined_column THEN
    UPDATE public.profiles SET
      name     = coalesce(nullif(p_patch->>'name',''), name),
      email    = coalesce(nullif(v_new_email,''), email),
      username = CASE WHEN jsonb_exists(p_patch,'username')
                      THEN nullif(trim(p_patch->>'username'),'') ELSE username END,
      role     = coalesce(nullif(p_patch->>'role',''), role),
      branch   = coalesce(nullif(p_patch->>'branch',''), branch),
      phone    = coalesce(p_patch->>'phone', phone)
    WHERE id = p_user_id;
  END;

  -- E-posta değiştiyse giriş bilgisi de değişsin
  IF v_new_email IS NOT NULL AND v_new_email <> lower(v_old_email) THEN
    BEGIN
      UPDATE auth.users SET email = v_new_email, updated_at = now() WHERE id = p_user_id;
    EXCEPTION WHEN unique_violation THEN
      RAISE EXCEPTION 'Bu e-posta baska bir kullaniciya ait';
    END;
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, jsonb) TO authenticated;

-- ------------------------------------------------------------
-- Kontrol — 5 fonksiyon da listelenmeli
-- ------------------------------------------------------------
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('create_account','resolve_login_id','admin_set_password',
                    'admin_update_profile','is_admin','is_hekim')
ORDER BY p.proname;
