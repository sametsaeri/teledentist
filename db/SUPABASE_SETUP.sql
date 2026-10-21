-- ================================================================
-- TeleDentist — TEK KURULUM DOSYASI (MASTER)
-- Bu dosya TÜM migration'ları doğru sırada birleştirir.
--
-- NASIL ÇALIŞTIRILIR (2 yoldan biri):
--
--   A) Tarayıcıda:
--      Supabase Dashboard > SQL Editor > New query
--      Bu dosyanın TAMAMINI yapıştır > Run
--
--   B) Komutla (SQL yapıştırmadan):
--      .env.local içine SUPABASE_ACCESS_TOKEN ve SUPABASE_PROJECT_REF yaz
--      ardından terminalde:  npm run db:push
--
-- ÖNEMLİ: IDEMPOTENT — defalarca çalıştırılabilir, veri silinmez.
-- Demo hesaplar isterseniz AYRICA db/demo_verisi.sql dosyasını çalıştırın.
-- ================================================================


-- ================================================================
-- BÖLÜM 1/16: 1) Temel şema (profil, diş, triyaj, hijyen, anksiyete, randevu)
-- Kaynak: db/supabase.sql
-- ================================================================

-- Supabase şeması: Auth + profiller + diş kliniği tabloları
-- Kurulum: Supabase Dashboard > SQL Editor > bu dosyayı çalıştır
-- Politika: hasta/ebeveyn kaydını yalnızca hekim açar (uygulama + RLS ile)

