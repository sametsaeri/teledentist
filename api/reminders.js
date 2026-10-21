// Vercel Cron — Yaklaşan Randevu Hatırlatması
// vercel.json -> crons: [{ "path": "/api/reminders", "schedule": "0 9 * * *" }]
// Akış: (1) DB'den yaklaşan onaylı randevular okunur, (2) hasta için bildirim
// satırı yazılır (aynı randevu için tekrar yazmaz), (3) Twilio anahtarları
// tanımlıysa SMS gönderilir, değilsa kuyruk logu düşer ve hata dönmez.
import { createClient } from '@supabase/supabase-js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function supabaseAdminUrl() {
  return process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || null
}
function supabaseAdminKey() {
  return process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || null
}

async function smsSend(to, message) {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  if (!sid || !token || !from) {
    console.log('[SMS KUYRUK]', to, message)
    return { ok: true, queued: true }
  }
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`
    const body = new URLSearchParams({ To: to, From: from, Body: message })
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    })
    const data = await resp.json()
    return resp.ok ? { ok: true, sid: data.sid } : { ok: false, error: data.message }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

export default async function handler(req, res) {
  const url = supabaseAdminUrl()
  const key = supabaseAdminKey()
  if (!url || !key) return res.status(200).json({ ok: false, reason: 'Supabase ortam değişkenleri eksik' })

  const db = createClient(url, key)
  const bugun = new Date()
  const site = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate())

  let appts, aerr
  try {
    const r = await db.from('appointments')
      .select('id, name, contact, patient_id, doctor_id, appt_date, appt_time, status, is_online, complaint')
      .neq('status', 'tamamlandı')
      .not('appt_date', 'is', null)
      .order('appt_date', { ascending: true })
      .limit(200)
    appts = r.data
    aerr = r.error
  } catch (e) {
    aerr = e.message
  }
  if (aerr) return res.status(200).json({ ok: false, reason: 'Randevular okunamadı', error: String(aerr) })

  const YAKINSAMA_GUN = 3 // kaç gün önceden hatırlatılsın
  const uretilen = []
  const atlanan = []

  for (const a of (appts || [])) {
    const tarih = new Date(String(a.appt_date).slice(0, 10))
    if (Number.isNaN(tarih.getTime())) continue
    const left = Math.ceil((tarih - site) / 86400000)
    if (left < 0 || left > YAKINSAMA_GUN) continue // geçmiş veya uzağında

    const gunMetni = left === 0 ? 'BUGÜN' : `${left} gün sonra`
    const title = `Randevu hatırlatması — ${a.name} ${a.appt_date}`
    // Aynı randevu için ikinci bildirim yazılmaz (günlük cron güvenli tekrar)
    const { data: mevcut } = await db.from('notifications').select('id').eq('kind', 'randevu_hatirlatma').eq('title', title).limit(1)
    if (mevcut && mevcut.length) { atlanan.push(a.id); continue }

    const body = `${gunMetni} (${String(a.appt_date).slice(0, 10)}${a.appt_time ? ` ${a.appt_time}` : ''}) hastanızı hatırlatın.`.trim()
    const hastaBildirim = {
      doctor_id: a.doctor_id || null,
      patient_id: a.patient_id && UUID_RE.test(String(a.patient_id)) ? a.patient_id : null,
      kind: 'randevu_hatirlatma',
      title,
      body: `${a.appt_date}${a.appt_time ? ` · ${a.appt_time}` : ''} randevunuz — lütfen zamanında gelin.`,
      link: '/hastam',
      onem: 'yuksek',
      status: 'bekliyor',
      created_at: new Date().toISOString()
    }
    await db.from('notifications').insert(hastaBildirim)
    uretilen.push(title)

    // SMS: "contact" alanı telefonnumarası görünümündeyse gönder
    const tel = String(a.contact || '').replace(/[^\d+]/g, '')
    if (tel.replace(/\D/g, '').length >= 10) {
      await smsSend(tel, `TeleDentist hatırlatma: ${a.appt_date}${a.appt_time ? ` ${a.appt_time}` : ''} randevunuz var. ${a.is_online ? 'R online görüşme' : 'Klinik'} için bekleriz.`)
    }
  }

  return res.status(200).json({ ok: true, tarih: site.toISOString().slice(0, 10), toplam: appts?.length || 0, uretilen, atlanan: atlanan.length })
}
