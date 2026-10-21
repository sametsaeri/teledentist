-- ==========================================================================
-- Bildirim RLS düzeltmesi — hekim + hasta ikili taraf akışı
-- ==========================================================================
-- SORUN: tek politika "notif_rw FOR ALL USING (doctor_id = auth.uid() OR is_admin())"
-- hastanın bilgi okumasını/içine yazmasını engelliyordu:
--   - Hekim hastaya bildirim yazabiliyordu; hasta kendi bildirimini okuyamıyordu.
--   - Hasta "görüşme talebi" gönderiyordu ama INSERT 403 veriyor,
--     uygulama sessizce localStorage'a düşüyordu — bildirim DB'ye hiç gitmiyor.
--
-- ÇÖZÜM: okuma ve yazma için AYRI politikalar:
--   OKUMA  : kendi hekim bildirimi / kendi hasta bildirimi / admin /
--            hekim kanları (doctor_id NULL her hekime gider)
--   YAZMA  : targeti kendinin olduğu satır veya admin
--            (hekim kendi kanalına yazar; hasta kendi patient_id'siyle yazar)
-- Idempotent.
-- ==========================================================================

DROP POLICY IF EXISTS "notif_rw" ON notifications;
DROP POLICY IF EXISTS "notif_read" ON notifications;
DROP POLICY IF EXISTS "notif_write" ON notifications;

-- Okuma: hekim kendine geleni, hasta kendine geleni, admin her şeyi, hekim kanıroları
CREATE POLICY "notif_read" ON notifications FOR SELECT
USING (
  doctor_id = auth.uid()
  OR patient_id = auth.uid()
  OR (doctor_id IS NULL AND (is_hekim() OR is_admin()))
);

-- Yazma: hedefin kendinsin veya admin
-- (hekim -> doctor_id kendi set eder; hasta -> patient_id kendine yazar)
CREATE POLICY "notif_write" ON notifications FOR INSERT
WITH CHECK (
  doctor_id = auth.uid()
  OR patient_id = auth.uid()
  OR is_admin()
  OR (doctor_id IS NULL AND (is_hekim() OR is_admin()))
);

-- Okundu/silme işlemleri: yazan taraf kendi satırını güncelleyip savaş artık okur
CREATE POLICY "notif_update" ON notifications FOR UPDATE
USING (doctor_id = auth.uid() OR patient_id = auth.uid() OR is_admin());
CREATE POLICY "notif_delete" ON notifications FOR DELETE
USING (doctor_id = auth.uid() OR patient_id = auth.uid() OR is_admin());