-- Profiller (auth.users'a bağlı)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('hekim','hasta','ebeveyn')),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_by UUID REFERENCES profiles(id),
  last_visit DATE,
  treatment_type TEXT DEFAULT 'kontrol',
  plaque_index NUMERIC DEFAULT 1,
  anxiety_score INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_hekim() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hekim');
$$ LANGUAGE sql SECURITY DEFINER;

DROP POLICY IF EXISTS "own_profile" ON profiles;
CREATE POLICY "own_profile" ON profiles FOR SELECT USING (id = auth.uid() OR is_hekim());
DROP POLICY IF EXISTS "hekim_insert" ON profiles;
CREATE POLICY "hekim_insert" ON profiles FOR INSERT WITH CHECK (is_hekim());
DROP POLICY IF EXISTS "hekim_update" ON profiles;
CREATE POLICY "hekim_update" ON profiles FOR UPDATE USING (is_hekim());

CREATE TABLE IF NOT EXISTS parent_child (
  parent_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  child_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (parent_id, child_id)
);
ALTER TABLE parent_child ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pc_hekim" ON parent_child;
CREATE POLICY "pc_hekim" ON parent_child FOR ALL USING (is_hekim());

-- Klinik tablolar (profiles'a bağlı, RLS: hekim tam, hasta kendi)
CREATE TABLE IF NOT EXISTS teeth (
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  fdi INT NOT NULL CHECK (fdi BETWEEN 11 AND 48),
  status TEXT NOT NULL DEFAULT 'saglam',
  treatment TEXT DEFAULT '-',
  doctor_note TEXT DEFAULT '',
  updated_at DATE DEFAULT CURRENT_DATE,
  PRIMARY KEY (patient_id, fdi)
);
ALTER TABLE teeth ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "teeth_rw" ON teeth;
CREATE POLICY "teeth_rw" ON teeth FOR ALL USING (patient_id = auth.uid() OR is_hekim());

CREATE TABLE IF NOT EXISTS triage (
  id BIGSERIAL PRIMARY KEY, patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tooth TEXT, pain INT DEFAULT 0, swelling BOOLEAN DEFAULT false, trauma BOOLEAN DEFAULT false,
  bleeding BOOLEAN DEFAULT false, fever BOOLEAN DEFAULT false, score INT, level TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE triage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "triage_rw" ON triage;
CREATE POLICY "triage_rw" ON triage FOR ALL USING (patient_id = auth.uid() OR is_hekim());

CREATE TABLE IF NOT EXISTS hygiene (
  id BIGSERIAL PRIMARY KEY, patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  plaque NUMERIC, brush INT, hdate DATE DEFAULT CURRENT_DATE
);
ALTER TABLE hygiene ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hygiene_rw" ON hygiene;
CREATE POLICY "hygiene_rw" ON hygiene FOR ALL USING (patient_id = auth.uid() OR is_hekim());

CREATE TABLE IF NOT EXISTS anxiety (
  id BIGSERIAL PRIMARY KEY, patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  total INT, adate DATE DEFAULT CURRENT_DATE
);
ALTER TABLE anxiety ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anxiety_rw" ON anxiety;
CREATE POLICY "anxiety_rw" ON anxiety FOR ALL USING (patient_id = auth.uid() OR is_hekim());

CREATE TABLE IF NOT EXISTS appointments (
  id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, contact TEXT NOT NULL,
  dept TEXT DEFAULT 'genel-dis', complaint TEXT NOT NULL, status TEXT DEFAULT 'yeni',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appt_all" ON appointments;
CREATE POLICY "appt_all" ON appointments FOR ALL USING (true);

-- Depolama kovaları (röntgen + ağız fotoğrafı)
INSERT INTO storage.buckets (id, name, public) VALUES ('xrays','xrays', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('photos','photos', false) ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- BÖLÜM 2/16: 2) Roller (admin/hekim), branş, sevk tablosu
-- Kaynak: db/migration_roles.sql
-- ================================================================

-- Rol genişletme: admin + branş + sevk
-- Supabase SQL Editor'de db/supabase.sql'den SONRA çalıştırın.

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin','hekim','hasta','ebeveyn','sekreter','teknisyen'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'genel';

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES profiles(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS branch TEXT;

CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER;

CREATE TABLE IF NOT EXISTS referrals (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  from_doctor UUID REFERENCES profiles(id),
  to_doctor UUID REFERENCES profiles(id),
  branch TEXT,
  note TEXT DEFAULT '',
  status TEXT DEFAULT 'bekliyor',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ref_rw" ON referrals;
CREATE POLICY "ref_rw" ON referrals FOR ALL USING (is_hekim() OR is_admin());

DROP POLICY IF EXISTS "own_profile" ON profiles;
CREATE POLICY "own_profile" ON profiles FOR SELECT USING (id = auth.uid() OR is_hekim() OR is_admin());
DROP POLICY IF EXISTS "hekim_insert" ON profiles;
CREATE POLICY "hekim_insert" ON profiles FOR INSERT WITH CHECK (is_hekim() OR is_admin());
DROP POLICY IF EXISTS "hekim_update" ON profiles;
CREATE POLICY "hekim_update" ON profiles FOR UPDATE USING (is_hekim() OR is_admin());

-- ================================================================
-- BÖLÜM 3/16: 3) Kayıt istekleri tablosu
-- Kaynak: db/migration_signup.sql
-- ================================================================

-- Kayıt isteği tablosu: hasta kendi kaydını ister, hekim onaylar
-- Supabase SQL Editor'de çalıştırın. Ardından Authentication > Sign In/Providers >
-- "Allow new users to sign up" anahtarını AÇIN (hesap onaysız işe yaramaz).

CREATE TABLE IF NOT EXISTS kayit_istekleri (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('hasta','ebeveyn')),
  child_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE kayit_istekleri ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "istek_insert" ON kayit_istekleri;
CREATE POLICY "istek_insert" ON kayit_istekleri FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "istek_hekim" ON kayit_istekleri;
CREATE POLICY "istek_hekim" ON kayit_istekleri FOR ALL USING (is_hekim() OR is_admin());

-- ================================================================
-- BÖLÜM 4/16: 4) Kayıt talebi düzeltmesi (user_id NOT NULL kaldırılır)
-- Kaynak: db/fix_kayit_istekleri.sql
-- ================================================================

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

-- ================================================================
-- BÖLÜM 5/16: 4) Detaylı hasta bilgileri, randevu tarihi/online, bildirim, konsültasyon
-- Kaynak: db/migration_v2.sql
-- ================================================================

-- ============================================================
-- TeleDentist v2 migration
-- Detaylı hasta bilgileri | randevu + online randevu |
-- hatırlatma günleri | bildirimler | hekim-hasta ilişkisi
-- Supabase SQL Editor'de çalıştırın. VAR OLAN VERİLER SİLİNMEZ.
-- ============================================================

-- ---------- 1. Hasta kimlik ve iletişim bilgileri ----------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tc_no TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS district TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS blood TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS insurance TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS school TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS occupation TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS near_name TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS near_phone TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS near_relation TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reminder_days INT DEFAULT 5;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_visit DATE;

-- ---------- 2. Randevu planlama + online randevu ----------
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appt_date DATE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS appt_time TEXT DEFAULT '09:00';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES profiles(id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- ---------- 3. Bildirimler ----------
CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  doctor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                -- randevu | kontrol | sevk
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  appt_date DATE,
  days_left INT DEFAULT 0,
  status TEXT DEFAULT 'bekliyor',    -- bekliyor | gosterildi | kapandi
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notif_rw" ON notifications;
CREATE POLICY "notif_rw" ON notifications FOR ALL USING (doctor_id = auth.uid() OR is_admin());

-- ---------- 4. Hekim notları / konsültasyon kayıtları ----------
CREATE TABLE IF NOT EXISTS clinical_notes (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT DEFAULT 'not',           -- not | rapor | sevk | konsultasyon
  body TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notes_rw" ON clinical_notes;
CREATE POLICY "notes_rw" ON clinical_notes FOR ALL USING (is_hekim() OR is_admin() OR patient_id = auth.uid());

-- ---------- 5. Randevu politikaları ----------
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "appt_all" ON appointments;
DROP POLICY IF EXISTS "appt_read" ON appointments;
CREATE POLICY "appt_read" ON appointments FOR SELECT USING (true);
DROP POLICY IF EXISTS "appt_write" ON appointments;
CREATE POLICY "appt_write" ON appointments FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "appt_hekim" ON appointments;
CREATE POLICY "appt_hekim" ON appointments FOR UPDATE USING (is_hekim() OR is_admin());

-- ---------- 6. Hasta profili güncelleme yetkisi ----------
DROP POLICY IF EXISTS "own_profile_upd" ON profiles;
CREATE POLICY "own_profile_upd" ON profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ---------- 7. Süper admin (tcsametsari@gmail.com) ----------
UPDATE profiles SET role = 'admin', name = 'Dt. Resul Yel'
WHERE email = 'tcsametsari@gmail.com' AND role <> 'admin';

-- ================================================================
-- BÖLÜM 6/16: 5) Kullanıcı adıyla giriş + kayıt kapalıyken hesap açma
-- Kaynak: db/migration_users.sql
-- ================================================================

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
  IF p_role IS NULL OR p_role NOT IN ('hekim','hasta','ebeveyn','sekreter','teknisyen') THEN
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
-- Yalnızca BOŞSA atanır. Bu betik idempotent olmalıdır: daha önce şartsız
-- UPDATE yazılıydı ve betik her çalıştırıldığında kullanıcının panelden
-- değiştirdiği kullanıcı adını geri yazıyordu.
UPDATE profiles
SET username = 'resulyel'
WHERE lower(email) = 'tcsametsari@gmail.com'
  AND (username IS NULL OR username = '');

-- ------------------------------------------------------------
-- 4) Kontrol
-- ------------------------------------------------------------
SELECT id, email, username, name, role, branch FROM profiles ORDER BY created_at DESC;

-- ================================================================
-- BÖLÜM 7/16: 6) Süper admin: şifre atama + tüm kullanıcı verisini düzenleme
-- Kaynak: db/migration_admin_manage.sql
-- ================================================================

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

  IF jsonb_exists(p_patch, 'role') AND p_patch->>'role' NOT IN ('admin','hekim','hasta','ebeveyn','sekreter','teknisyen') THEN
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

-- ================================================================
-- BÖLÜM 8/16: 7) Röntgen ve fotoğraf depolama (Supabase Storage)
-- Kaynak: db/migration_storage.sql
-- ================================================================

-- ============================================================
-- Röntgen ve fotoğraf depolama (Supabase Storage)
-- Dosya yolu: <hasta_id>/<diş_no>-<zaman>.png
-- Hasta yalnızca kendi klasörüne, hekim/admin tüm klasörlere erişir.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('xrays', 'xrays', false, 10485760)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 10485760;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('photos', 'photos', false, 10485760)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 10485760;

-- ---- RÖNTGEN ----
DROP POLICY IF EXISTS "xrays_read" ON storage.objects;
CREATE POLICY "xrays_read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'xrays'
    AND ( auth.uid()::text = (storage.foldername(name))[1] OR public.is_hekim() OR public.is_admin() )
  );

