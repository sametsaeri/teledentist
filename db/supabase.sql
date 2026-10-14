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
