// FDI diş numaralarının Türkçe adları, tipleri ve bölge bilgisi.
// Hem hasta panelindeki 3D diş görünümü hem hekim panelindeki
// diş editörü bu veriyi kullanır.

export const CEYRE = {
  1: { yon: 'sağ', cene: 'üst', kisa: 'Sağ Üst' },
  2: { yon: 'sol', cene: 'üst', kisa: 'Sol Üst' },
  3: { yon: 'sol', cene: 'alt', kisa: 'Sol Alt' },
  4: { yon: 'sağ', cene: 'alt', kisa: 'Sağ Alt' }
}

/** Diş tipi: şekil, eğitim metni ve yüzey bilgisi buradan gelir */
export const TIP = {
  kesici: {
    ad: 'Kesici Diş',
    ikon: 'kesici',
    // Ön dişler: gülüş hattı, estetik bölge
    yuzey: ['Dış (labial)', 'İç (lingual)', 'Kesici kenar', 'Bitişik yüzey'],
    egitim: 'Kesici dişler gülüş hattını belirler. Kesici kenarda kırık olursa görsel olarak rahatsız edicidir, hemen müdahale gerekir.',
    bakim: 'Günde iki kez fırçalama, diş ipi ve yılda bir kontrol önerilir.'
  },
  kanin: {
    ad: 'Köpek Dişi',
    ikon: 'kanin',
    yuzey: ['Dış (labial)', 'İç (lingual)', 'Tepe ucu', 'Bitişik yüzey'],
    egitim: 'Köpek dişleri en uzun kökleriyle en sağlam dişlerdir. Diş eti sarkmalarının ilk belirtisi genellikle köpek dişlerinin uzamasıdır.',
    bakim: 'Köpek dişlerinin arkası diş ipi için en zor bölgedir; mutlaka temizlenmelidir.'
  },
  kucukAzi: {
    ad: 'Küçük Azı (Sıra Dişi)',
    ikon: 'kucukazi',
    yuzey: ['Çiğneme yüzeyi', 'Dış (bukkal)', 'İç (lingual)', 'Bitişik yüzey'],
    egitim: 'Küçük azılar iki köşelidir ve çiğneme başlangıcını üstlenir. Aralarındaki boşluğa yemek birikir ve çürük riski artar.',
    bakim: 'Aralarına diş ipi ya da arayüz fırçası ile temizlik şarttır.'
  },
  buyukAzi: {
    ad: 'Büyük Azı',
    ikon: 'buyukazi',
    yuzey: ['Çiğneme yüzeyi', 'Dış (bukkal)', 'İç (lingual)', 'Ön (mesial)', 'Arka (distal)'],
    egitim: 'Büyük azılar dört köşelidir ve en çok çürüyen dişlerdir. Çürük genellikle çiğneme yüzeyinin çukurcuklarında başlar.',
    bakim: 'Çiğneme yüzeyindeki çukurcuklara özel arayüz fırçası önerilir. Diş ipi mutlaka kullanılmalıdır.'
  }
}

/** 11 -> 'kesici' gibi tip eşlemesi (her çeyrede aynı sıra) */
export const TIP_SIRA = {
  1: 'kesici', 2: 'kesici', 3: 'kanin',
  4: 'kucukAzi', 5: 'kucukAzi',
  6: 'buyukAzi', 7: 'buyukAzi', 8: 'buyukAzi'
}

/** FDI numarası -> { ad, tip, ceyre, no } */
const ADLAR = {
  1: 'birinci kesici', 2: 'yan kesici', 3: 'köpek',
  4: 'birinci küçük azı', 5: 'ikinci küçük azı',
  6: 'birinci büyük azı', 7: 'ikinci büyük azı', 8: 'üçüncü büyük azı'
}

export function disBilgisi(fdi) {
  const no = Number(fdi)
  if (!no || no < 11 || no > 48) return null
  const ceyreNo = Math.floor(no / 10)
  const sira = no % 10
  const ceyre = CEYRE[ceyreNo]
  const tip = TIP[TIP_SIRA[sira]]
  const yirmiYas = sira === 8
  return {
    no,
    ceyre,
    sira,
    tip,
    yirmiYas,
    ad: `${ceyre.kisa} ${ADLAR[sira]} dişi`,
    tamAd: `${ceyre.kisa} ${ADLAR[sira]} dişi${yirmiYas ? ' (20 yaş dişi)' : ''}`,
    kisaAd: `${ceyre.kisa} ${sira}. ${tip.ad.replace(' Diş', '').replace(' (Sıra Dişi)', '')}`,
    yon: ceyre.yon,
    cene: ceyre.cene,
    ceneUst: ceyre.cene === 'üst'
  }
}

/** Üst çene sıralı (sağdan sola hastanın bakış açısından) */
export const UST_SIRA = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
export const ALT_SIRA = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]

/** Bir dişin hangi tedavilerde öne çıktığı — bilgilendirme metni */
export function disEgitimi(fdi, status) {
  const b = disBilgisi(fdi)
  if (!b) return ''
  const durumNotu = {
    saglam: 'Bu diş sağlıklı görünüyor.',
    dolgu: 'Bu dişte dolgu var. İlk hafta sıcak-soğuk hassasiyeti normaldir; 2 haftadan uzun sürerse hekiminize bildirin.',
    kanal: 'Bu diş kanal tedavili. Kırılgan olduğu için kaplama ile korunması ve 3 ayda bir kontrolü önerilir.',
    kaplama: 'Bu dişte kaplama var. Kenarlarında plak birikir, arayüz fırçası ile temizlik önemlidir.',
    takip: 'Bu diş takipte. Ağrı, şişlik veya hassasiyet olursa randevuyu öne alın.',
    cekim: 'Bu diş çekilmiş. Bölge iyileşene kadar o tarafla ısırmayın.',
    implant: 'Bu dişte implant var. Çevresindeki hijyen kritiktir; 6 ayda bir profesyonel temizlik önerilir.'
  }[status] || 'Bu diş için hekiminiz not düşmüş. Detaylı bilgi için hekiminize danışın.'

  const tipNotu = b.tip.egitim
  return `${durumNotu} ${tipNotu}`
}

export function disBakimi(fdi) {
  const b = disBilgisi(fdi)
  return b ? b.tip.bakim : ''
}

export function kontrolAraligi(status) {
  if (status === 'kanal' || status === 'takip') return { ay: 3, metin: '3 ay sonra kontrol' }
  if (status === 'dolgu' || status === 'kaplama' || status === 'implant') return { ay: 6, metin: '6 ay sonra kontrol' }
  if (status === 'cekim') return { ay: 12, metin: '6-12 ay sonra kontrol' }
  return { ay: 12, metin: '12 ay sonra rutin kontrol' }
}