DROP POLICY IF EXISTS "xrays_write" ON storage.objects;
CREATE POLICY "xrays_write" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'xrays'
    AND ( auth.uid()::text = (storage.foldername(name))[1] OR public.is_hekim() OR public.is_admin() )
  );

DROP POLICY IF EXISTS "xrays_update" ON storage.objects;
CREATE POLICY "xrays_update" ON storage.objects FOR UPDATE
  USING ( bucket_id = 'xrays' AND (public.is_hekim() OR public.is_admin()) )
  WITH CHECK ( bucket_id = 'xrays' AND (public.is_hekim() OR public.is_admin()) );

DROP POLICY IF EXISTS "xrays_delete" ON storage.objects;
CREATE POLICY "xrays_delete" ON storage.objects FOR DELETE
  USING ( bucket_id = 'xrays' AND (public.is_hekim() OR public.is_admin()) );

-- ---- FOTOĞRAF ----
DROP POLICY IF EXISTS "photos_read" ON storage.objects;
CREATE POLICY "photos_read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'photos'
    AND ( auth.uid()::text = (storage.foldername(name))[1] OR public.is_hekim() OR public.is_admin() )
  );

DROP POLICY IF EXISTS "photos_write" ON storage.objects;
CREATE POLICY "photos_write" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'photos'
    AND ( auth.uid()::text = (storage.foldername(name))[1] OR public.is_hekim() OR public.is_admin() )
  );

