// Vercel Serverless Function — E-posta Gönderimi (Resend)
// Ortam değişkenleri: RESEND_API_KEY, EMAIL_FROM
// Ücretsiz tier ile başlamak için: resend.com → anahtar al → Vercel'e ekle.
// Anahtar yoksa istek kuyruğa alınır (loglanır); hata dönmez, akışlar kırılmaz.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { to, subject, text } = req.body || {}
  if (!to || !subject || !text) return res.status(400).json({ error: 'to, subject ve text zorunlu' })

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || 'TeleDentist <onboarding@resend.dev>'

  if (!apiKey) {
    // Servis yapılandırılmamış — yalnız kuyruğa al
    console.log('[E-POSTA KUYRUK]', to, '|', subject, '|', text.slice(0, 120))
    return res.status(200).json({ ok: true, queued: true, message: 'E-posta servisi yapılandırılmamış, kuyruğa alındı' })
  }

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ from, to: [to], subject, text })
    })
    const data = await resp.json()
    if (!resp.ok) return res.status(resp.status).json({ error: data.message || 'E-posta gönderilemedi' })
    return res.status(200).json({ ok: true, id: data.id })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
