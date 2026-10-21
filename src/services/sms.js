// SMS Servisi — Vercel Serverless Function üzerinden SMS gönderir
// Ortam değişkenleri (Vercel): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
export async function smsGonder(to, message) {
  if (!to || !message) return { error: 'Telefon ve mesaj zorunlu.' }
  // Telefon numarasını temizle (boşluk, tire vb.)
  const temizTel = String(to).replace(/[\s\-()]/g, '')
  if (temizTel.length < 10) return { error: 'Geçersiz telefon numarası.' }
  try {
    const resp = await fetch('/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: temizTel, message })
    })
    const data = await resp.json()
    if (!resp.ok) return { error: data.error || 'SMS gönderilemedi.' }
    return { ok: true, ...data }
  } catch (e) {
    return { error: 'SMS servisine ulaşılamadı: ' + (e?.message || 'bilinmeyen hata') }
  }
}

// Randevu hatırlatması SMS'i
export function randevuHatirlatmaSms(patientName, date, time, online) {
  return smsGonder(null, '') // placeholder - called with actual phone
}

// Randevu onay SMS mesajı şablonu
export function randevuOnayMesaji(patientName, date, time, online) {
  return `${patientName}, randevunuz ${date} ${time || ''} tarihinde ${online ? 'online görüşme' : 'klinikte'} onaylandı. TeleDentist`
}

// Kontrol hatırlatması SMS mesajı şablonu
export function kontrolHatirlatmaMesaji(patientName, date) {
  return `${patientName}, ${date} tarihinde kontrol randevunuz var. TeleDentist`
}
