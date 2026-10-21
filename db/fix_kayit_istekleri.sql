-- ============================================================
-- KAYIT AKIŞI DÜZELTMESİ — tek seferde çalıştır
--
-- Bulunan hatalar:
--   1) kayit_istekleri'de username/kvkk_* sütunları yok → RPC 400
--   2) user_id UUID NOT NULL ama talep anında uid yok → INSERT patlar
--   3) status/decided_at/decided_by sütunları yok → onay/red yazılamaz
--   4) decide_registration_request parametre tipi JS ile uyuşmuyor
--
-- Supabase SQL Editor'de ÇALIŞTIR.
-- ============================================================

-- 1) Eksik sütunlar
ALTER TABLE kayit_istekleri ADD COLUMN IF NOT EXISTS username     TEXT;
ALTER TABLE kayit_istekleri ADD COLUMN IF NOT EXISTS kvkk_onay    BOOLEAN DEFAULT false;
ALTER TABLE kayit_istekleri ADD COLUMN IF NOT EXISTS kvkk_surum   TEXT DEFAULT '1.0';
ALTER TABLE kayit_istekleri ADD COLUMN IF NOT EXISTS kvkk_zaman   TIMESTAMPTZ;
ALTER TABLE kayit_istekleri ADD COLUMN IF NOT EXISTS kvkk_ip_notu TEXT DEFAULT 'kayıt anındaki oturum';
ALTER TABLE kayit_istekleri ADD COLUMN IF NOT EXISTS status       TEXT DEFAULT 'bekliyor';
ALTER TABLE kayit_istekleri ADD COLUMN IF NOT EXISTS decided_at   TIMESTAMPTZ;
ALTER TABLE kayit_istekleri ADD COLUMN IF NOT EXISTS decided_by   UUID;

-- 2) Talep anında hesap henüz yok → user_id boş kalabilmeli
ALTER TABLE kayit_istekleri ALTER COLUMN user_id DROP NOT NULL;
-- profiles.username da eklenmemiş olabilir (eski kurulumlar)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- 3) Kayıt talebi alıcı fonksiyon (JS: 12 parametre gönderir)
CREATE OR REPLACE FUNCTION public.register_patient_request(
  p_email TEXT, p_password TEXT, p_name TEXT, p_role TEXT,
  p_child_email TEXT DEFAULT NULL, p_phone TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL, p_username TEXT DEFAULT NULL,
  p_kvkk_onay BOOLEAN DEFAULT false, p_kvkk_surum TEXT DEFAULT '1.0',
  p_kvkk_zaman TIMESTAMPTZ DEFAULT NULL,
  p_kvkk_ip_notu TEXT DEFAULT 'kayıt anındaki oturum'
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_email TEXT := lower(trim(p_email));
  v_username TEXT;
BEGIN
  IF COALESCE(p_kvkk_onay, false) = false THEN
    RETURN json_build_object('ok', false,
      'error', 'KVKK aydınlatma metni onaylanmadan kayıt talebi oluşturulamaz.');
  END IF;

  IF v_email IS NULL OR v_email !~ '^[^@]+@[^@]+\.[^@]+$' THEN
    RETURN json_build_object('ok', false, 'error', 'Geçersiz e-posta adresi.');
  END IF;

  IF p_role NOT IN ('hasta', 'ebeveyn') THEN
    RETURN json_build_object('ok', false, 'error', 'Kayıt yalnızca hasta/ebeveyn için olabilir.');
  END IF;

  IF EXISTS (SELECT 1 FROM kayit_istekleri WHERE lower(email) = v_email AND status = 'bekliyor') THEN
    RETURN json_build_object('ok', false, 'error', 'Bu e-posta için zaten talep gönderilmiş.');
  END IF;

  v_username := COALESCE(
    NULLIF(trim(p_username), ''),
    lower(split_part(v_email, '@', 1))
  );

  INSERT INTO kayit_istekleri
    (user_id, email, username, name, role, child_email, phone, note,
     kvkk_onay, kvkk_surum, kvkk_zaman, kvkk_ip_notu, status)
  VALUES
    (NULL, v_email, v_username, trim(p_name), p_role, p_child_email,
     p_phone, p_note, true, COALESCE(p_kvkk_surum, '1.0'),
     COALESCE(p_kvkk_zaman, now()), COALESCE(p_kvkk_ip_notu, 'kayıt anındaki oturum'),
     'bekliyor')
  RETURNING id INTO v_uid;

  RETURN json_build_object('ok', true, 'uid', v_uid, 'email', v_email, 'username', v_username);
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_patient_request(text,text,text,text,text,text,text,text,boolean,text,timestamptz,text)
TO anon, authenticated;

-- 4) Onay/red fonksiyonu — JS id'yi number gönderir (BIGSERIAL)
DROP FUNCTION IF EXISTS public.decide_registration_request(bigint,boolean,uuid);
CREATE OR REPLACE FUNCTION public.decide_registration_request(
  p_request_id BIGINT, p_approve BOOLEAN, p_doctor_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req kayit_istekleri%ROWTYPE;
  v_uid UUID;
  v_pass TEXT;
BEGIN
  SELECT * INTO v_req FROM kayit_istekleri WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Talep bulunamadı.');
  END IF;
  IF v_req.status IS NOT NULL AND v_req.status NOT IN ('bekliyor', '') THEN
    RETURN json_build_object('ok', false, 'error', 'Bu talep zaten karara bağlanmış.');
  END IF;

  IF p_approve THEN
    v_pass := substr(md5(random()::text), 1, 10) || 'Aa1';

    -- Auth kullanıcısı yoksa oluştur (signup kapalı olsa da çalışır)
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(v_req.email) LIMIT 1;
    IF v_uid IS NULL THEN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, confirmation_token, email_change, email_change_token_new,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
        'authenticated', 'authenticated', lower(v_req.email),
        extensions.crypt(v_pass, extensions.gen_salt('bf')),
        now(), '', '', '',
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object('name', v_req.name, 'role', v_req.role),
        now(), now()
      ) RETURNING id INTO v_uid;
    END IF;

    -- Profil satırı (varsa güncelle)
    INSERT INTO profiles (id, email, name, role, username)
    VALUES (v_uid, lower(v_req.email), v_req.name, v_req.role, v_req.username)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name, role = EXCLUDED.role, username = EXCLUDED.username;

    UPDATE kayit_istekleri
      SET status = 'onaylı', user_id = v_uid, decided_at = now(), decided_by = p_doctor_id
      WHERE id = p_request_id;

    RETURN json_build_object('ok', true, 'durum', 'onaylandi', 'uid', v_uid,
      'sifre', v_pass, 'email', v_req.email, 'username', v_req.username);
  ELSE
    UPDATE kayit_istekleri
      SET status = 'reddedildi', decided_at = now(), decided_by = p_doctor_id
      WHERE id = p_request_id;
    RETURN json_build_object('ok', true, 'durum', 'reddedildi');
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decide_registration_request(bigint, boolean, uuid)
TO anon, authenticated;

SELECT 'KURULUM TAMAM' AS sonuc;
