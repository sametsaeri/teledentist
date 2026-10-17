-- ============================================================
-- TeleDentist — KULLANICI ADI DÜZELTME (ACİL)
--
-- SORUN: "Bu kullanıcı adı bulunamadı" hatası alınıyor, ANCAK hesap
-- veritabanında mevcut.
--
-- KÖK NEDEN: Giriş ekranı kullanıcı adını (örn. "hastakayit1") sorar.
-- Sunucudaki resolve_login_id() fonksiyonu profildeki `username`
-- kolonuna bakar. Bu kolon, hesaplar OLUŞTURULURKEN yazılmadığı için
-- BOŞTUR. Fonksiyon boş değer bulur ve "bulunamadı" der.
--
-- Bu dosya iki şeyi yapar:
--   1) `username` kolonu yoksa oluşturur
--   2) Boş username'leri e-postadan türetir
--
-- GÜVENLİ: Veri SİLMEZ. Yalnız boş alanları doldurur.
-- TEKRAR ÇALIŞTIRILABİLİR (idempotent).
--
-- ÇALIŞTIRMA: Supabase Dashboard → SQL Editor → yapıştır → Run
-- ============================================================


-- ---------- ADIM 1: username kolonu var mı? ----------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT;


-- ---------- ADIM 2: Boş olanları e-postadan türet ----------
-- "hastakayit1@ornek.com" → "hastakayit1"
-- Türkçe karakterler temizlenir; benzersizlik çakışırsa sonuna sayı eklenir.
UPDATE profiles p
SET username = COALESCE(
  NULLIF(
    regexp_replace(
      lower(split_part(p.email, '@', 1)),
      '[^a-z0-9._-]', '', 'g'
    ),
    ''
  ),
  'hasta'
) || CASE
       -- Aynı ada sahip başka bir profil varsa ayırıcı ekle
       WHEN EXISTS (
         SELECT 1 FROM profiles o
         WHERE o.id <> p.id
           AND o.username = regexp_replace(lower(split_part(p.email, '@', 1)), '[^a-z0-9._-]', '', 'g')
       ) THEN '_' || substr(md5(p.id::text), 1, 4)
       ELSE ''
     END
WHERE p.email IS NOT NULL
  AND (p.username IS NULL OR p.username = '');


-- ---------- ADIM 3: Aynı username'in iki kez kullanılmasını engelle ----------
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON profiles (username)
  WHERE username IS NOT NULL AND username <> '';


-- ---------- ADIM 4: Kullanıcı adıyla giriş fonksiyonu ----------
-- Bu fonksiyon YOKSA giriş hiç çalışmaz. Oluşturulur.
-- (Önceki sürümlerde bu fonksiyon kurulmadıysa "bulunamadı" hatası veriyordu.)
CREATE OR REPLACE FUNCTION public.resolve_login_id(p_identifier text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER          -- RLS'i atlar; anonim kullanıcı da çağırabilir
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF p_identifier IS NULL OR trim(p_identifier) = '' THEN
    RETURN NULL;
  END IF;

  -- Kullanıcı adı, e-posta veya ad ile eşleşme dene
  SELECT lower(p.email) INTO v_email
  FROM profiles p
  WHERE lower(p.username) = lower(trim(p_identifier))
     OR lower(p.email)    = lower(trim(p_identifier))
     OR lower(p.name)     = lower(trim(p_identifier))
  LIMIT 1;

  RETURN v_email;   -- bulunamazsa NULL döner; uygulama anlaşılır hata verir
END;
$$;

-- Anonim (giriş ekranı) ve giriş yapmış kullanıcılar çağırabilsin
GRANT EXECUTE ON FUNCTION public.resolve_login_id(text) TO anon, authenticated;


-- ============================================================
-- DOĞRULAMA (isteğe bağlı)
--
-- Aşağıdaki sorguyu çalıştırıp sonucu kontrol edin:
--
--   SELECT email, username FROM profiles
--   WHERE username IS NULL OR username = '';
--
-- Sonuç BOŞ gelmelidir. Dolu satır varsa o hesaplar e-posta içermiyor
-- demektir; hekiminizden o hesaplar için e-posta bilgisi alın.
--
-- resolve_login_id çalışıyor mu?
--
--   SELECT public.resolve_login_id('hastakayit1');
--
-- E-posta adresi dönmelidir. NULL dönüyorsa profilin username'i hâlâ boş.
-- ============================================================