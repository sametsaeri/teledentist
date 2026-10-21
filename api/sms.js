// Vercel Serverless Function — SMS Gönderimi (Twilio)
// Ortam değişkenleri: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { to, message } = req.body || {}
  if (!to || !message) return res.status(400).json({ error: 'to ve message zorunlu' })

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER

  if (!sid || !token || !from) {
    // Servis yapılandırılmamış — yalnızca kuyruğa al
    console.log('[SMS KUYRUK]', to, message)
    return res.status(200).json({ ok: true, queued: true, message: 'SMS servisi yapılandırılmamış, kuyruğa alındı' })
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
    if (!resp.ok) return res.status(resp.status).json({ error: data.message || 'SMS gönderilemedi' })
    return res.status(200).json({ ok: true, sid: data.sid })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
