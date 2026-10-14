-- KTU TeleDentist PostgreSQL şeması (yalnızca diş hekimliği kapsamı)
-- Kayıt politikası: hasta/ebeveyn kaydını yalnızca hekim açar (created_by = hekim id)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('hekim','hasta','ebeveyn')),
  email TEXT UNIQUE NOT NULL,
  pass_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  last_visit DATE,
  treatment_type TEXT DEFAULT 'kontrol',
  plaque_index NUMERIC DEFAULT 1,
  anxiety_score INT DEFAULT 3,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE parent_child (
  parent_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  child_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (parent_id, child_id)
);

CREATE TABLE teeth (
  patient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  fdi INT NOT NULL CHECK (fdi BETWEEN 11 AND 48),
  status TEXT NOT NULL DEFAULT 'saglam'
    CHECK (status IN ('saglam','dolgu','kanal','kaplama','takip','cekim','implant')),
  treatment TEXT DEFAULT '-',
  doctor_note TEXT DEFAULT '',
  updated_at DATE DEFAULT CURRENT_DATE,
  PRIMARY KEY (patient_id, fdi)
);

CREATE TABLE xrays (
  id BIGSERIAL PRIMARY KEY,
  patient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  tooth INT,
  image_url TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reports (
  id BIGSERIAL PRIMARY KEY,
  patient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  note TEXT DEFAULT '',
  rdate DATE DEFAULT CURRENT_DATE
);

CREATE TABLE triage (
  id BIGSERIAL PRIMARY KEY,
  patient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  tooth TEXT,
  pain INT DEFAULT 0,
  swelling BOOLEAN DEFAULT false,
  trauma BOOLEAN DEFAULT false,
  bleeding BOOLEAN DEFAULT false,
  fever BOOLEAN DEFAULT false,
  score INT,
  level TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE hygiene (
  id BIGSERIAL PRIMARY KEY,
  patient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  plaque NUMERIC,
  brush INT,
  hdate DATE DEFAULT CURRENT_DATE
);

CREATE TABLE anxiety (
  id BIGSERIAL PRIMARY KEY,
  patient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  total INT,
  adate DATE DEFAULT CURRENT_DATE
);

CREATE TABLE photos (
  id BIGSERIAL PRIMARY KEY,
  patient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  status TEXT DEFAULT 'hekime iletildi',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE photo_notes (
  photo_id BIGINT PRIMARY KEY REFERENCES photos(id) ON DELETE CASCADE,
  note TEXT DEFAULT ''
);

CREATE TABLE appointments (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT NOT NULL,
  dept TEXT DEFAULT 'genel-dis',
  complaint TEXT NOT NULL,
  status TEXT DEFAULT 'yeni',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reminders (
  id BIGSERIAL PRIMARY KEY,
  rtype TEXT NOT NULL,
  to_addr TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'queued',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE points (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  amount INT NOT NULL,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE satisfaction (
  id BIGSERIAL PRIMARY KEY,
  patient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  score INT CHECK (score BETWEEN 1 AND 5),
  access TEXT,
  note TEXT DEFAULT '',
  sdate DATE DEFAULT CURRENT_DATE
);

CREATE TABLE consults (
  id BIGSERIAL PRIMARY KEY,
  from_user TEXT REFERENCES users(id),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE consents (
  patient_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  signed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE recall_log (
  id BIGSERIAL PRIMARY KEY,
  patient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  months INT,
  next_visit DATE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Örnek hekim (şifre: hekim123 -> bcrypt ile üretin, bu satır örnek hash değildir)
-- INSERT INTO users (id, role, email, pass_hash, name) VALUES
-- ('d1','hekim','hekim@demo', crypt('hekim123', gen_salt('bf')), 'Dt. Demo Hekim');
