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
