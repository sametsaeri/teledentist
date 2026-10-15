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
