-- ============================================================
-- TeleDentist — ANAMNEZ, DOSYA ARŞİVİ, KVKK ve BAKIM KURULUMU
--
-- Bu dosya, uygulamada yeni eklenen özelliklerin VERİTABANI karşılığıdır.
-- Çalıştırılmadan önce tüm veriler tarayıcıda saklanır ve CİHAZLAR ARASI
-- PAYLAŞILMAZ. Bu dosya çalıştırıldığında veriler kalıcı olur.
--
-- İÇERİK:
--   1) anamnesis tablosu — hekimin geçmiş hastalık kayıtları (yeni kolonlar)
--   2) medical_files tablosu — röntgen/belge/foto arşivi (KAYIT TAKİBİ)
--   3) kayit_istekleri'ne KVKK rıza kolonları
--   4) profiles'a username kolonu (giriş düzeltmesi)
--   5) Storage kovaları: xrays, photos, belgeler
--   6) RLS politikaları
--   7) setup_status'a yeni tablolar
--
-- IDEMPOTENT — tekrar çalıştırılabilir, mevcut veri SİLİNMEZ.
-- ÇALIŞTIRMA: Supabase Dashboard → SQL Editor → bu dosyayı yapıştır → Run
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================
-- 1) ANAMNES — hekim doldurur, hasta okur
--
-- ÖNEMLİ: eski şemada (kind/title/detail) kayıtlar olabilir.
-- Yeni kolonlar EKLENİR; eski sütunlar korunur.
-- ============================================================
CREATE TABLE IF NOT EXISTS anamnesis (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT DEFAULT 'anamnez',
  title TEXT DEFAULT '',
  detail TEXT DEFAULT '',
  critical BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Yeni klinik alanlar
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS sistemik        TEXT[] DEFAULT '{}';
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS alerjiler       TEXT DEFAULT '';
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS ilaclar         TEXT DEFAULT '';
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS gecmis_hastaliklar TEXT DEFAULT '';
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS gecmis_ameliyatlar  TEXT DEFAULT '';
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS aile_saglik     TEXT DEFAULT '';
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS dis_gecmisi     TEXT DEFAULT '';
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS agri_ozeti      TEXT DEFAULT '';
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS aik             TEXT DEFAULT '';
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS sigara          TEXT DEFAULT '';
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS alkol           TEXT DEFAULT '';
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS gebelik_durumu  TEXT DEFAULT '';
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS kullandigi_hekim TEXT DEFAULT '';
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS notlar          TEXT DEFAULT '';
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS doctor_id       UUID;
ALTER TABLE anamnesis ADD COLUMN IF NOT EXISTS updated_at      DATE DEFAULT CURRENT_DATE;

CREATE INDEX IF NOT EXISTS anamnesis_patient_idx ON anamnesis (patient_id, created_at DESC);

ALTER TABLE anamnesis ENABLE ROW LEVEL SECURITY;

-- Hekim yazar; hasta kendi kaydını OKUR (salt okunur, değiştiremez)
DROP POLICY IF EXISTS "anamnesis_hekim_yazar" ON anamnesis;
CREATE POLICY "anamnesis_hekim_yazar" ON anamnesis FOR ALL
  USING (public.is_hekim() OR public.is_admin())
  WITH CHECK (public.is_hekim() OR public.is_admin());

DROP POLICY IF EXISTS "anamnesis_hasta_oku" ON anamnesis;
CREATE POLICY "anamnesis_hasta_oku" ON anamnesis FOR SELECT
  USING (patient_id = auth.uid() OR public.is_hekim() OR public.is_admin());

-- ============================================================
-- 2) MEDICAL_FILES — röntgen / belge / foto arşivi
--
-- NEDEN BU TABLO ŞART: Dosya adı ne yüklendiğini ne zaman yüklendiğini
-- anlatmaz. Bu tablo olmadan:
--   - yanlış yüklenen röntgen silinemez
--   - arşivlenemez
--   - "hangi dosya hangi dişe ait" sorusuna cevap verilemez
-- ============================================================
CREATE TABLE IF NOT EXISTS medical_files (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  path TEXT NOT NULL,                 -- depolamadaki tam yol
  bucket TEXT NOT NULL DEFAULT 'xrays',
  tur TEXT NOT NULL DEFAULT 'xray',   -- xray | belge | foto
  category TEXT,                      -- radyoloji | tani | tedavi | sozelmes | laboratuvar | odeme | kimlik | diger
  label TEXT,                         -- tooth16 vb.
  tooth INTEGER,                      -- FDI diş numarası
  "not" TEXT DEFAULT '',              -- eski şema (ayrilmis kelime, tirnakli)
  note TEXT DEFAULT '',               -- yeni şema (ayrilmis olmayan)
  notlar TEXT DEFAULT '',             -- yedek kolon adı
  klasor TEXT DEFAULT 'genel',        -- birden fazla klasör desteği
  folder TEXT DEFAULT 'genel',        -- birden fazla klasör desteği (İngilizce)
  boyut INTEGER DEFAULT 0,
  olusturan UUID REFERENCES profiles(id),
  arsiv BOOLEAN DEFAULT false,        -- true = arşivde (SİLİNMEZ, gizlenir)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS medical_files_patient_idx ON medical_files (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS medical_files_arsiv_idx ON medical_files (patient_id, arsiv);

-- Eski şemalarda eksik kolonları ekle (idempotent)
ALTER TABLE medical_files ADD COLUMN IF NOT EXISTS "not" TEXT DEFAULT '';
ALTER TABLE medical_files ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';
ALTER TABLE medical_files ADD COLUMN IF NOT EXISTS notlar TEXT DEFAULT '';
ALTER TABLE medical_files ADD COLUMN IF NOT EXISTS klasor TEXT DEFAULT 'genel';
ALTER TABLE medical_files ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT 'genel';

ALTER TABLE medical_files ENABLE ROW LEVEL SECURITY;

-- Hekim tam yetki (yükler, arşivler, siler)
DROP POLICY IF EXISTS "medical_files_hekim" ON medical_files;
CREATE POLICY "medical_files_hekim" ON medical_files FOR ALL
  USING (public.is_hekim() OR public.is_admin())
  WITH CHECK (public.is_hekim() OR public.is_admin());

-- Hasta kendi dosyalarını GÖRÜNTÜLEYEBİLİR ama SİLEMEZ/ARŞİVLEYEMEZ
DROP POLICY IF EXISTS "medical_files_hasta_oku" ON medical_files;
CREATE POLICY "medical_files_hasta_oku" ON medical_files FOR SELECT
  USING (patient_id = auth.uid() OR public.is_hekim() OR public.is_admin());

-- ============================================================
-- 3) KVKK RIZA KANITI — kayit_istekleri tablosuna eklenir
--
-- YASAL DAYANAK: 6698 md. 5/1 (aydınlatma) ve md. 3/6 (açık rıza).
-- Sağlık verisi özel niteliklidir; rıza kaydı talep satırında tutulur.
-- ============================================================
ALTER TABLE kayit_istekleri ADD COLUMN IF NOT EXISTS kvkk_onay  BOOLEAN DEFAULT false;
ALTER TABLE kayit_istekleri ADD COLUMN IF NOT EXISTS kvkk_surum TEXT DEFAULT '1.0';
ALTER TABLE kayit_istekleri ADD COLUMN IF NOT EXISTS kvkk_zaman TIMESTAMPTZ;
ALTER TABLE kayit_istekleri ADD COLUMN IF NOT EXISTS username    TEXT;

CREATE INDEX IF NOT EXISTS kayit_istekleri_kvkk_idx ON kayit_istekleri (kvkk_onay);

-- ============================================================
-- 4) PROFILES — username kolonu (giriş hatası düzeltmesi)
--
-- SORUN: username boş kalınca sunucu boş döner ve hasta
-- "Bu kullanıcı adı bulunamadı" hatası görür — hesabı varken bile.
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;

