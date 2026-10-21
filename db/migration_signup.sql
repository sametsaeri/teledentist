-- Kayıt isteği tablosu: hasta kendi kaydını ister, hekim onaylar
-- Supabase SQL Editor'de çalıştırın. Ardından Authentication > Sign In/Providers >
-- "Allow new users to sign up" anahtarını AÇIN (hesap onaysız işe yaramaz).

CREATE TABLE IF NOT EXISTS kayit_istekleri (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('hasta','ebeveyn')),
  child_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE kayit_istekleri ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "istek_insert" ON kayit_istekleri;
CREATE POLICY "istek_insert" ON kayit_istekleri FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "istek_hekim" ON kayit_istekleri;
CREATE POLICY "istek_hekim" ON kayit_istekleri FOR ALL USING (is_hekim() OR is_admin());
