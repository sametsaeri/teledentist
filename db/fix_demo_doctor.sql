-- ============================================================
-- Demo hekim temizliği + "Dt. Resul Yel" birleştirme
-- Bu dosya veri SİLMEZ, yalnızca isim/rol düzeltir.
-- ============================================================

-- 1) "Demo" içeren hekim kayıtlarını gerçek isme çevir
UPDATE profiles
SET name = 'Resul Yel'
WHERE role IN ('hekim','admin')
  AND (lower(name) LIKE '%demo%' OR lower(email) LIKE '%demo%')
  AND lower(email) <> 'tcsametsari@gmail.com';

-- 2) Başında zaten "Dt." geçen kayıtları temizle
--    (arayüz "Dt." önekini kendisi ekliyor, çift görünmesin)
UPDATE profiles
SET name = ltrim(regexp_replace(name, '^\s*Dt\.?\s+', '', 'i'))
WHERE name ~* '^\s*Dt\.?\s';

-- 3) Süper admin
UPDATE profiles SET role = 'admin', name = 'Resul Yel'
WHERE lower(email) = 'tcsametsari@gmail.com';

-- 4) Kontrol: tüm hekim ve adminler
SELECT id, email, name, role, branch
FROM profiles
WHERE role IN ('hekim','admin')
ORDER BY role, name;