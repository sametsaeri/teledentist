-- ============================================================
-- TeleDentist — SÜPER ADMIN ŞİFRE ATAMA
-- Supabase > SQL Editor'de çalıştırın. IDEMPOTENT, veri silinmez.
-- Yaptığı: seçilen kullanıcının şifresini süper admin belirler
--           ve o kullanıcının açık oturumlarını kapatır.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.admin_set_password(p_user_id uuid, p_new_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_email text;
BEGIN
  -- Yalnızca süper admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Yetkisiz islem';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Kullanici secilmedi';
  END IF;

  IF coalesce(length(p_new_password),0) < 6 THEN
    RAISE EXCEPTION 'Sifre en az 6 karakter olmali';
  END IF;

  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Kullanici bulunamadi';
  END IF;

  -- Şifreyi bcrypt ile yaz
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = p_user_id;

  -- Eski oturumları kapat: yeni şifreyle giriş zorunlu olsun
  BEGIN
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
  EXCEPTION WHEN others THEN
    NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'email', v_email);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_password(uuid, text) TO authenticated;

-- ---------- Kontrol ----------
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('admin_set_password','create_account','resolve_login_id','is_admin','is_hekim')
ORDER BY p.proname;
