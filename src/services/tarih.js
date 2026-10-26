// Randevu tarih yardımcıları — saf fonksiyonlar, test edilebilir.
// Klinik hafta içi 08:30-17:30 çalışır; Cumartesi/Pazar randevu verilmez.

/** Tarih hafta içi mi? (Pazar=0, Cumartesi=6 hariç) */
export function isGunuMu(d) {
  const gun = d.getDay()
  return gun !== 0 && gun !== 6
}

/** YYYY-MM-AA biçimli metin */
function gunMetni(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const g = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${g}`
}

/**
 * Bugünden itibaren ilk uygun iş günü (yarın hafta sonuna denk gelirse sonraki
 * hafta içi gün döner). Hastanın randevu talep formunda varsayılan tarih.
 */
export function otomatikRandevuGunu(from = new Date()) {
  const d = new Date(from)
  d.setDate(d.getDate() + 1)
  while (!isGunuMu(d)) d.setDate(d.getDate() + 1)
  return gunMetni(d)
}

/**
 * Mevcut dolu randevu günlerini atlayarak ilk boş iş gününü bulur.
 * Hekim "otomatik onayla" akışında çakışmasız randevu ataması için.
 * Sonsuz döngüye karşı 60 gün üst sınır (2 ay) tanır.
 */
export function sonrakiBosGun(doluGunler = new Set(), from = new Date()) {
  const d = new Date(from)
  for (let adim = 0; adim < 60; adim++) {
    d.setDate(d.getDate() + 1)
    if (!isGunuMu(d)) continue
    const metin = gunMetni(d)
    if (!doluGunler.has(metin)) return metin
  }
  // 60 gün dolu görünüyorsa (normalde imkânsız) son başvuru: ilk iş günü
  return otomatikRandevuGunu(from)
}
