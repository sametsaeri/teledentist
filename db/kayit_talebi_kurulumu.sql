-- =====================================================================
--  TELE DENTIST — KAYIT TALEBİ KURULUMU (TEK DOSYA)
--  Bu dosyayı Supabase Dashboard > SQL Editor'a yapıştırıp "Run" deyin.
--  Hastanın kayıt talebinin hekime ulaşması için ZORUNLUDUR.
--
--  Ne yapar?
--    1) kayit_istekleri tablosunu oluşturur (telefon ve not kolonlarıyla)
--    2) register_patient_request()  -> hasta formunu karşılar
--    3) decide_registration_request() -> hekimin onay/reddet işlemini yapar
--
--  ÖNEMLİ: Bu fonksiyonlar SECURITY DEFINER'dır. Projenizde
--  "Allow new users to sign up" anahtarı KAPALI olsa bile çalışırlar;
--  hastanın hesabı sunucuda açılır ve talep klinik paneline düşer.
--  Hekim onayladığında hasta hesabı herhangi bir tarayıcıdan açılabilir.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tablo
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kayit_istekleri (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL,
  email       TEXT NOT NULL,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL CHECK (role IN ('hasta','ebeveyn')),
  child_email TEXT,
  phone       TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Eksik kolonları olan eski kurulumları tamamla
ALTER TABLE kayit_istekleri ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE kayit_istekleri ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE kayit_istekleri ENABLE ROW LEVEL SECURITY;

-- Hasta formu talebi yazabilsin
DROP POLICY IF EXISTS "istek_insert" ON kayit_istekleri;
CREATE POLICY "istek_insert" ON kayit_istekleri FOR INSERT WITH CHECK (true);

-- Hekim ve süper admin listeleyip silebilsin
DROP POLICY IF EXISTS "istek_hekim" ON kayit_istekleri;
CREATE POLICY "istek_hekim" ON kayit_istekleri FOR ALL
  USING (public.is_hekim() OR public.is_admin());

-- ---------------------------------------------------------------------
-- 2) Hasta kayıt talebi (SECURITY DEFINER)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_patient_request(
  p_email       text,
  p_password    text,
  p_name        text,
  p_role        text,
  p_child_email text DEFAULT NULL,
  p_phone       text DEFAULT NULL,
  p_note        text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_uid    uuid;
  v_exists boolean;
  v_email  text := lower(trim(coalesce(p_email,'')));
BEGIN
  -- --- Doğrulama ---
  IF p_name IS NULL OR trim(p_name) = '' THEN
    RAISE EXCEPTION 'Ad soyad zorunlu';
  END IF;
  IF p_email IS NULL OR position('@' in p_email) = 0 THEN
    RAISE EXCEPTION 'Gecersiz e-posta adresi';
  END IF;
  IF coalesce(length(p_password),0) < 6 THEN
    RAISE EXCEPTION 'Sifre en az 6 karakter olmali';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('hasta','ebeveyn') THEN
    RAISE EXCEPTION 'Kayit yalnizca hasta veya ebeveyn icin yapilabilir';
  END IF;

  -- Zaten profili olan biri talep gönderemez
  SELECT true INTO v_exists FROM public.profiles WHERE lower(email) = v_email;
  IF v_exists THEN
    RAISE EXCEPTION 'Bu e-posta zaten kayitli. Lutfen giris yapin.';
  END IF;

  -- Aynı e-posta için ikinci talep
  SELECT true INTO v_exists FROM public.kayit_istekleri WHERE lower(email) = v_email;
  IF v_exists THEN
    RAISE EXCEPTION 'Bu e-posta icin zaten talep gonderilmis. Hekiminiz inceliyor.';
  END IF;

  -- --- Auth kullanıcısı (signup kısıtlaması atlanarak) ---
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = v_email;

  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated', v_email,
      extensions.crypt(p_password, extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb, now(), now(), '', '', '', ''
    );
  END IF;

  -- --- Talep kaydı (profil YOK; hekim onaylayınca oluşur) ---
  INSERT INTO public.kayit_istekleri (user_id, email, name, role, child_email, phone, note)
  VALUES (
    v_uid, v_email, trim(p_name), p_role,
    nullif(lower(trim(coalesce(p_child_email,''))),''),
    nullif(trim(coalesce(p_phone,'')),''),
    nullif(trim(coalesce(p_note,'')),'')
  );

  RETURN jsonb_build_object('ok', true, 'uid', v_uid, 'email', v_email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_patient_request(text,text,text,text,text,text,text)
  TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) Hekim talebi onaylar / reddeder (SECURITY DEFINER)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decide_registration_request(
  p_request_id bigint,
  p_approve     boolean,
  p_doctor_id   uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_req   public.kayit_istekleri%ROWTYPE;
  v_uid   uuid;
  v_email text;
  v_child uuid;
BEGIN
  IF NOT (public.is_hekim() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  SELECT * INTO v_req FROM public.kayit_istekleri WHERE id = p_request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Talep bulunamadi';
  END IF;

  -- --- Reddet: talebi kaldır ---
  IF NOT p_approve THEN
    DELETE FROM public.kayit_istekleri WHERE id = p_request_id;
    RETURN jsonb_build_object('ok', true, 'durum', 'reddedildi');
  END IF;

  v_uid := v_req.user_id;
  v_email := lower(trim(v_req.email));

  -- --- Auth kullanıcısı gerçekten var mı? ---
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid) THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated', v_email,
      extensions.crypt('teledentist', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb, now(), now(), '', '', '', ''
    );
  END IF;

  -- --- Profil oluştur ---
  INSERT INTO public.profiles (
    id, role, email, name, created_by,
    reminder_days, last_visit, plaque_index, anxiety_score, treatment_type
  ) VALUES (
    v_uid, v_req.role, v_email, v_req.name, coalesce(p_doctor_id, auth.uid()),
    5, CURRENT_DATE, 1, 3, 'kontrol'
  )
  ON CONFLICT (id) DO UPDATE
    SET role    = EXCLUDED.role,
        email   = EXCLUDED.email,
        name    = EXCLUDED.name;

  -- --- Ebeveyn ise çocuk profilini bağla ---
  IF v_req.role = 'ebeveyn' AND v_req.child_email IS NOT NULL AND v_req.child_email <> '' THEN
    SELECT id INTO v_child FROM public.profiles WHERE lower(email) = lower(v_req.child_email);
    IF v_child IS NOT NULL THEN
      INSERT INTO public.parent_child (parent_id, child_id)
      VALUES (v_uid, v_child) ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  DELETE FROM public.kayit_istekleri WHERE id = p_request_id;
  RETURN jsonb_build_object('ok', true, 'durum', 'onaylandi', 'uid', v_uid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.decide_registration_request(bigint,boolean,uuid)
  TO authenticated;

-- ---------------------------------------------------------------------
-- 4) Kurulum doğrulaması — hepsi "true" olmalı
-- ---------------------------------------------------------------------
SELECT
  (SELECT count(*) FROM pg_proc WHERE proname = 'register_patient_request')   AS register_patient_request_varlik,
  (SELECT count(*) FROM pg_proc WHERE proname = 'decide_registration_request') AS decide_registration_request_varlik,
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'kayit_istekleri' AND column_name IN ('phone','note')) AS yeni_kolon_sayisi;

-- =====================================================================
-- BİTTİ. Bundan sonra:
--   1) Hasta https://teledentist.vercel.app/kayit adresinden formu doldurur
--   2) Hekim /hekim?tab=istek adresinden talebi görür
--   3) "Onayla" der → hesap açılır, hasta HERHANGİ BİR tarayıcıdan giriş yapar
-- =====================================================================