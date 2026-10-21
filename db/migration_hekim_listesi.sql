-- ==========================================================================
-- Hasta görüşme akışı: hasta hekim listesini görebilmeli
-- ==========================================================================
-- SORUN: profiles SELECT politikası "id = auth.uid() OR is_hekim()" olduğu için
-- hasta yalnız kendi kaydını okur; listDoctors() boş döner ve "Hekimimle
-- Görüşme Talebi" kartında hekim seçilemez ("kullanıcı tanımlı değil" hatası).
--
-- ÇÖZÜM: SECURITY DEFINER fonksiyon hekimlerin GENEL bilgilerini (id, ad,
-- branş) döner. E-posta, TC, telefon gibi özel veriler AÇILMAZ.
-- Idempotent: defalarca çalıştırılabilir.
-- ==========================================================================

DROP FUNCTION IF EXISTS hastaya_hekim_listesi();
CREATE FUNCTION hastaya_hekim_listesi()
RETURNS TABLE (id uuid, name text, branch text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.name, COALESCE(p.branch, 'genel')
  FROM profiles p
  WHERE p.role = 'hekim'
  ORDER BY p.name
$$;

GRANT EXECUTE ON FUNCTION hastaya_hekim_listesi() TO anon, authenticated;
