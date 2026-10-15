-- ============================================================
-- TeleDentist — HEKİM KİŞİSEL TAKVİMİ (etkinlik / görev)
-- Randevulardan bağımsız: hekim kendi iş etkinliklerini yazar.
-- ============================================================

CREATE TABLE IF NOT EXISTS doctor_events (
  id BIGSERIAL PRIMARY KEY,
  doctor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'gorev',   -- gorev | etkinlik | toplanti | izin | egitim
  event_date DATE NOT NULL,
  event_time TEXT DEFAULT '09:00',
  duration_min INT DEFAULT 30,
  note TEXT DEFAULT '',
  done BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS doctor_events_idx ON doctor_events (doctor_id, event_date);

ALTER TABLE doctor_events ENABLE ROW LEVEL SECURITY;

-- Hekim yalnızca kendi etkinliğini görür ve yazar; süper admin hepsini görür
DROP POLICY IF EXISTS "events_own" ON doctor_events;
CREATE POLICY "events_own" ON doctor_events FOR ALL
  USING (doctor_id = auth.uid() OR is_admin())
  WITH CHECK (doctor_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "events_read_all" ON doctor_events;
CREATE POLICY "events_read_all" ON doctor_events FOR SELECT USING (is_hekim() OR is_admin());
