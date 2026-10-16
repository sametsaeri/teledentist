// DİŞ GELECEĞİ SİMÜLATÖRÜ — klinik ilerleme kuralları
//
// Bu dosya bir tahmin motoru değil, bir KURAL TABANLI EĞİTİM motorudur.
// Amacı hastanın "şimdi tedavi olmazsam ne olur?" sorusunu yanıtlamaktır.
// Tıbbi tanı koymaz; karar hekimindir.
//
// VERİ KAYNAĞI: Diş hekimliğinde kabul görmüş klinik ilerleme sıralaması
//   • çürük: beyaz leke → kahverengi nokta → kavitasyon → pulpa → periapikal
//   • kanal tedavili diş korumasız: dikey kırılma riski belirgin biçimde artar
//   • kaplama kenarında sekonder çürük, aşınma/kırılma riski
//   • implant çevresinde peri-implantit ve kemik kaybı
//
// ÜCRETLER: Yaklaşık 2026 Türkiye diş hekimliği aralıkları. Kesiin fiyat değildir;
// klinik kendi ücret listesini UCRETLER ile güncelleyebilir.

import { disBilgisi, kontrolAraligi } from '../data/disAdlari.js'

export const UCRETLER = {
  muayene: { ad: 'Muayene', min: 0, max: 1500, seans: 1 },
  temizlik: { ad: 'Diş taşı temizliği (kireçleme)', min: 1200, max: 4000, seans: 1 },
  dolgu: { ad: 'Kompozit dolgu', min: 1800, max: 5000, seans: 1 },
  kanal: { ad: 'Kanal tedavisi', min: 5000, max: 14000, seans: 2 },
  kaplama: { ad: 'Porselen kaplama', min: 9000, max: 28000, seans: 2 },
  implant: { ad: 'İmplant tedavisi', min: 18000, max: 42000, seans: 3 },
  cekim: { ad: 'Diş çekimi', min: 1500, max: 5000, seans: 1 },
  greltme: { ad: 'Kemik greftleme', min: 6000, max: 18000, seans: 1 },
  apse: { ad: 'Apse drenajı', min: 2000, max: 6000, seans: 1 },
  gerekce: { ad: 'Gerekçeli tedavi (çürük kaldırma)', min: 2500, max: 7000, seans: 1 }
}

/** Simülasyon aşamaları — görsel evre ile eşleşir */
export const EVRE = {
  saglam: 0,
  risk: 1,
  erken: 2,
  orta: 3,
  ileri: 4,
  kritik: 5
}

const A = (evre, ay, baslik, anlatim, agir, riskNotu) => ({
  evre, ay, baslik, anlatim,
  agirPuan: agir,          // 0-100 ağrı olasılığı
  riskNotu
})

