// db/SUPABASE_SETUP.sql dosyasını Supabase'a TEK KOMUTLA uygular.
//   npm run db:push
//
// Başka bir dosya göndermek için:
//   node scripts/db-push.mjs db/demo_verisi.sql
//
// Gerekli ortam değişkenleri (.env.local veya .env — git'e girmez):
//   SUPABASE_ACCESS_TOKEN = Supabase > Account Preferences > Personal Access Token
//   SUPABASE_PROJECT_REF  = proje referansı (sgvibnunxsmzcjfoxfny)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ---- .env.local / .env oku ----
function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(root, f)
    if (!fs.existsSync(p)) continue
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!m) continue
      const val = m[2].trim().replace(/^["']|["']$/g, '')
      if (!(m[1] in process.env)) process.env[m[1]] = val
    }
  }
}
loadEnv()

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN
const REF = process.env.SUPABASE_PROJECT_REF || 'sgvibnunxsmzcjfoxfny'
const TARGET = process.argv[2] || 'db/SUPABASE_SETUP.sql'
const SQL_FILE = path.resolve(root, TARGET)
if (!fs.existsSync(SQL_FILE)) {
  console.error(`HATA: ${TARGET} bulunamadı.`)
  if (TARGET.endsWith('SUPABASE_SETUP.sql')) console.error('Önce "npm run db:build" çalıştırın.')
  process.exit(1)
}
if (!TOKEN) {
  console.error('HATA: SUPABASE_ACCESS_TOKEN tanımlı değil.')
  console.error('  1) Supabase > Account Preferences > Personal Access Token > Generate New Token')
  console.error('  2) Proje kökünde .env.local dosyasına ekleyin:')
  console.error('     SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxx')
  console.error(`     SUPABASE_PROJECT_REF=${REF}`)
  console.error('  3) Ardından: npm run db:push')
  process.exit(1)
}

const sql = fs.readFileSync(SQL_FILE, 'utf8')
console.log(`Gönderiliyor: db/SUPABASE_SETUP.sql (${sql.split(/\r?\n/).length} satır)`)
console.log(`Proje: ${REF}`)

try {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ query: sql })
  })
  const body = await res.text()

  if (!res.ok) {
    console.error(`\nHATA (HTTP ${res.status}):\n${body.slice(0, 1500)}`)
    process.exit(1)
  }

  console.log('\nBAŞARILI — kurulum tamamlandı.')
  try {
    const parsed = JSON.parse(body)
    if (Array.isArray(parsed) && parsed[0]) console.log(JSON.stringify(parsed[0]).slice(0, 800))
  } catch { /* sonuç JSON değilse sorun yok */ }
  console.log('\nŞimdi tarayıcıda /admin > Genel > Sistem Durumu kartına bakabilirsiniz.')
} catch (e) {
  console.error('Bağlantı hatası:', e.message)
  process.exit(1)
}