DROP POLICY IF EXISTS "photos_delete" ON storage.objects;
CREATE POLICY "photos_delete" ON storage.objects FOR DELETE
  USING ( bucket_id = 'photos' AND (public.is_hekim() OR public.is_admin()) );

-- ================================================================
-- BÖLÜM 9/16: 8) Ağız fotoğrafları tablosu (Storage kayıtları)
-- Kaynak: db/migration_photos.sql
-- ================================================================

-- ============================================================
-- TeleDentist — AĞIZ FOTOĞRAFLARI TABLOSU
-- Sorun: fotoğraflar tarayıcıda saklanıyordu, hekim başka cihazda
--        göremiyordu. Artık dosya Storage'a, kayıt bu tabloya yazılır.
-- Dosya yolu: photos/<hasta_id>/foto-<zaman>.png
-- ============================================================

CREATE TABLE IF NOT EXISTS photos (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label TEXT DEFAULT 'foto',
  path TEXT NOT NULL,
  note TEXT DEFAULT '',
  status TEXT DEFAULT 'bekliyor',   -- bekliyor | degerlendirildi
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS photos_patient_idx ON photos (patient_id, created_at DESC);

ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Hasta kendi fotoğrafını yükler ve kendi fotoğraflarını görür
DROP POLICY IF EXISTS "photos_insert" ON photos;
CREATE POLICY "photos_insert" ON photos FOR INSERT
  WITH CHECK (patient_id = auth.uid() OR is_hekim() OR is_admin());

DROP POLICY IF EXISTS "photos_read" ON photos;
CREATE POLICY "photos_read" ON photos FOR SELECT
  USING (patient_id = auth.uid() OR is_hekim() OR is_admin());

-- Hekim yorum yazar / durum günceller
DROP POLICY IF EXISTS "photos_update" ON photos;
CREATE POLICY "photos_update" ON photos FOR UPDATE
  USING (is_hekim() OR is_admin() OR patient_id = auth.uid())
  WITH CHECK (is_hekim() OR is_admin() OR patient_id = auth.uid());

DROP POLICY IF EXISTS "photos_delete" ON photos;
CREATE POLICY "photos_delete" ON photos FOR DELETE
  USING (is_hekim() OR is_admin());

-- ================================================================
-- BÖLÜM 10/16: 9) Klinik modülleri: anamnez, tedavi planı, envanter, laboratuvar, fiyat, tahakkuk
-- Kaynak: db/migration_clinic.sql
-- ================================================================

