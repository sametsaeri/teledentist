-- ============================================================
-- Süper admin düzeltmesi: tcsametsari@gmail.com
-- Bu dosya IDEMPOTENTtir (defalarca çalıştırılabilir).
-- Profil kaydı yoksa auth.users'tan otomatik OLUSTURUR,
-- varsa admin rolüne ve "Dt. Resul Yel" adına çevirir.
-- ============================================================

-- 1) Rol kısıtı admin'i de kabul ediyor mu? (migration_roles.sql çalışmamışsa düzelt)
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin','hekim','hasta','ebeveyn'));

-- 2) Branş kolonu yoksa ekle (migration_roles.sql çalışmamışsa düzelt)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT 'genel';

-- 3) Profil kaydı yoksa oluştur, varsa admin yap
INSERT INTO profiles (id, role, email, name, branch, reminder_days)
SELECT u.id, 'admin', u.email, 'Dt. Resul Yel', 'genel', 5
FROM auth.users u
WHERE u.email = 'tcsametsari@gmail.com'
ON CONFLICT (id) DO UPDATE
  SET role = 'admin',
      name = 'Dt. Resul Yel',
      branch = 'genel';

-- 4) Yedek: e-posta ile de eşleşirse (büyük/küçük harf farkı düzeltilir)
UPDATE profiles SET role = 'admin', name = 'Dt. Resul Yel'
WHERE lower(email) = 'tcsametsari@gmail.com';

-- 5) Kontrol: sonucu ekranda göster (role 'admin' görünmeli)
SELECT id, email, name, role, branch, created_at
FROM profiles
WHERE lower(email) = 'tcsametsari@gmail.com';

-- Beklenen sonuç:
-- role = admin
-- name = Dt. Resul Yel
-- Eğer sonuç boş geliyorsa auth.users'ta bu e-posta ile bir kullanıcı YOK demektir:
-- Supabase > Authentication > Users > "Add user" ile kullanıcıyı oluştur,
-- sonra bu dosyayı TEKRAR çalıştır.