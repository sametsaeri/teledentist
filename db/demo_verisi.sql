-- ============================================================
-- TeleDentist — DEMO VERİSİ (tek çalıştırma, IDEMPOTENT)
-- Supabase > SQL Editor'de çalıştırın.
-- Oluşturur:
--   • Demo hasta   : demo.hasta@teledentist.com   / Demo1234
--   • Demo ebeveyn : demo.ebeveyn@teledentist.com / Demo1234
--   • Demo hekim   : demo.hekim@teledentist.com   / Demo1234
--   • Demo diş kayıtları, triyaj, hijyen, anksiyete ve randevu
-- Var olan veri silinmez; aynı e-postalar varsa üzerine yazılır.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ------------------------------------------------------------
-- 1) Demo hasta
-- ------------------------------------------------------------
DO $$
DECLARE
  v_uid uuid;
  v_email text := 'demo.hasta@teledentist.com';
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = v_email;
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated', v_email,
      extensions.crypt('Demo1234', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    );
  END IF;

  -- Çekirdek profil (temel şemada var olan kolonlar)
  INSERT INTO public.profiles (
    id, role, email, name, last_visit, treatment_type, plaque_index, anxiety_score
  ) VALUES (
    v_uid, 'hasta', v_email, 'Demo Hasta',
    CURRENT_DATE - 180, 'kontrol', 1.8, 2
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    last_visit = EXCLUDED.last_visit,
    treatment_type = EXCLUDED.treatment_type,
    plaque_index = EXCLUDED.plaque_index,
    anxiety_score = EXCLUDED.anxiety_score;

  -- Detaylı alanlar (migration_v2 kolonları)
  BEGIN
    UPDATE public.profiles SET
      username = 'demohasta',
      branch = 'genel',
      reminder_days = 7,
      tc_no = '12345678901',
      birth_date = '1995-05-12',
      gender = 'Kadın',
      phone = '0555 111 22 33',
      address = 'Örnek Mahalle, Demo Sokak No:1 D:4',
      city = 'Trabzon',
      district = 'Ortahisar',
      blood = 'A Rh+',
      insurance = 'SGK',
      school = 'KTÜ',
      occupation = 'Öğrenci',
      near_name = 'Demo Veli',
      near_phone = '0555 999 88 77',
      near_relation = 'Anne',
      note = 'Demo kayıt — TÜBİTAK sunumu için.'
    WHERE id = v_uid;
  EXCEPTION WHEN undefined_column THEN
    NULL; -- migration_v2 çalışmamışsa çekirdek bilgilerle devam
  END;
END $$;

-- ------------------------------------------------------------
-- 2) Demo ebeveyn
-- ------------------------------------------------------------
DO $$
DECLARE
  v_uid uuid;
  v_email text := 'demo.ebeveyn@teledentist.com';
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = v_email;
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated', v_email,
      extensions.crypt('Demo1234', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    );
  END IF;

  INSERT INTO public.profiles (
    id, role, email, name, last_visit, treatment_type, plaque_index, anxiety_score
  ) VALUES (
    v_uid, 'ebeveyn', v_email, 'Demo Ebeveyn',
    CURRENT_DATE - 180, 'kontrol', 1, 3
  )
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

  BEGIN
    UPDATE public.profiles SET
      username = 'demoebeveyn', branch = 'genel', reminder_days = 7,
      tc_no = '12345678902', gender = 'Kadın',
      phone = '0555 999 88 77', city = 'Trabzon', district = 'Ortahisar',
      near_name = 'Demo Veli', near_relation = 'Anne'
    WHERE id = v_uid;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;
END $$;

-- ------------------------------------------------------------
-- 3) Demo hekim
-- ------------------------------------------------------------
DO $$
DECLARE
  v_uid uuid;
  v_email text := 'demo.hekim@teledentist.com';
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = v_email;
  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_uid,
      'authenticated', 'authenticated', v_email,
      extensions.crypt('Demo1234', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    );
  END IF;

  INSERT INTO public.profiles (
    id, role, email, name, last_visit, treatment_type, plaque_index, anxiety_score
  ) VALUES (
    v_uid, 'hekim', v_email, 'Demo Hekim',
    CURRENT_DATE, 'kontrol', 1, 1
  )
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

  BEGIN
    UPDATE public.profiles SET
      username = 'demohekim', branch = 'endodonti', reminder_days = 5
    WHERE id = v_uid;
  EXCEPTION WHEN undefined_column THEN
    NULL;
  END;
