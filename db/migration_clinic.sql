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
