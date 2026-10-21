// E-posta Servisi — Vercel Serverless Function üzerinden e-posta gönderir
// Ortam değişkenleri (Vercel):
//   RESEND_API_KEY  — Resend hesabı anahtarı (ücretsiz tier: 3.000/ay)
//   EMAIL_FROM      — Gönderici adresi (Resend doğrulaması yapılmış alan adı)
// Servis yapılandırılmamışsa /api/email kuyruğa alır; istekler asla kaybolmaz.
export async function mailGonder(to, subject, text) {
  if (!to || !subject || !text) return { error: 'Alıcı, konu ve içerik zorunlu.' }
  try {
    const resp = await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, text })
    })
    const data = await resp.json()
    if (!resp.ok) return { error: data.error || 'E-posta gönderilemedi.' }
    return { ok: true, ...data }
  } catch (e) {
    return { error: 'E-posta servisine ulaşılamadı: ' + (e?.message || 'bilinmeyen hata') }
  }
}

/* ---------------------------------------------------------------
 * Şablonlar — SMS şablonları sms.js içinde, e-posta içerikleri burada
 * ------------------------------------------------------------- */

export function hesapAcildiMail(patientName, email, hekimAdi) {
  return {
    subject: 'TeleDentist — Hesabınız açıldı',
    text: `Merhaba ${patientName},

TeleDentist hesabınız oluşturuldu.

Giriş e-postanız: ${email}
Geçici şifrenizi hekiminizden (${hekimAdi || 'hekiminiz'}) alabilirsiniz.

İlk girişinizde "Ön Değerlendirme Formu" otomatik olarak açılacaktır.

Kolaylıklar dileriz.
— TeleDentist (KTÜ Diş Hekimliği)`
  }
}

export function randevuOnayMail(patientName, date, online) {
  return {
    subject: 'TeleDentist — Randevunuz onaylandı',
    text: `Merhaba ${patientName},

${date} tarihindeki randevunuz onaylandı (${online ? 'online görüşme' : 'klinik muayene'}).

Randevu gününüzde size hatırlatma yapılacaktır.

— TeleDentist`
  }
}

export function gorusmeTalebiMail(patientName, hekimAdi) {
  return {
    subject: 'TeleDentist — Görüşme talebi',
    text: `Merhaba ${patientName},

${hekimAdi || 'Hekiminiz'} sizi görüntülü görüşmeye davet etti.
Panelinize giriş yapıp "Görüşme" bildirimine tıklayarak katılabilirsiniz.

— TeleDentist`
  }
}
