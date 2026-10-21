// SMS Servisi — Vercel Serverless Function üzerinden SMS gönderir
// Ortam değişkenleri (Vercel): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER
// Servis yapılandırılmamışsa /api/sms kuyruğa alır; istekler asla kaybolmaz.
export async function smsGonder(to, message) {
  if (!to || !message) return { error: 'Telefon ve mesaj zorunlu.' }
  // Telefon numarasını temizle (boşluk, tire vb.)
  const temizTel = String(to).replace(/[\s\-()]/g, '')
  if (temizTel.replace(/\D/g, '').length < 10) return { error: 'Geçersiz telefon numarası.' }
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

/** Telefon alanı SMS gönderilebilir görünüyor mu? (en az 10 rakam) */
export function smsTelefonUygun(metin) {
  const t = String(metin || '').replace(/[^\d]/g, '')
  return t.length >= 10
}

/* ---------------------------------------------------------------
 * Şablonlar — hem SMS hem e-posta için tek kaynak
 * ------------------------------------------------------------- */

/** Randevu talebi alındı onayı (hastaya) */
export function talepAlindiMesaji(patientName) {
  return `TeleDentist: ${patientName}, randevu talebiniz alındı. Hekiminiz onaylayınca bilgilendirileceksiniz.`
}

/** Randevu onay mesajı (hastaya) */
export function randevuOnayMesaji(patientName, date, time, online) {
  return `${patientName}, randevunuz ${date} ${time || ''} tarihinde ${online ? 'online görüşme' : 'klinikte'} onaylandı. TeleDentist`
}

/** Kontrol hatırlatması mesajı */
export function kontrolHatirlatmaMesaji(patientName, date) {
  return `${patientName}, ${date} tarihinde kontrol randevunuz var. TeleDentist`
}

/** Hasta hesabı açıldı (hastaya — şifre SMS'e yazılmaz, hekim iletir) */
export function hesapAcildiMesaji(patientName, email) {
  return `TeleDentist: ${patientName}, hesabınız açıldı. Giriş e-postanız: ${email}. Geçici şifrenizi hekiminizden alın.`
}

/** Görüşme daveti / talebi (SMS yedeği) */
export function gorusmeDavetiMesaji(digerTaraf, isteyen) {
  return `TeleDentist: ${digerTaraf}, ${isteyen} görüntülü görüşme talep etti. Panelinize giriş yapıp katılın.`
}