END $$;

-- ------------------------------------------------------------
-- 4) Ebeveyn → çocuk bağlantısı
-- ------------------------------------------------------------
DO $$
DECLARE
  v_parent uuid;
  v_child  uuid;
BEGIN
  SELECT id INTO v_parent FROM public.profiles WHERE lower(email) = 'demo.ebeveyn@teledentist.com';
  SELECT id INTO v_child  FROM public.profiles WHERE lower(email) = 'demo.hasta@teledentist.com';
  IF v_parent IS NOT NULL AND v_child IS NOT NULL THEN
    INSERT INTO public.parent_child (parent_id, child_id)
    VALUES (v_parent, v_child)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5) Demo hasta için diş, triyaj, hijyen ve anksiyete kayıtları
-- ------------------------------------------------------------
DO $$
DECLARE
  v_patient uuid;
BEGIN
  SELECT id INTO v_patient FROM public.profiles WHERE lower(email) = 'demo.hasta@teledentist.com';
  IF v_patient IS NULL THEN RETURN; END IF;

  -- Diş haritası
  INSERT INTO public.teeth (patient_id, fdi, status, treatment, doctor_note) VALUES
    (v_patient, 16, 'dolgu',      'Kompozit dolgu',       'Üst sağ birinci büyük azı - 2024 dolgusu'),
    (v_patient, 26, 'kanal',      'Kanal tedavisi',       'Kanal tedavisi tamamlandı, takip gerekli'),
    (v_patient, 36, 'saglam',     '-',                    ''),
    (v_patient, 46, 'eksik',      'İmplant önerisi',      'Kök kanal tedavisi sonrası değerlendirilecek')
  ON CONFLICT (patient_id, fdi) DO UPDATE SET
    status = EXCLUDED.status,
    treatment = EXCLUDED.treatment,
    doctor_note = EXCLUDED.doctor_note;

  -- Triyaj
  IF NOT EXISTS (SELECT 1 FROM public.triage WHERE patient_id = v_patient) THEN
    INSERT INTO public.triage (patient_id, tooth, pain, swelling, trauma, bleeding, fever, score, level)
    VALUES (v_patient, '26', 4, false, false, true, false, 20, 'orta');
  END IF;

  -- Hijyen
  IF NOT EXISTS (SELECT 1 FROM public.hygiene WHERE patient_id = v_patient) THEN
    INSERT INTO public.hygiene (patient_id, plaque, brush, hdate)
    VALUES (v_patient, 1.8, 2, CURRENT_DATE - 30);
  END IF;

  -- Anksiyete
  IF NOT EXISTS (SELECT 1 FROM public.anxiety WHERE patient_id = v_patient) THEN
    INSERT INTO public.anxiety (patient_id, total, adate)
    VALUES (v_patient, 2, CURRENT_DATE - 30);
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6) Demo randevu talepleri
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.appointments WHERE contact = '0555 111 22 33') THEN
    INSERT INTO public.appointments (name, contact, dept, complaint, status)
    VALUES ('Demo Hasta', '0555 111 22 33', 'endodonti',
            'Sağ üst çenemde ağrı ve hassasiyet var, 3 gündür artıyor.', 'yeni');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.appointments WHERE contact = '0555 444 55 66') THEN
    INSERT INTO public.appointments (name, contact, dept, complaint, status)
    VALUES ('Demo Ebeveyn', '0555 444 55 66', 'pedodonti',
            'Online görüşme ile çocuğumun diş temizliği konusunda bilgi almak istiyorum.', 'yeni');
  END IF;
END $$;

-- ------------------------------------------------------------
-- 7) Kontrol
-- ------------------------------------------------------------
SELECT id, email, username, name, role, branch, phone, city
FROM public.profiles
ORDER BY role, name;