-- ============================================================
-- TeleDentist — KLINIK MODÜLLERİ
--   1) anamnesis        : alerji, hastalık, ilaç kayıtları
--   2) treatment_plans  : tedavi planı (aşamalı, fiyatlı)
--   3) materials        : klinik malzeme envanteri + son kullanma
--   4) lab_cases        : laboratuvar takibi (protez, zirkonyum...)
--   5) (price_items kaldırıldı — devlet projesi, belirlenmiş ücret yok)
--   6) invoices         : tahakkuk ve bakiye
--   7) profiles'a anamnez özeti alanları
-- IDEMPOTENT — veri silinmez.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------- 7) Profil üzerindeki anamnez özeti ----------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS allergies   TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS chronic     TEXT DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS medications TEXT DEFAULT '';

-- ---------- 1) ANAMNEZ ----------
CREATE TABLE IF NOT EXISTS anamnesis (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'alerji',   -- alerji | hastalik | ilac | mudah
  title TEXT NOT NULL,
  detail TEXT DEFAULT '',
  critical BOOLEAN DEFAULT false,        -- true = tedavi öncesi kritik uyarı
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS anamnesis_patient_idx ON anamnesis (patient_id, created_at DESC);

ALTER TABLE anamnesis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anamnesis_rw" ON anamnesis;
CREATE POLICY "anamnesis_rw" ON anamnesis FOR ALL
  USING (is_hekim() OR is_admin() OR patient_id = auth.uid())
  WITH CHECK (is_hekim() OR is_admin() OR patient_id = auth.uid());

-- ---------- 2) TEDAVİ PLANI ----------
CREATE TABLE IF NOT EXISTS treatment_plans (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  fdi INT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planlandi',  -- planlandi | devam | bitti | iptal
  price NUMERIC DEFAULT 0,
  tooth TEXT DEFAULT '',
  note TEXT DEFAULT '',
  doctor_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS plans_patient_idx ON treatment_plans (patient_id, created_at DESC);

ALTER TABLE treatment_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_rw" ON treatment_plans;
CREATE POLICY "plans_rw" ON treatment_plans FOR ALL
  USING (is_hekim() OR is_admin() OR patient_id = auth.uid())
  WITH CHECK (is_hekim() OR is_admin() OR patient_id = auth.uid());

-- ---------- 3) MALZEME ENVANTERİ ----------
CREATE TABLE IF NOT EXISTS materials (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'sarf',
  unit TEXT DEFAULT 'adet',
  quantity NUMERIC DEFAULT 0,
  min_quantity NUMERIC DEFAULT 0,
  expiry DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "materials_rw" ON materials;
CREATE POLICY "materials_rw" ON materials FOR ALL
  USING (is_hekim() OR is_admin()) WITH CHECK (is_hekim() OR is_admin());

-- ---------- 4) LABORATUVAR TAKİBİ ----------
CREATE TABLE IF NOT EXISTS lab_cases (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  patient_name TEXT DEFAULT '',
  kind TEXT NOT NULL,                       -- protez | zirkonyum | implant | ortodonti | tamir
  lab TEXT DEFAULT '',
  sent_at DATE DEFAULT CURRENT_DATE,
  due_at DATE,
  status TEXT NOT NULL DEFAULT 'laboratuvarda', -- laboratuvarda | geldi | uygulandi
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE lab_cases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lab_rw" ON lab_cases;
CREATE POLICY "lab_rw" ON lab_cases FOR ALL
  USING (is_hekim() OR is_admin()) WITH CHECK (is_hekim() OR is_admin());

-- ============================================================
-- 5-6) FİYAT LİSTESİ VE TAHAKKUK/BAKİYE — KALDIRILDI
--
-- Bu proje DEVLET PROJESİDİR. Devlet tarafından belirlenmiş bir
-- ücret/fiyat listesi YOKTUR. Bu nedenle price_items ve invoices
-- tabloları bu dosyada OLUŞTURULMAZ ve örnek fiyat verisi EKLENMEZ.
--
-- ÖNCEKİ SÜRÜM NOTU: Daha önce burada 12 kalemlik örnek fiyat listesi
-- ve hasta bakiye/tahakkuk tablosu vardı. Bunlar kaldırıldı:
--   - Devlet tarafından belirlenmemiş ücretleri göstermek yanıltıcıdır
--   - Hasta hesabı/tahsilat takibi bu projenin kapsamında değildir
--   - Ülkemizde sağlık hizmeti fiyatlandırması düzenlemeyle belirlenir;
--     uygulama kendi fiyat listesi tutarak çelişki yaratabilir
--
-- Daha önce kurulmuş veritabanlarında bu tablolar ARŞİVDE kalır;
-- onları silmiyoruz çünkü içlerinde geçmiş veri olabilir. Uygulama
-- artık bu tabloları hiç okumuyor ve yazmıyor.
-- ============================================================