/* ================================================================== */
/*  Her durum için ilerleme senaryoları                                 */
/* ================================================================== */
const KURALLAR = {
  dolgu: [
    A(0, 0, 'Dolgu sağlam',
      'Mevcut dolgunuz iyi durumda. Diş öğütülürken ağrı beklenmez, hassasiyet geçicidir.',
      5, 'Tedavi gerekmiyor — düzenli kontrol yeterli.'),
    A(1, 6, 'Dolgu kenarı aşınmaya başlar',
      'Dolgu kenarında mikro boşluklar açılır ve orada plak birikir. Çürük henüz görünmez ama başlamıştır.',
      12, 'Kontrol edilmemiş dolgu, zamanla en sık tekrarlanan gereksiz işlem nedenidir.'),
    A(2, 18, 'Sekonder çürük başlar',
      'Dolgunun altında veya kenarında yeni çürük oluşur. Bu çürük dolgunun altında geliştiği için fark edilmesi zordur; ağrıya kadar fark edilmeyebilir.',
      35, 'Dolgu altındaki çürük "gizli çürük" denir ve en sık diş kaybı nedenlerindendir.'),
    A(3, 30, 'Çürük sinire ulaşır',
      'Çürük derinleşir, dişin sinir odasına (pulpa) ilerler. Şiddetli ağrı, gece ağrısı ve ısı hassasiyeti başlar.',
      65, 'Bu aşamadan sonra kanal tedavisi gerekebilir.'),
    A(4, 48, 'Diş kırılır veya çekilir',
      'Demineralize diş yapısı o kadar zayıflar ki kırılır. Kalan kök parçası kalır; pahalı ve zahmetli bir işlem gerekir.',
      88, 'Kırılmış diş her zaman kurtarılamaz. Bu aşamayı önlemek en ucuz müdahaledir.')
  ],

  takip: [
    A(0, 0, 'Takipte — izleme altında',
      'Hekiminiz dişi takip listesine almış. Şu an ağrı veya şikâyet yok.',
      8, 'Takip, hareketsiz kalan bir dişi güvenle izlemeye karar vermektir.'),
    A(1, 6, 'Değişim devam ediyor',
      'İzlenen bulgu büyüyor veya aynı kalıyor. Hastanın genel sağlığı bu süreci etkiler.',
      20, 'Altı ayda bir değerlendirme önerilir.'),
    A(2, 12, 'Tedavi gerektirir hale gelir',
      'Bulgu artık "izlenebilir" değil. En azından dolgu gerekir, derinleşirse kanal tedavisi gündeme gelir.',
      45, 'Tedavi edilmemiş takip dişleri, ortalama bir yıl içinde işlem gerektirir.'),
    A(3, 24, 'Derin çürük / sinir iltihabı',
      'Süreç ilerledi. Şimdi acil müdahale gerekir.',
      70, 'Geri dönüşü olmayan diş dokusu kaybedilir.')
  ],

  kanal: [
    A(0, 0, 'Kanal dolumu tamamlanmış',
      'Sinir öldürülmüş ve kanal doldurulmuştur. Diş ağrısız olmalıdır.',
      3, 'Kanal tedavisi dişi kurtarır, ama yapıyı güçlendirmez.'),
    A(1, 12, 'Diş kırılgan hale gelir',
      'Sinir boşaltılan diş, doğal esneme ve çiğneme baskısına dayanacak kadar sağlam değildir. Özellikle arka dişlerde dikey çatlak riski yükselir.',
      18, 'Korumasız kanal tedavili dişte dikey kırılma riski belirgin biçimde artar.'),
    A(2, 30, 'Dikey kırılma riski',
      'Kırılan dişin kanal dolumu bozulur, sızıntı ve enfeksiyon başlar. Yeniden kanal tedavisi çoğu zaman kök kanalına veya çekime götürür.',
      45, 'Kırık, kanal tedavisinin en pahalı komplikasyonudur.'),
    A(3, 48, 'Kök kırılması — diş kaybı riski',
      'Kökte dikey kırılma oluştu. Diş artık kurtarılamayabilir; implant veya protez gerekir.',
      80, 'Bu aşamaya gelen dişlerde implant en güvenilir seçenektir.')
  ],

  kaplama: [
    A(0, 0, 'Kaplama yerinde ve iyi durumda',
      'Kaplama düzgün, renk uyumu iyi. Şikâyet beklenmez.',
      4, 'Kaplama, dişin rengini ve formunu geri kazandırır.'),
    A(1, 18, 'Kenar çürüğü başlar',
      'Kaplama ile diş arasındaki sızdırmazlık bozulur; kenar altında plak ve çürük birikir. Kaplama rengi değişebilir.',
      15, 'Kaplama kenarları, dişin geri kalanından daha hızlı çürür.'),
    A(2, 36, 'Kaplama düşer veya diş kırılır',
      'Kenar çürüğü derinleşir, kaplama tutunmaz ve düşer. Altındaki diş kırılmış olabilir.',
      50, 'Kaplama düştüğünde altındaki diş genellikle zayıflamış bulunur.'),
    A(3, 60, 'Diş yeniden yapılandırılmalı',
      'Diş kaldığı yerine göre yeniden kaplanır, kanal tedavisi alır veya çekilir.',
      75, 'Kaplama düşüşünü ihmal etmek pahalı bir zincir başlatır.')
  ],

  implant: [
    A(0, 0, 'İmplant üst yapısı sağlam',
      'İmplant ve üst yapı yerinde, çiğneme rahat.',
      4, 'İmplant, kökün yerine geçerek kemik kaybını önler.'),
    A(1, 18, 'İmplant üstü bakım gerekli',
      'İmplant çevresinde plak birikimi başlar. Arayüz fırçası ve diş ipi şarttır.',
      18, 'İmplant yüzeyi doğal dişten daha pürüzlüdür, plağı daha tutar.'),
    A(2, 36, 'Peri-implantit riski',
      'İmplant çevresinde kemik erimesi başlar. Tedavi edilmezse implant sallanır ve düşer.',
      55, 'Peri-implantit tedavi edilebilir ama ileri evrede implant kaybı kaçınılmazdır.')
  ],

  cekim: [
    A(0, 0, 'Diş çekilmiş',
      'Bu diş artık ağızda yok. Boşluk yemeğe ve dile temas ediyor.',
      2, 'Boşluk, komşu dişlerin kaymasına ve karşı dişin uzamasına neden olur.'),
    A(1, 12, 'Komşu dişler kaymaya başlar',
      'Boşluğa doğru komşu diş eğilir, karşı diş uzar. Diş eti seviyesi bozulur.',
      10, 'Kronik bir ilerlemedir; yıllar içinde fark edilir.'),
    A(2, 36, 'Diğer dişlerde çürük riski artar',
      'Boşlukta yemek birikir. Temizlenemeyen bölgelerde yeni çürükler oluşur.',
      30, 'Diş eksikliği, kalan dişlerin ömrünü kısaltır (yayınlanmış klinik gözlem).')
  ],

  saglam: [
    A(0, 0, 'Diş sağlıklı',
      'Kayıtta bir sorun görünmüyor. Dişleriniz doğru konumlandırılmış ve işlevini yerine getiriyor.',
      2, 'Sorun yok; düzenli kontrolle bu durum korunur.'),
    A(1, 12, 'Risk faktörleri birikiyor',
      'Diş taşı, plak veya yetersiz fırçalama diş yüzeyinde asit saldırısına uygun ortam oluşturur.',
      8, 'Sağlıklı görünen diş, riskli ortamda çürüyebilir.'),
    A(2, 24, 'Başlangıç çürüğü',
      'Mineral kaybı başlar. Beyaz leke kahverengi noktaya dönüşür. Ağrı yoktur.',
      20, 'Bu aşamada tedavi en ucuz ve en hızlıdır.'),
    A(3, 48, 'Derin çürük / sinir iltihabı',
      'Çürük ilerler, sinire ulaşır. Şiddetli ağrı ve apse gelişebilir.',
      70, 'Erken müdahale ile önlenebilecek bir durum.')
  ]
}