-- Var olan hesaplar için username boşsa e-postadan türet
UPDATE profiles
SET username = lower(split_part(email, '@', 1))
WHERE (username IS NULL OR username = '') AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_idx
  ON profiles (username) WHERE username IS NOT NULL AND username <> '';

-- resolve_login_id username'a da baksın
CREATE OR REPLACE FUNCTION public.resolve_login_id(p_identifier text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_email text;
BEGIN
  SELECT lower(p.email) INTO v_email
  FROM profiles p
  WHERE lower(p.username) = lower(p_identifier)
     OR lower(p.email) = lower(p_identifier)
     OR lower(p.name) = lower(p_identifier)
  LIMIT 1;

  IF v_email IS NULL THEN RETURN NULL; END IF;
  RETURN v_email;
END;
$$;

-- ============================================================
-- 5) STORAGE KOVALARI
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('xrays', 'xrays', false), ('photos', 'photos', false), ('belgeler', 'belgeler', false)
ON CONFLICT (id) DO NOTHING;

-- Dosya yükleme / indirme / silme kuralları
DROP POLICY IF EXISTS "belge_yukle" ON storage.objects;
CREATE POLICY "belge_yukle" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id IN ('xrays','photos','belgeler')
    AND ( auth.uid()::text = (storage.foldername(name))[1]
          OR public.is_hekim() OR public.is_admin() )
  );