-- ================================================================
-- BÖLÜM 11/16: 10) Hekim kişisel takvimi (etkinlik ve görevler)
-- Kaynak: db/migration_events.sql
-- ================================================================

-- ============================================================
-- TeleDentist — HEKİM KİŞİSEL TAKVİMİ (etkinlik / görev)
-- Randevulardan bağımsız: hekim kendi iş etkinliklerini yazar.
-- ============================================================

CREATE TABLE IF NOT EXISTS doctor_events (
  id BIGSERIAL PRIMARY KEY,
  doctor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'gorev',   -- gorev | etkinlik | toplanti | izin | egitim
  event_date DATE NOT NULL,
  event_time TEXT DEFAULT '09:00',
  duration_min INT DEFAULT 30,
  note TEXT DEFAULT '',
  done BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS doctor_events_idx ON doctor_events (doctor_id, event_date);

ALTER TABLE doctor_events ENABLE ROW LEVEL SECURITY;

-- Hekim yalnızca kendi etkinliğini görür ve yazar; süper admin hepsini görür
DROP POLICY IF EXISTS "events_own" ON doctor_events;
CREATE POLICY "events_own" ON doctor_events FOR ALL
  USING (doctor_id = auth.uid() OR is_admin())
  WITH CHECK (doctor_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "events_read_all" ON doctor_events;
CREATE POLICY "events_read_all" ON doctor_events FOR SELECT USING (is_hekim() OR is_admin());

-- ================================================================
-- BÖLÜM 12/16: 11) Sekreter ve diş teknisyeni rolleri + yardımcı tablolar
-- Kaynak: db/migration_staff.sql
-- ================================================================

-- ============================================================
-- TeleDentist — SEKRETER / DİŞ TEKNİSYENİ ROLLERİ
--   sekreter  : randevu, ön bilgilendirme, hasta kaydı, iletişim
--   teknisyen : hasta adına dijital form doldurma (yüz yüze)
-- ============================================================

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin','hekim','hasta','ebeveyn','sekreter','teknisyen'));

-- Yetki yardımcıları
CREATE OR REPLACE FUNCTION public.is_staff() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin','hekim','sekreter','teknisyen')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Randevuları sekreter de yazabilir / düzenleyebilir
DROP POLICY IF EXISTS "appt_staff" ON appointments;
CREATE POLICY "appt_staff" ON appointments FOR UPDATE
  USING (is_staff()) WITH CHECK (is_staff());

DROP POLICY IF EXISTS "appt_delete_staff" ON appointments;
CREATE POLICY "appt_delete_staff" ON appointments FOR DELETE USING (is_staff());

-- Sekreter/teknisyen hasta profili oluşturup güncelleyebilir (hekim kadar değil)
DROP POLICY IF EXISTS "staff_profile_write" ON profiles;
CREATE POLICY "staff_profile_write" ON profiles FOR INSERT
  WITH CHECK (is_staff());
DROP POLICY IF EXISTS "staff_profile_update" ON profiles;
CREATE POLICY "staff_profile_update" ON profiles FOR UPDATE
  USING (is_staff()) WITH CHECK (is_staff());

-- Yüz yüze doldurulan hasta kayıtları (teknisyen girer)
CREATE TABLE IF NOT EXISTS intake_records (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  recorded_by UUID REFERENCES profiles(id),
  method TEXT NOT NULL DEFAULT 'yuz-yuze',  -- yuz-yuze | telefon | hasta girdisi
  pain INT DEFAULT 0,
  complaint TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE intake_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "intake_rw" ON intake_records;
CREATE POLICY "intake_rw" ON intake_records FOR ALL
  USING (is_staff()) WITH CHECK (is_staff());

-- Ön bilgilendirme / hazırlık notları (randevu öncesi)
CREATE TABLE IF NOT EXISTS prep_notes (
  id BIGSERIAL PRIMARY KEY,
  appointment_id BIGINT REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  author_id UUID REFERENCES profiles(id),
  text TEXT NOT NULL,
  done BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE prep_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prep_rw" ON prep_notes;
CREATE POLICY "prep_rw" ON prep_notes FOR ALL
  USING (is_staff()) WITH CHECK (is_staff());

-- ================================================================
-- BÖLÜM 13/16: 12) Kurulum durumu fonksiyonu (uygulama bunu okur)
-- Kaynak: db/setup_status.sql
-- ================================================================

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
                                  'kayit_istekleri','referrals','parent_child','photos','doctor_events',
                                  'intake_records','prep_notes'];
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

-- ================================================================
-- BÖLÜM 14/16: 13) Hasta görüşme talebi: hekim listesi fonksiyonu (RLS bypass, minumum veri)
-- Kaynak: db/migration_hekim_listesi.sql
-- ================================================================

