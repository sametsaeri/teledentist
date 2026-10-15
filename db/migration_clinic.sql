-- ============================================================
-- TeleDentist — KLINIK MODÜLLERİ
--   1) anamnesis        : alerji, hastalık, ilaç kayıtları
--   2) treatment_plans  : tedavi planı (aşamalı, fiyatlı)
--   3) materials        : klinik malzeme envanteri + son kullanma
--   4) lab_cases        : laboratuvar takibi (protez, zirkonyum...)
--   5) price_items      : tedavi fiyat listesi
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

-- ---------- 5) FİYAT LİSTESİ ----------
CREATE TABLE IF NOT EXISTS price_items (
  id BIGSERIAL PRIMARY KEY,
  code TEXT DEFAULT '',
  name TEXT NOT NULL,
  category TEXT DEFAULT 'tedavi',
  price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE price_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "prices_rw" ON price_items;
CREATE POLICY "prices_rw" ON price_items FOR ALL
  USING (is_hekim() OR is_admin()) WITH CHECK (is_hekim() OR is_admin());

-- ---------- 6) TAHAKKUK / BAKİYE ----------
CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  patient_name TEXT DEFAULT '',
  item TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  paid NUMERIC DEFAULT 0,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_patient_idx ON invoices (patient_id, created_at DESC);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoices_rw" ON invoices;
CREATE POLICY "invoices_rw" ON invoices FOR ALL
  USING (is_hekim() OR is_admin() OR patient_id = auth.uid())
  WITH CHECK (is_hekim() OR is_admin() OR patient_id = auth.uid());

-- ---------- Örnek fiyat listesi (tek seferlik, silinmez) ----------
INSERT INTO price_items (code, name, category, price)
SELECT * FROM (VALUES
  ('D01','Dijital diş hekimliği muayenesi','muayene',750),
  ('D02','Dijital röntgen (periapikal)','görüntüleme',350),
  ('D03','Panoramik röntgen','görüntüleme',700),
  ('F01','Kompozit dolgu (tek yüzey)','restoratif',1400),
  ('F02','Amalgam dolgu (tek yüzey)','restoratif',1100),
  ('K01','Kanal tedavisi (tek kök)','endodonti',4500),
  ('K02','Kanal tedavisi (çok kök)','endodonti',6500),
  ('T01','Diş taşı temizliği','temizlik','var'),
  ('T02','Ofis tipi beyazlatma','estetik',12000),
  ('P01','Sabit protez (tek üye)','protez',18000),
  ('P02','İmplant (yerli)','implant',22000),
  ('O01','Ortodontik muayene','ortodonti',1000)
) AS v(code, name, category, price)
WHERE NOT EXISTS (SELECT 1 FROM price_items LIMIT 1);
