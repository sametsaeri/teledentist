-- ============================================================
-- Kullanıcı oluşturma (signup kapalıyken de çalışır) + kullanıcı adıyla giriş
-- Supabase SQL Editor'de çalıştırın. VAR OLAN VERİLER SİLİNMEZ.
--
-- Neden: Supabase "Allow new users to sign up" kapalıyken
-- tarayıcıdan signUp() çağrısı "Signups not allowed" hatası verir.
-- Aşağıdaki SECURITY DEFINER fonksiyon, auth.users'a doğrudan yazıp
-- hesabı açar; servis anahtarına gerek yoktur.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Kullanıcı adı kolonu
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT DEFAULT '';

-- Kullanıcı adı benzersiz (boş olanlar hariç)
DROP INDEX IF EXISTS profiles_username_uniq;
CREATE UNIQUE INDEX profiles_username_uniq ON profiles (lower(username))
  WHERE username IS NOT NULL AND username <> '';

-- ------------------------------------------------------------
-- 1) Hekim / süper admin hesap açar (email + şifre + rol)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_account(
  p_email     text,
  p_password  text,
  p_name      text,
  p_role      text,
  p_branch    text DEFAULT 'genel',
  p_username  text DEFAULT '',
  p_extra     jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid uuid;
  v_exists boolean;
BEGIN
  -- Yetki kontrolü
  IF NOT (public.is_hekim() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Yetkisiz işlem';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('hekim','hasta','ebeveyn') THEN
    RAISE EXCEPTION 'Geçersiz rol';
  END IF;
  IF p_role = 'hekim' AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Hekim hesabini yalnizca super admin acabilir';
  END IF;
  IF coalesce(length(p_password),0) < 6 THEN
    RAISE EXCEPTION 'Sifre en az 6 karakter olmali';
  END IF;

  -- E-posta ve kullanıcı adı çakışması
  SELECT true INTO v_exists FROM profiles WHERE lower(email) = lower(p_email);
  IF v_exists THEN RAISE EXCEPTION 'Bu e-posta zaten kayitli'; END IF;

  IF p_username IS NOT NULL AND p_username <> '' THEN
    SELECT true INTO v_exists FROM profiles
      WHERE lower(username) = lower(p_username)
        AND username IS NOT NULL AND username <> '';
    IF v_exists THEN RAISE EXCEPTION 'Bu kullanici adi zaten alinmis'; END IF;
  END IF;

  -- auth.users kaydı
  v_uid := gen_random_uuid();
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_uid,
    'authenticated', 'authenticated', lower(trim(p_email)),
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb, now(), now(), '', '', '', ''
  );

  -- profil kaydı
  INSERT INTO profiles (
    id, role, email, name, branch, username, created_by,
    reminder_days, last_visit, plaque_index, anxiety_score, treatment_type
  ) VALUES (
    v_uid, p_role, lower(trim(p_email)), p_name,
    coalesce(nullif(p_branch,''),'genel'),
    nullif(trim(coalesce(p_username,'')),''),
    auth.uid(), 5, CURRENT_DATE, 1, 3, 'kontrol'
  );

  -- Detaylı hasta bilgileri (p_extra). Kolonlar yoksa (migration_v2 çalışmamışsa)
  -- hesap açma yine de başarılı olsun diye hata yutulur.
  BEGIN
    UPDATE profiles SET
      tc_no         = coalesce(nullif(p_extra->>'tc_no',''), tc_no),
      birth_date    = coalesce(nullif(p_extra->>'birth_date','')::date, birth_date),
      gender        = coalesce(nullif(p_extra->>'gender',''), gender),
      phone         = coalesce(nullif(p_extra->>'phone',''), phone),
      address       = coalesce(nullif(p_extra->>'address',''), address),
      city          = coalesce(nullif(p_extra->>'city',''), city),
      district      = coalesce(nullif(p_extra->>'district',''), district),
      blood         = coalesce(nullif(p_extra->>'blood',''), blood),
      insurance     = coalesce(nullif(p_extra->>'insurance',''), insurance),
      school        = coalesce(nullif(p_extra->>'school',''), school),
      occupation    = coalesce(nullif(p_extra->>'occupation',''), occupation),
      near_name     = coalesce(nullif(p_extra->>'near_name',''), near_name),
      near_phone    = coalesce(nullif(p_extra->>'near_phone',''), near_phone),
      near_relation = coalesce(nullif(p_extra->>'near_relation',''), near_relation),
      reminder_days = coalesce((nullif(p_extra->>'reminder_days',''))::int, reminder_days),
      last_visit    = coalesce(nullif(p_extra->>'last_visit','')::date, last_visit)
    WHERE id = v_uid;
  EXCEPTION WHEN others THEN
    NULL; -- detay kolonları yoksa yoksay
  END;

  RETURN jsonb_build_object('ok', true, 'uid', v_uid, 'email', lower(trim(p_email)));
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_account(text,text,text,text,text,text,jsonb) TO authenticated;

-- ------------------------------------------------------------
-- 2) Kullanıcı adı veya e-posta ile e-posta çözümleme (giriş için)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_login_id(p_identifier text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_email text;
BEGIN
  IF p_identifier IS NULL OR btrim(p_identifier) = '' THEN RETURN NULL; END IF;
  IF position('@' in p_identifier) > 0 THEN RETURN lower(trim(p_identifier)); END IF;
  SELECT email INTO v_email FROM profiles
    WHERE lower(username) = lower(trim(p_identifier)) LIMIT 1;
  RETURN v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_login_id(text) TO anon, authenticated;

-- ------------------------------------------------------------
-- 3) Süper admin kullanıcı adı ataması
-- ------------------------------------------------------------
UPDATE profiles
SET username = 'resulyel'
WHERE lower(email) = 'tcsametsari@gmail.com';

-- ------------------------------------------------------------
-- 4) Kontrol
-- ------------------------------------------------------------
SELECT id, email, username, name, role, branch FROM profiles ORDER BY created_at DESC;