-- ==========================================================================
-- Hasta görüşme akışı: hasta hekim listesini görebilmeli
-- ==========================================================================
-- SORUN: profiles SELECT politikası "id = auth.uid() OR is_hekim()" olduğu için
-- hasta yalnız kendi kaydını okur; listDoctors() boş döner ve "Hekimimle
-- Görüşme Talebi" kartında hekim seçilemez ("kullanıcı tanımlı değil" hatası).
--
-- ÇÖZÜM: SECURITY DEFINER fonksiyon hekimlerin GENEL bilgilerini (id, ad,
-- branş) döner. E-posta, TC, telefon gibi özel veriler AÇILMAZ.
-- Idempotent: defalarca çalıştırılabilir.
-- ==========================================================================

DROP FUNCTION IF EXISTS hastaya_hekim_listesi();
CREATE FUNCTION hastaya_hekim_listesi()
RETURNS TABLE (id uuid, name text, branch text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.name, COALESCE(p.branch, 'genel')
  FROM profiles p
  WHERE p.role = 'hekim'
  ORDER BY p.name
$$;

GRANT EXECUTE ON FUNCTION hastaya_hekim_listesi() TO anon, authenticated;

-- ================================================================
-- BÖLÜM 15/16: 14) Süper admin hesabını admin yapar
-- Kaynak: db/fix_admin.sql
-- ================================================================

