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