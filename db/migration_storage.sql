-- ============================================================
-- Röntgen ve fotoğraf depolama (Supabase Storage)
-- Dosya yolu: <hasta_id>/<diş_no>-<zaman>.png
-- Hasta yalnızca kendi klasörüne, hekim/admin tüm klasörlere erişir.
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('xrays', 'xrays', false, 10485760)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 10485760;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('photos', 'photos', false, 10485760)
ON CONFLICT (id) DO UPDATE SET file_size_limit = 10485760;

-- ---- RÖNTGEN ----
DROP POLICY IF EXISTS "xrays_read" ON storage.objects;
CREATE POLICY "xrays_read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'xrays'
    AND ( auth.uid()::text = (storage.foldername(name))[1] OR public.is_hekim() OR public.is_admin() )
  );

DROP POLICY IF EXISTS "xrays_write" ON storage.objects;
CREATE POLICY "xrays_write" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'xrays'
    AND ( auth.uid()::text = (storage.foldername(name))[1] OR public.is_hekim() OR public.is_admin() )
  );

DROP POLICY IF EXISTS "xrays_update" ON storage.objects;
CREATE POLICY "xrays_update" ON storage.objects FOR UPDATE
  USING ( bucket_id = 'xrays' AND (public.is_hekim() OR public.is_admin()) )
  WITH CHECK ( bucket_id = 'xrays' AND (public.is_hekim() OR public.is_admin()) );

DROP POLICY IF EXISTS "xrays_delete" ON storage.objects;
CREATE POLICY "xrays_delete" ON storage.objects FOR DELETE
  USING ( bucket_id = 'xrays' AND (public.is_hekim() OR public.is_admin()) );

-- ---- FOTOĞRAF ----
DROP POLICY IF EXISTS "photos_read" ON storage.objects;
CREATE POLICY "photos_read" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'photos'
    AND ( auth.uid()::text = (storage.foldername(name))[1] OR public.is_hekim() OR public.is_admin() )
  );

DROP POLICY IF EXISTS "photos_write" ON storage.objects;
CREATE POLICY "photos_write" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'photos'
    AND ( auth.uid()::text = (storage.foldername(name))[1] OR public.is_hekim() OR public.is_admin() )
  );

DROP POLICY IF EXISTS "photos_delete" ON storage.objects;
CREATE POLICY "photos_delete" ON storage.objects FOR DELETE
  USING ( bucket_id = 'photos' AND (public.is_hekim() OR public.is_admin()) );