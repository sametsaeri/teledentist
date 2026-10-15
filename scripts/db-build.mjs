// Tüm migration dosyalarını SIRALI olarak tek bir dosyada birleştirir.
// Çıktı: db/SUPABASE_SETUP.sql  (npm run db:build)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const db = path.join(root, 'db')
const OUT = path.join(db, 'SUPABASE_SETUP.sql')

// SIRA ÖNEMLİ: önce tablolar, sonra roller, sonra fonksiyonlar, en son depolama
const FILES = [
  ['supabase.sql',            '1) Temel şema (profil, diş, triyaj, hijyen, anksiyete, randevu)'],
  ['migration_roles.sql',     '2) Roller (admin/hekim), branş, sevk tablosu'],
  ['migration_signup.sql',    '3) Kayıt istekleri tablosu'],
  ['migration_v2.sql',        '4) Detaylı hasta bilgileri, randevu tarihi/online, bildirim, konsültasyon'],
  ['migration_users.sql',     '5) Kullanıcı adıyla giriş + kayıt kapalıyken hesap açma'],
  ['migration_admin_manage.sql', '6) Süper admin: şifre atama + tüm kullanıcı verisini düzenleme'],
  ['migration_storage.sql',   '7) Röntgen ve fotoğraf depolama (Supabase Storage)'],
  ['setup_status.sql',        '8) Kurulum durumu fonksiyonu (uygulama bunu okur)'],
  ['fix_admin.sql',           '9) Süper admin hesabını admin yapar'],
  ['fix_demo_doctor.sql',     '10) Eski demo hekim kayıtlarını temizler']
]

const banner = `-- ${'='.repeat(64)}
-- TeleDentist — TEK KURULUM DOSYASI (MASTER)
-- Bu dosya TÜM migration'ları doğru sırada birleştirir.
--
-- NASIL ÇALIŞTIRILIR (2 yoldan biri):
--
--   A) Tarayıcıda:
--      Supabase Dashboard > SQL Editor > New query
--      Bu dosyanın TAMAMINI yapıştır > Run
--
--   B) Komutla (SQL yapıştırmadan):
--      .env.local içine SUPABASE_ACCESS_TOKEN ve SUPABASE_PROJECT_REF yaz
--      ardından terminalde:  npm run db:push
--
-- ÖNEMLİ: IDEMPOTENT — defalarca çalıştırılabilir, veri silinmez.
-- Demo hesaplar isterseniz AYRICA db/demo_verisi.sql dosyasını çalıştırın.
-- ${'='.repeat(64)}

`

const missing = FILES.filter(([f]) => !fs.existsSync(path.join(db, f)))
if (missing.length) {
  console.error('Eksik dosyalar:', missing.map(([f]) => f).join(', '))
  process.exit(1)
}

const parts = [banner]
FILES.forEach(([file, title], i) => {
  const body = fs.readFileSync(path.join(db, file), 'utf8')
  parts.push(`\n-- ${'='.repeat(64)}\n-- BÖLÜM ${i + 1}/10: ${title}\n-- Kaynak: db/${file}\n-- ${'='.repeat(64)}\n\n${body.trim()}\n`)
})

fs.writeFileSync(OUT, parts.join(''), 'utf8')
const lines = fs.readFileSync(OUT, 'utf8').split(/\r?\n/).length
console.log(`OK  db/SUPABASE_SETUP.sql  (${FILES.length} bölüm, ${lines} satır)`)
