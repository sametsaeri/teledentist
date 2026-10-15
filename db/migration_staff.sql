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