DROP POLICY IF EXISTS "belge_oku" ON storage.objects;
CREATE POLICY "belge_oku" ON storage.objects FOR SELECT
  USING (
    bucket_id IN ('xrays','photos','belgeler')
    AND ( auth.uid()::text = (storage.foldername(name))[1]
          OR public.is_hekim() OR public.is_admin() )
  );

-- Silme yalnız hekime açık (veri kaybına karşı)
DROP POLICY IF EXISTS "belge_sil" ON storage.objects;
CREATE POLICY "belge_sil" ON storage.objects FOR DELETE
  USING (
    bucket_id IN ('xrays','photos','belgeler')
    AND (public.is_hekim() OR public.is_admin())
  );

-- ============================================================
-- 6) register_patient_request — KVKK parametreleri eklendi
--
-- RPC üzerinden gelen kayıtlar da rıza kanıtı taşısın diye
-- fonksiyon güncelleniyor. Sunucu tarafında da kontrol edilir:
-- rıza yoksa kayıt yazılmaz.
-- NOT: auth.users'a INSERT yapılmaz; hesap hekim onayıyla
-- decide_registration_request içinde açılır.
-- ============================================================
CREATE OR REPLACE FUNCTION public.register_patient_request(
  p_email text,
  p_password text,
  p_name text,
  p_role text,
  p_child_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_note text DEFAULT NULL,
  p_username text DEFAULT NULL,
  p_kvkk_onay boolean DEFAULT false,
  p_kvkk_surum text DEFAULT '1.0',
  p_kvkk_zaman timestamptz DEFAULT NULL,
  p_kvkk_ip_notu text DEFAULT 'kayıt anındaki oturum'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_exists boolean;
BEGIN
  -- KVKK: rıza olmadan kayıt talebi oluşturulmaz (md. 5/1, md. 3/6)
  IF COALESCE(p_kvkk_onay, false) = false THEN
    RETURN json_build_object('error', 'KVKK aydınlatma metni onaylanmadan kayıt talebi olusturulamaz.');
  END IF;

  -- Duplicate kontrol
  SELECT true INTO v_exists FROM kayit_istekleri WHERE lower(email) = lower(p_email);
  IF v_exists THEN
    RETURN json_build_object('error', 'Bu e-posta için zaten talep gönderilmiş.');
  END IF;

  -- Talep satırı: KVKK kanıtı dahil
  INSERT INTO kayit_istekleri
    (user_id, email, username, name, role, child_email, phone, note,
     kvkk_onay, kvkk_surum, kvkk_zaman, kvkk_ip_notu)
  VALUES
    (NULL, lower(trim(p_email)), 
     COALESCE(NULLIF(trim(p_username), ''), lower(split_part(lower(trim(p_email)), '@', 1))),
     trim(p_name), p_role, p_child_email, p_phone, p_note,
     true, COALESCE(p_kvkk_surum,'1.0'), COALESCE(p_kvkk_zaman, now()),
     COALESCE(p_kvkk_ip_notu, 'kayıt anındaki oturum'))
  RETURNING id INTO v_uid;

  RETURN json_build_object('uid', v_uid, 'email', lower(trim(p_email)), 
    'username', COALESCE(NULLIF(trim(p_username), ''), lower(split_part(lower(trim(p_email)), '@', 1))));
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_patient_request(text,text,text,text,text,text,text,text,boolean,text,timestamptz,text) TO anon, authenticated;

-- ============================================================
-- 7) decide_registration_request — username da yazsın
--
-- SORUN: eski fonksiyon username'i hiç yazmıyordu; profil boş kalınca
-- hasta "Bu kullanıcı adı bulunamadı" hatası alıyordu.
-- ============================================================
CREATE OR REPLACE FUNCTION public.decide_registration_request(
  p_request_id bigint,
  p_approve boolean,
  p_doctor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r kayit_istekleri%ROWTYPE;
  v_username text;
BEGIN
  IF NOT (public.is_hekim() OR public.is_admin()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Yetkisiz islem');
  END IF;

  SELECT * INTO r FROM kayit_istekleri WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Talep bulunamadi');
  END IF;

  -- RIZA KONTROLÜ: onaysız talep onaylanamaz (kanuni zorunluluk)
  IF p_approve AND NOT COALESCE(r.kvkk_onay, false) THEN
    RETURN jsonb_build_object('ok', false,
      'error', 'Bu talepte KVKK riza kaydi yok. Hasta onayini yeniden alin.');
  END IF;

  IF NOT p_approve THEN
    DELETE FROM kayit_istekleri WHERE id = p_request_id;
    RETURN jsonb_build_object('ok', true, 'durum', 'reddedildi');
  END IF;

  -- Kullanıcı adı: talepte varsa onu, yoksa e-postadan türet
  v_username := COALESCE(NULLIF(r.username, ''), lower(split_part(r.email, '@', 1)));

  INSERT INTO profiles (id, role, email, name, username, created_by)
  VALUES (r.user_id, r.role, r.email, r.name, v_username, p_doctor_id)
  ON CONFLICT (id) DO UPDATE
    SET username = COALESCE(profiles.username, EXCLUDED.username);

  -- Ebeveyn–çocuk bağı
  IF r.role = 'ebeveyn' AND r.child_email IS NOT NULL THEN
    INSERT INTO parent_child (parent_id, child_id)
    SELECT r.user_id, p.id FROM profiles p
    WHERE lower(p.email) = lower(r.child_email)
    ON CONFLICT DO NOTHING;
  END IF;

  DELETE FROM kayit_istekleri WHERE id = p_request_id;
  RETURN jsonb_build_object('ok', true, 'durum', 'onaylandi', 'username', v_username);
END;
$$;

-- ============================================================
-- 8) BAKIM MODU — sunucudan tüm kullanıcılara aynı anda
--
-- Tarayıcıda tutmak tek cihazı etkiler. Sunucuda tutmak
-- tüm cihazları aynı anda etkiler.
-- ============================================================
CREATE TABLE IF NOT EXISTS bakim_durumu (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  acik BOOLEAN DEFAULT false,
  neden TEXT DEFAULT '',
  aciklama TEXT DEFAULT '',
  tahmini TEXT DEFAULT '',
  kim TEXT DEFAULT '',
  baslangic TIMESTAMPTZ,
  bitti TIMESTAMPTZ,
  bitti_kim TEXT,
  bitis_notu TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO bakim_durumu (id, acik) VALUES (1, false) ON CONFLICT (id) DO NOTHING;

ALTER TABLE bakim_durumu ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (kullanıcı açıklamayı görmeli)
DROP POLICY IF EXISTS "bakim_oku" ON bakim_durumu;
CREATE POLICY "bakim_oku" ON bakim_durumu FOR SELECT USING (true);

-- Yalnız admin değiştirir
DROP POLICY IF EXISTS "bakim_yaz" ON bakim_durumu;
CREATE POLICY "bakim_yaz" ON bakim_durumu FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- ============================================================
-- 10) BİLDİRİMLER — gerçek olay bildirimleri
--
-- SORUN: notifications tablosu yalnız randevu/kontrol hatırlatması için
-- tasarlanmıştı ve okundu bilgisi tutulmuyordu. Şimdi:
--   link  : tıklanınca gidilecek yol
--   onem  : kritik | yuksek | normal (renk ve rozet için)
--   status: bekliyor | okundu | kapandi
--
-- kind artık: kayit_talebi | randevu | randevu_bildirimi | foto
--             belge | anamnez | sevk | kontrol | bakim
-- ============================================================
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link TEXT DEFAULT '';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS onem TEXT DEFAULT 'normal';

-- Hekime giden bildirimler (doctor_id NULL) TÜM hekimlere düşer:
-- "hekim kanalı" bildirimleri. Hasta bildirimleri kendisine gider.
DROP POLICY IF EXISTS "notif_rw" ON notifications;
CREATE POLICY "notif_rw" ON notifications FOR ALL
  USING (
    doctor_id = auth.uid()
    OR is_admin()
    OR (doctor_id IS NULL AND is_hekim())
  )
  WITH CHECK (
    doctor_id = auth.uid()
    OR is_admin()
    OR (doctor_id IS NULL AND is_hekim())
  );

-- Hastalar kendi bildirimlerini okuyabilmeli (randevu onayı vb.)
DROP POLICY IF EXISTS "notif_hasta_oku" ON notifications;
CREATE POLICY "notif_hasta_oku" ON notifications FOR SELECT
  USING (patient_id = auth.uid());

-- Okundu sayımı için indeks
CREATE INDEX IF NOT EXISTS notifications_okundu_idx
  ON notifications (doctor_id, status, created_at DESC);

-- ============================================================
-- 11) setup_status — yeni tabloları da denetle
-- ============================================================
CREATE OR REPLACE FUNCTION public.setup_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required_fn   text[] := ARRAY['is_hekim','is_admin','create_account','resolve_login_id',
                                  'admin_set_password','admin_update_profile',
                                  'register_patient_request','decide_registration_request'];
  v_required_tbl  text[] := ARRAY['profiles','teeth','triage','hygiene','anxiety',
                                  'appointments','notifications','clinical_notes',
                                  'kayit_istekleri','referrals','parent_child','photos','doctor_events',
                                  'intake_records','prep_notes','anamnesis','medical_files','bakim_durumu'];
  v_required_cols text[] := ARRAY['username','branch','tc_no','birth_date','gender','phone',
                                  'address','city','district','blood','insurance','school',
                                  'occupation','near_name','near_phone','near_relation',
                                  'reminder_days','last_visit'];
  v_kvkk_cols     text[] := ARRAY['kvkk_onay','kvkk_surum','kvkk_zaman'];

  v_fns text[] := ARRAY[]::text[];
  v_tbls text[] := ARRAY[]::text[];
  v_pcols text[] := ARRAY[]::text[];
  v_kcols text[] := ARRAY[]::text[];
  v_acols text[] := ARRAY[]::text[];
  v_buckets text[] := ARRAY[]::text[];
  v_mcols text[] := ARRAY[]::text[];

  v_miss_fn text[] := ARRAY[]::text[];
  v_miss_tbl text[] := ARRAY[]::text[];
  v_miss_cols text[] := ARRAY[]::text[];
  v_miss_kcols text[] := ARRAY[]::text[];
  v_miss_acols text[] := ARRAY[]::text[];
  v_miss_buck text[] := ARRAY[]::text[];
  v_miss_mcols text[] := ARRAY[]::text[];

  f text;
  b text;
