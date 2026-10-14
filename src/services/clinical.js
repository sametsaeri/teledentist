// Diş hekimliğine özel klinik skorlar (yalnızca dental kapsam)
export function triageScore({ pain, swelling, trauma, bleeding, fever }) {
  let s = Number(pain) || 0
  if (swelling) s += 3
  if (trauma) s += 4
  if (bleeding) s += 2
  if (fever) s += 2
  const level = s >= 10 ? 'Acil - 24 saat' : s >= 6 ? 'Öncelikli - 3 gün' : 'Rutin - 2 hafta'
  return { score: s, level }
}

export function anxietyLevel(total) {
  if (total >= 19) return 'Yüksek anksiyete - hekim bilgilendirildi'
  if (total >= 12) return 'Orta anksiyete - sakinleştirici yaklaşım'
  return 'Düşük anksiyete'
}

export function hygieneTip(plaque, brushPerDay) {
  if (plaque >= 2) return 'Plak yüksek: günde 2 fırça + arayüz fırçası + 3 ay kontrol.'
  if (brushPerDay < 2) return 'Fırçalama artırılmalı: günde 2 kez 2 dakika.'
  return 'Hijyen iyi: mevcut rutini sürdürün.'
}