-- ============================================================
-- Süper admin düzeltmesi: tcsametsari@gmail.com
-- Bu dosya IDEMPOTENTtir (defalarca çalıştırılabilir).
-- Profil kaydı yoksa auth.users'tan otomatik OLUSTURUR,
-- varsa admin rolüne ve "Dt. Resul Yel" adına çevirir.
-- ============================================================

-- 1) Rol kısıtı admin'i de kabul ediyor mu? (migration_roles.sql çalışmamışsa düzelt)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin','hekim','hasta','ebeveyn'));

-- 2) Branş kolonu yoksa ekle (migration_roles.sql çalışmamışsa düzelt)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'genel';

-- 3) Profil kaydı yoksa oluştur, varsa admin yap
INSERT INTO profiles (id, role, email, name, branch, reminder_days)
SELECT u.id, 'admin', u.email, 'Dt. Resul Yel', 'genel', 5
FROM auth.users u
WHERE u.email = 'tcsametsari@gmail.com'
ON CONFLICT (id) DO UPDATE
  SET role = 'admin',
      name = 'Dt. Resul Yel',
      branch = 'genel';

-- 4) Yedek: e-posta ile de eşleşirse (büyük/küçük harf farkı düzeltilir)
UPDATE profiles SET role = 'admin', name = 'Dt. Resul Yel'
WHERE lower(email) = 'tcsametsari@gmail.com';

-- 5) Kontrol: sonucu ekranda göster (role 'admin' görünmeli)
SELECT id, email, name, role, branch, created_at
FROM profiles
WHERE lower(email) = 'tcsametsari@gmail.com';

-- Beklenen sonuç:
-- role = admin
-- name = Dt. Resul Yel
-- Eğer sonuç boş geliyorsa auth.users'ta bu e-posta ile bir kullanıcı YOK demektir:
-- Supabase > Authentication > Users > "Add user" ile kullanıcıyı oluştur,
-- sonra bu dosyayı TEKRAR çalıştır.

-- ================================================================
-- BÖLÜM 16/16: 15) Eski demo hekim kayıtlarını temizler
-- Kaynak: db/fix_demo_doctor.sql
-- ================================================================

-- ============================================================
-- Demo hekim temizliği + "Dt. Resul Yel" birleştirme
-- Bu dosya veri SİLMEZ, yalnızca isim/rol düzeltir.
-- ============================================================

-- 1) "Demo" içeren hekim kayıtlarını gerçek isme çevir
UPDATE profiles
SET name = 'Resul Yel'
WHERE role IN ('hekim','admin')
  AND (lower(name) LIKE '%demo%' OR lower(email) LIKE '%demo%')
  AND lower(email) <> 'tcsametsari@gmail.com';

-- 2) Başında zaten "Dt." geçen kayıtları temizle
--    (arayüz "Dt." önekini kendisi ekliyor, çift görünmesin)
UPDATE profiles
SET name = ltrim(regexp_replace(name, '^\s*Dt\.?\s+', '', 'i'))
WHERE name ~* '^\s*Dt\.?\s';

-- 3) Süper admin
UPDATE profiles SET role = 'admin', name = 'Resul Yel'
WHERE lower(email) = 'tcsametsari@gmail.com';

-- 4) Kontrol: tüm hekim ve adminler
SELECT id, email, name, role, branch
FROM profiles
WHERE role IN ('hekim','admin')
ORDER BY role, name;
