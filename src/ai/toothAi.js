// Diş bazlı AI destekli bilgilendirme taslağı (kural tabanlı, Faz 2'de öğrenecek)
// Doktor notu birincil kaynaktır, AI sadece eğitim metni üretir.
export function toothEducation(toothNo, status) {
  const isMolar = [16,17,18,26,27,28,36,37,38,46,47,48].includes(Number(toothNo))
  const base = {
    saglam: 'Bu diş sağlıklı görünüyor. Günde 2 kez fırçalama ve diş ipi önerilir.',
    dolgu: 'Dolgulu dişlerde ilk hafta aşırı sıcak-soğuk ve sertten kaçının. Sızlama 2 haftadan uzun sürerse hekime bildirin.',
    kanal: 'Kanal tedavili diş kırılgandır. Kaplama ile koruma ve 3 ayda bir kontrol önerilir.',
    kaplama: 'Kaplama kenarlarında plak birikir. Arayüz fırçası kullanın.',
    takip: 'Takipteki dişte ağrı, şişlik veya hassasiyet olursa randevuyu öne alın.',
    cekim: 'Çekim bölgesi iyileşene kadar o taraf ile çiğnemeyin.',
    implant: 'İmplant çevresi hijyen kritiktir. 6 ayda bir profesyonel temizlik önerilir.'
  }
  const molarNote = isMolar ? ' Azı dişleri çiğneme yükünü taşır, kontrol aksatılmamalı.' : ''
  return (base[status] || base.takip) + molarNote
}

export function recallForTooth(status) {
  if (status === 'kanal' || status === 'takip') return '3 ay sonra kontrol'
  if (status === 'dolgu' || status === 'kaplama' || status === 'implant') return '6 ay sonra kontrol'
  return '12 ay sonra rutin kontrol'
}
