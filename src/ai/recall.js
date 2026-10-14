// FAZ 3 hazırlığı: kural tabanlı recall motoru (TÜBİTAK Faz 2'de ML'e evrilecek)
// Girdi: son muayene tarihi, tedavi tipi, risk skoru
export function suggestRecall({ lastVisit, treatmentType, plaqueIndex, anxietyScore }) {
  let months = 6 // varsayılan
  if (plaqueIndex >= 2 || anxietyScore >= 7) months = 3
  else if (plaqueIndex < 1 && (treatmentType === 'dolgu' || treatmentType === 'kontrol')) months = 12

  const next = new Date(lastVisit)
  next.setMonth(next.getMonth() + months)
  return {
    months,
    nextVisit: next.toISOString().slice(0, 10),
    reason: months === 3 ? 'Yüksek risk: sık takip' : months === 12 ? 'Düşük risk: yıllık kontrol' : 'Standart takip'
  }
}