/* ================================================================== */
/*  Ana hesap                                                          */
/* ================================================================== */
/**
 * Evreye göre gereken işlemler.
 *
 * ÖNEMLİ: Diş kaybedildiğinde (evre >= 4) çekim maliyeti tek başına yanıltıcıdır.
 * Kaybedilen dişin yerine konması gerekir; bu yüzden implant bedeli de eklenir.
 * Geciktikçe kemik eridiği için çekim senaryolarında greftleme de devreye girer.
 */
function adimMaliyeti(evre, status) {
  if (status === 'cekim') {
    // Diş zaten yok: tedavi = yerine koyma, geciktikçe kemik grefti gerekir
    if (evre >= 4) return [UCRETLER.cekim, UCRETLER.greltme, UCRETLER.implant]
    if (evre >= 2) return [UCRETLER.implant, UCRETLER.greltme]
    return [UCRETLER.implant]
  }
  if (evre >= 4) return [UCRETLER.cekim, UCRETLER.implant]
  if (evre === 3) {
    if (status === 'kanal') return [UCRETLER.kanal, UCRETLER.kaplama]
    return [UCRETLER.kanal, UCRETLER.kaplama]
  }
  if (evre === 2) return [UCRETLER.gerekce, UCRETLER.dolgu]
  if (evre === 1) {
    if (status === 'saglam') return [UCRETLER.temizlik]
    return [UCRETLER.temizlik, UCRETLER.dolgu]
  }
  return [UCRETLER.muayene]
}

function senaryoKur({ status, baslangicEvre, zamanKaydir, adimlar, baslik, ozet, acilMi }) {
  const evreler = adimlar.map((a) => ({ ...a, ay: Math.max(0, a.ay - zamanKaydir) }))
  // Zaman kaydırması bazı adımları geçersiz kıldıysa baştan başla
  const gecerli = evreler.filter((a) => a.ay >= 0)
  const sonAsama = gecerli[gecerli.length - 1] || adimlar[0]

  const isler = adimMaliyeti(sonAsama.evre, status)
  const min = isler.reduce((t, i) => t + i.min, 0)
  const max = isler.reduce((t, i) => t + i.max, 0)
  const seans = isler.reduce((t, i) => t + i.seans, 0)

  // Ağrı olasılığı ve diş kaybı riski
  const agirPuan = Math.min(100, sonAsama.agirPuan + zamanKaydir * 0.35)
  const kayipRiski = sonAsama.evre >= 4 ? 70 : sonAsama.evre === 3 ? 30 : sonAsama.evre >= 2 ? 10 : 2

  return {
    baslik,
    ozet,
    adimlar: gecerli,
    sonAsama,
    agirPuan: Math.round(agirPuan),
    kayipRiski,
    acilMi,
    maliyet: { min, max, seans },
    sure: `${Math.min(24, Math.max(1, gecerli.reduce((t, a) => t + 1, 0) * seans))} ay`,
    isler: isler.map((i) => i.ad)
  }
}