BEGIN
  SELECT coalesce(array_agg(proname), '{}') INTO v_fns
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = ANY(v_required_fn);
  FOREACH f IN ARRAY v_required_fn LOOP
    IF NOT (f = ANY(v_fns)) THEN v_miss_fn := array_append(v_miss_fn, f); END IF;
  END LOOP;

  SELECT coalesce(array_agg(table_name), '{}') INTO v_tbls
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = ANY(v_required_tbl);
  FOREACH f IN ARRAY v_required_tbl LOOP
    IF NOT (f = ANY(v_tbls)) THEN v_miss_tbl := array_append(v_miss_tbl, f); END IF;
  END LOOP;

  SELECT coalesce(array_agg(column_name), '{}') INTO v_pcols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = ANY(v_required_cols);
  FOREACH f IN ARRAY v_required_cols LOOP
    IF NOT (f = ANY(v_pcols)) THEN v_miss_cols := array_append(v_miss_cols, f); END IF;
  END LOOP;

  SELECT coalesce(array_agg(column_name), '{}') INTO v_kcols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'kayit_istekleri' AND column_name = ANY(v_kvkk_cols);
  FOREACH f IN ARRAY v_kvkk_cols LOOP
    IF NOT (f = ANY(v_kcols)) THEN v_miss_kcols := array_append(v_miss_kcols, f); END IF;
  END LOOP;

  SELECT coalesce(array_agg(column_name), '{}') INTO v_mcols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'medical_files' AND column_name = ANY(ARRAY['arsiv','category','tooth','boyut']);

  SELECT coalesce(array_agg(column_name), '{}') INTO v_acols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'appointments' AND column_name = ANY(ARRAY['appt_date','appt_time','is_online','patient_id','approved_at']);
  FOREACH f IN ARRAY ARRAY['appt_date','appt_time','is_online','patient_id','approved_at'] LOOP
    IF NOT (f = ANY(v_acols)) THEN v_miss_acols := array_append(v_miss_acols, f); END IF;
  END LOOP;

  BEGIN
    SELECT coalesce(array_agg(id), '{}') INTO v_buckets
    FROM storage.buckets WHERE id IN ('xrays','photos','belgeler');
    FOREACH b IN ARRAY ARRAY['xrays','photos','belgeler'] LOOP
      IF NOT (b = ANY(v_buckets)) THEN v_miss_buck := array_append(v_miss_buck, b); END IF;
    END LOOP;
  EXCEPTION WHEN others THEN
    v_miss_buck := ARRAY['xrays','photos','belgeler'];
  END;

  RETURN jsonb_build_object(
    'ok', array_length(v_miss_fn,1) IS NULL
      AND array_length(v_miss_tbl,1) IS NULL
      AND array_length(v_miss_cols,1) IS NULL
      AND array_length(v_miss_acols,1) IS NULL
      AND array_length(v_miss_buck,1) IS NULL
      AND array_length(v_miss_kcols,1) IS NULL,
    'functions', v_fns,
    'tables', v_tbls,
    'profile_columns', v_pcols,
    'appointment_columns', v_acols,
    'buckets', v_buckets,
    'missing_functions', v_miss_fn,
    'missing_tables', v_miss_tbl,
    'missing_profile_columns', v_miss_cols,
    'missing_appointment_columns', v_miss_acols,
    'missing_buckets', v_miss_buck,
    'missing_kvkk_columns', v_miss_kcols,
    'medical_file_columns', v_mcols
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.setup_status() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.resolve_login_id(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_patient_request(text,text,text,text,text,text,text,text,boolean,text,timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decide_registration_request(bigint,boolean,uuid) TO authenticated;

-- ============================================================
-- TAMAMLANDI
--
-- Sonraki adım: Supabase Dashboard → Authentication → URL Configuration
-- içinde Site URL ve Redirect URL'lerine sitenizin adresini ekleyin.
-- ============================================================