/**
 * Bir diş için üç senaryo üretir.
 * @param {object} girdi
 * @param {number} girdi.fdi      FDI numarası
 * @param {string} girdi.status   dişin mevcut durumu
 * @param {number} girdi.plaque   0-3 plak indeksi (risk faktörü)
 * @param {number} girdi.yas      hasta yaşı
 * @param {string} girdi.lastVisit son muayene
 */
export function senaryolar({ fdi, status = 'saglam', plaque, yas, lastVisit } = {}) {
  const b = disBilgisi(fdi)
  const kurallar = KURALLAR[status] || KURALLAR.saglam

  // Risk faktörleri zaman kaydırması yapar: riskli hastada süreç daha hızlı ilerler
  const riskPuani = (Number(plaque) || 0) >= 2 ? 1 : 0
  const yasFarki = yas && yas >= 60 ? 1 : 0
  const riskKaydir = riskPuani + yasFarki

  const senaryoTedavi = senaryoKur({
    status, zamanKaydir: 0, adimlar: kurallar.slice(0, 2),
    baslik: 'Şimdi tedavi olsam',
    ozet: `${b ? b.tamAd : 'Bu diş'} şu an müdahale alırsa süreç en erken ve en ucuz noktada durur.`
  })

  const senaryoGecikme = senaryoKur({
    status, zamanKaydir: 6 + riskKaydir * 6, adimlar: kurallar.slice(0, 3),
    baslik: '6 ay geciktirirsem',
    ozet: 'Altı ay beklemek, altı ay kaybetmek demektir. Tedavi bir kademe ilerler ve bedeli artar.',
    acilMi: true
  })

  const senaryoHiç = senaryoKur({
    status, zamanKaydir: 18 + riskKaydir * 12, adimlar: kurallar,
    baslik: 'Hiç müdahale etmezsem',
    ozet: 'Süreç kendi yolunda ilerler. Bu, bu dişin doğal seyridir — hesaplanabilir bir seyir.',
    acilMi: kurallar.length >= 4
  })

  // "Şimdi tedavi" senaryosunda başlangıçta veri yoksa risk çarpanı uygulanmaz
  return {
    dis: b,
    mevcut: { status, ad: kontrolAraligi(status).metin },
    riskKaydir,
    senaryolar: [senaryoTedavi, senaryoGecikme, senaryoHiç],
    // Karşılaştırma tablosu
    karsilastirma: [
      { etiket: 'Ağrı olasılığı', degerler: [senaryoTedavi.agirPuan, senaryoGecikme.agirPuan, senaryoHiç.agirPuan], birim: '%' },
      { etiket: 'Diş kaybı riski', degerler: [senaryoTedavi.kayipRiski, senaryoGecikme.kayipRiski, senaryoHiç.kayipRiski], birim: '%' },
      { etiket: 'Maliyet aralığı', degerler: [senaryoTedavi, senaryoGecikme, senaryoHiç], tip: 'maliyet' },
      { etiket: 'Toplam seans', degerler: [senaryoTedavi, senaryoGecikme, senaryoHiç], tip: 'seans' }
    ]
  }
}

/** Tüm ağız için genel görünüm: en acil dişler */
export function acilDişler(teeth = {}, plakOrani) {
  const liste = Object.entries(teeth)
    .map(([fdi, t]) => {
      const durum = t?.status || 'saglam'
      const kurallar = KURALLAR[durum] || KURALLAR.saglam
      const son = kurallar[kurallar.length - 1]
      return {
        fdi: Number(fdi),
        status: durum,
        evre: son.evre,
        agirPuan: son.agirPuan,
        aciliyet: Math.round(son.evre * 20 + son.agirPuan * 0.6),
        ad: disBilgisi(fdi)?.tamAd || fdi
      }
    })
    .filter((d) => d.status !== 'saglam' && d.status !== 'cekim')
    .sort((a, b) => b.aciliyet - a.aciliyet)
  return liste
}

/** Para biçimi (binlik ayırımlı, kısa) */
export function paraTL(n) {
  if (!n) return '—'
  if (n >= 1000) return `${Math.round(n / 1000)}B`
  return `${Math.round(n)}`
}

export function maliyetMetni({ min, max }) {
  return `${paraTL(min)}–${paraTL(max)} bin ₺`
}