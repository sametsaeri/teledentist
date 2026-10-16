// Diş sağlığı puanı — hastanın gerçek verilerinden hesaplanır.
// Doktor elinde değil; hasta kendi panelinde görür ve neyi neden
// iyileştirmesi gerektiğini anlar.
//
// Puan 0–100, dört bileşenden eşit ağırlıkla:
//   1. Diş durumu   — kaç diş tedavi gerektiriyor
//   2. Ağız hijyeni — plak indeksi
//   3. Diş bakımı   — kaygı düzeyi (bakıma gitme isteği)
//   4. Kontrol düzeni — son muayeneden bu yana geçen süre
//
// Bu dosya saf hesap yapar; veri çekmez, arayüz bilmez.

const AGIRLIK = 25 // her bileşen puanı

function yuvarla(n) {
  return Math.max(0, Math.min(100, Math.round(n)))
}

function gunFarki(tarih) {
  if (!tarih) return null
  const d = new Date(tarih)
  if (Number.isNaN(d.getTime())) return null
  return Math.floor((Date.now() - d.getTime()) / 86400000)
}

/**
 * @param {object} girdi
 * @param {object} girdi.teeth          { fdi: { status, treatment, date, doctorNote } }
 * @param {number} girdi.plaque         0–3 plak indeksi
 * @param {number} girdi.anxiety        0–25 kaygı skoru
 * @param {string} girdi.lastVisit      son muayene tarihi
 * @param {string} girdi.birthDate      doğum tarihi (yaş hesabı)
 * @param {Array}  girdi.pendingPhotos   hâlâ değerlendirilmemiş fotoğraflar
 */
export function saglikPuani({ teeth = {}, plaque, anxiety, lastVisit, birthDate, pendingPhotos = [] } = {}) {
  const disler = Object.entries(teeth || {}).filter(([, t]) => t && t.status)
  const say = (durum) => disler.filter(([, t]) => t.status === durum).length

  // Hiç veri yokken puan üretmek yanıltıcı olur ("mükemmel" gibi görünür).
  const veriSayisi = disler.length
    + (Number.isFinite(Number(plaque)) && Number(plaque) > 0 ? 1 : 0)
    + (Number.isFinite(Number(anxiety)) && Number(anxiety) > 0 ? 1 : 0)
    + (gunFarki(lastVisit) !== null ? 1 : 0)
  const veriVar = veriSayisi > 0

  /* --- 1. Diş durumu --- */
  const kotu = say('dolgu') + say('kanal') + say('kaplama') + say('implant') + say('takip')
  const cekik = say('cekim')
  const disPuan = disler.length === 0
    ? AGIRLIK // kayıt yoksa ceza verme, veri yok
    : yuvarla(AGIRLIK * (1 - Math.min(1, kotu / Math.max(6, disler.length * 0.4))))
  const disNot = disler.length === 0
    ? 'Diş kaydınız henüz oluşturulmadı.'
    : kotu === 0
      ? 'Tedavi gerektiren dişiniz yok.'
      : `${kotu} dişte tedavi kaydı var. Düzenli kontrollerle korunur.`

  /* --- 2. Ağız hijyeni --- */
  const plak = Number(plaque)
  const hijyenVar = Number.isFinite(plak) && plak > 0
  const hijyenPuan = hijyenVar ? yuvarla(AGIRLIK * (1 - Math.min(1, plak / 3))) : AGIRLIK
  const hijyenNot = !hijyenVar
    ? 'Hijyen ölçümü yapılmadı. Ağız bakımınızı ölçtürerek puanınızı tamamlayın.'
    : plak <= 0.5 ? 'Diş taşı birikimi yok, ağız bakımınız çok iyi.'
      : plak <= 1.5 ? 'Hafif diş taşı var. Günde iki kez diş fırçalamak yeterli.'
        : plak <= 2.5 ? 'Belirgin diş taşı var. Diş ipi kullanımı önerilir.'
          : 'Yoğun diş taşı var. Diş hekiminizle görüşmeniz önerilir.'

  /* --- 3. Diş bakımı (kaygı) --- */
  const kaygi = Number(anxiety)
  const kaygiVar = Number.isFinite(kaygi) && kaygi > 0
  const bakimPuan = kaygiVar ? yuvarla(AGIRLIK * (1 - Math.min(1, kaygi / 25))) : AGIRLIK
  const bakimNot = !kaygiVar
    ? 'Kaygı testi henüz yapılmadı.'
    : kaygi <= 7 ? 'Diş tedavisiyle ilgili kaygınız düşük, düzenli kontrole geliyorsunuz.'
      : kaygi <= 15 ? 'Orta düzeyde kaygı var. Görüşme öncesi hekiminizi bilgilendirin.'
        : 'Yüksek kaygı var. Sakin, kısa ve önceden planlanmış seanslar sizin için daha uygun.'

  /* --- 4. Kontrol düzeni --- */
  // 6 ay içinde muayene = tam puan; 18 aydan eski = sıfır puan, arada doğrusal azalır
  const gun = gunFarki(lastVisit)
  let kontrolPuan = AGIRLIK
  let kontrolNot = 'Henüz muayene kaydınız yok.'
  if (gun !== null) {
    const oran = Math.max(0, Math.min(1, (gun - 180) / 360))
    kontrolPuan = yuvarla(AGIRLIK * (1 - oran))
    kontrolNot = gun <= 180
      ? `Son muayene ${gun} gün önce — kontrolleriniz düzenli.`
      : gun <= 365
        ? `Son muayene ${Math.round(gun / 30)} ay önce. Kontrol aralığınız dolmak üzere.`
        : gun <= 540
          ? `Son muayene ${Math.round(gun / 30)} ay önce. Kontrole bir an önce gelmeniz önerilir.`
          : `Son muayene ${Math.round(gun / 30)} ay önce. Bir kontrole gelmeniz önerilir.`
  }

  /* --- Bekleyen fotoğraf (küçük ama etkili) --- */
  const bekleyen = pendingPhotos.length

  const toplam = yuvarla(disPuan + hijyenPuan + bakimPuan + kontrolPuan)

  let baslik, renk, ozet
  if (toplam >= 85) {
    baslik = 'Çok iyi'; renk = '#0f9d58'
    ozet = 'Diş sağlığınız çok iyi durumda. Bu düzeni korumak için yıllık kontrol yeterli.'
  } else if (toplam >= 65) {
    baslik = 'İyi'; renk = '#2f80ed'
    ozet = 'Genel durumunuz iyi. Küçük düzenlemelerle daha da iyi hale gelebilir.'
  } else if (toplam >= 45) {
    baslik = 'Orta'; renk = '#f2994a'
    ozet = 'Bazı konularda düzeltme gerekiyor. Aşağıdaki önerilere başlamanız yeterli.'
  } else {
    baslik = 'Dikkate gerek'; renk = '#eb5757'
    ozet = 'Diş bakımınızda eksikler var. En kısa sürede hekiminize görünmeniz önerilir.'
  }

  const yas = yasHesapla(birthDate)

  return {
    toplam,
    baslik,
    renk,
    ozet,
    yas,
    veriVar,
    bekleyenFoto: bekleyen,
    bolumler: [
      { ad: 'Diş Durumu', puan: disPuan, azami: AGIRLIK, not: disNot, ikon: 'dis' },
      { ad: 'Ağız Hijyeni', puan: hijyenPuan, azami: AGIRLIK, not: hijyenNot, ikon: 'hijyen' },
      { ad: 'Diş Bakımı', puan: bakimPuan, azami: AGIRLIK, not: bakimNot, ikon: 'kaygi' },
      { ad: 'Kontrol Düzeni', puan: kontrolPuan, azami: AGIRLIK, not: kontrolNot, ikon: 'kontrol' }
    ]
  }
}

function yasHesapla(birthDate) {
  const g = gunFarki(birthDate)
  if (g === null || g < 0) return null
  return Math.floor(g / 365.25)
}

/* ================================================================== */
/*  Ağız bakımı rehberi — hastanın verisine göre kişiselleşir       */
/* ================================================================== */

export function bakimOnerileri({ teeth = {}, plaque, anxiety, lastVisit } = {}) {
  const oneri = []
  const disler = Object.values(teeth || {}).filter(Boolean)
  const say = (d) => disler.filter((t) => t.status === d).length
  const plak = Number(plaque)
  const kaygi = Number(anxiety)
  const gun = gunFarki(lastVisit)

  // --- Günlük rutin ---
  oneri.push({
    baslik: 'Günde iki kez, iki dakika',
    metin: 'Diş fırçalamadan sonra 30 dakika beklemeden yiyin. Böylece fırçanın temizleme etkisi bozulmaz.',
    onem: 'temel'
  })
  oneri.push({
    baslik: 'Diş ipi veya arayüz fırçası',
    metin: 'Dişlerin arasındaki yüzeyler fırçanın ulaşamadığı yerlerdir. Günde bir kez diş ipi kullanın.',
    onem: say('dolgu') > 0 ? 'yuksek' : 'onemli'
  })
  oneri.push({
    baslik: 'Şekerli gıdaları sınırlayın',
    metin: 'Günde bir kez şekerli içecek, asitli içecekten sonra 30 dakika fırçalamayın.',
    onem: 'onemli'
  })

  // --- Veriye göre kişiselleşen öneriler ---
  if (Number.isFinite(plak) && plak >= 2) {
    oneri.unshift({
      baslik: 'Diş taşınız fazla',
      metin: `Plak ölçümünüz ${plak}/3. Diş taşı temizliği (kireçleme) önerilir; bu işlem ağrısızdır ve 20 dakikada tamamlanır.`,
      onem: 'yuksek'
    })
  }
  if (say('dolgu') >= 2) {
    oneri.unshift({
      baslik: 'Dolgu bakımı',
      metin: 'Dolgu yapılan dişlerde ısı hassasiyeti normaldir. Ancak aynı bölgede art arda hassasiyet varsa hekiminize bildirin.',
      onem: 'yuksek'
    })
  }
  if (say('kanal') > 0) {
    oneri.unshift({
      baslik: 'Kanal tedavili diş takibi',
      metin: 'Kanal tedavili dişte kırılma veya ağrı olursa hemen hekiminize başvurun; kontrolü ertelemeyin.',
      onem: 'yuksek'
    })
  }
  if (Number.isFinite(kaygi) && kaygi >= 13) {
    oneri.unshift({
      baslik: 'Randevuda sakin seans',
      metin: 'Randevu alırken "ağrılı ve kaygılı hastayım" bilgisini iletmeniz, kliniğin sakin bir saat ayırmasını sağlar.',
      onem: 'onemli'
    })
  }
  if (gun !== null && gun > 365) {
    oneri.unshift({
      baslik: 'Kontrolünüz gecikti',
      metin: `Son muayeneden ${Math.floor(gun / 30)} ay geçti. Yılda en az bir kontrol önerilir.`,
      onem: 'yuksek'
    })
  }
  if (say('cekim') > 0) {
    oneri.push({
      baslik: 'Çekilen diş bölgesi',
      metin: 'Çekim sonrası bölgeye sert gıda yerken ısırmamak, boşlukta yemek birikmesini önler.',
      onem: 'onemli'
    })
  }

  return oneri
}

/* ================================================================== */
/*  Acil durum rehberi — geçici ilk yardım, reçete değil            */
/* ================================================================== */

export const ACIL = [
  {
    ad: 'Şiddetli diş ağrısı',
    belirti: ['Gece uyandıran ağrı', 'Soğuk veya sıcak yemeğin ağrıyı artırması'],
    ilkyardim: [
      'Soğuk kompres uygulayın (15 dakika, cilt ile temas ettirmeyin).',
      'Ağrı kesici kullanabilirsiniz; öğle yemeğinden sonra alın.',
      'Ağrı kesiciyi yemekten yarım saat önce alın, dolgu yapılacaksa hekiminiz bilgilensin.',
      'İltihap için antibiyotik kendi kendinize başlamayın.'
    ],
    acil: 'Yüzde şişlik, ateş, göz altı şişliği veya ağrının kulak/bademcik hizasına yayılması varsa aynı gün randevu alın.'
  },
  {
    ad: 'Diş eti kanaması',
    belirti: ['Fırçalarken kanama', 'Diş eti şiş ve kızarık'],
    ilkyardim: [
      'Günde iki kez yumuşak uçlu diş fırçasıyla nazikçe fırçalayın — kanama bırakmayın.',
      '%3 hidrojen peroksit ile 10 saniye çalkalayıp tükürün.',
      'Diş ipi kullanmaya devam edin; kanama en çok diş ipi eksikliğinde görülür.'
    ],
    acil: 'Kanama 10 dakikadan uzun sürüyorsa veya diş eti iltihaplanıyorsa muayene gerekir.'
  },
  {
    ad: 'Kırılan / düşen diş veya dolgu',
    belirti: ['Sert bir şey ısırınca çatlak', 'Dolgunun düşmesi'],
    ilkyardim: [
      'Kırılan parçayı bulup nemli bir gazlı beze koyup soğuk saklayın.',
      'Ağrı varsa yüzünüze buz uygulayın, ağrı kesici alabilirsiniz.',
      'Kırık dişi fırçalamaya çalışmayın, o bölgede ısınmayın.'
    ],
    acil: 'Diş eti içine gömülü kırık veya sinire ulaşan kırık varsa acil muayene gerekir.'
  },
  {
    ad: 'Diş apsesi / şişlik',
    belirti: ['Yanakta şişlik', 'Ateş', 'Bademcik veya boyunda şişlik'],
    ilkyardim: [
      'Ağrı kesici kullanın; bölgeye sıcak uygulamayın.',
      'Bol sıvı tüketin.',
      'Antibiyotik kullanmayın — apse varsa hekiminiz drenaj yapmalıdır.'
    ],
    acil: 'Bu bulguların hepsi aynı gün hekim değerlendirmesi gerektirir.'
  },
  {
    ad: 'Diş eti iltihabı (gingivit) veya diş eti çekilmesi',
    belirti: ['Fırçalarken kanama', 'Kötü koku', 'Diş eti ile diş arasında boşluk'],
    ilkyardim: [
      'Yumuşak uçlu diş fırçasına geçin ve günlük fırçalamayı sürdürün.',
      'Diş ipini her gün kullanın.'
    ],
    acil: 'Diş eti çok şiş veya dişler sallanıyorsa periodontoloji değerlendirmesi gerekir.'
  },
  {
    ad: 'Diş sıkma (gıcırdama)',
    belirti: ['Sabah baş ağrısı', 'Kulak ağrısı benzeri yakınma', 'Yanağın iç tarafında diş izi'],
    ilkyardim: [
      'Yatmadan önce dişlerinizi fırçalayın.',
      'Sıkılmış çeneyi fark ettiğinizde bilinçli olarak gevşetin.'
    ],
    acil: 'Sabit araç ve gece plağı için hekiminizle görüşün.'
  }
]

/* ================================================================== */
/*  Günlük bakım kontrol listesi — tarayıcıda saklanır                */
/* ================================================================== */

export const GUNLUK_ADIMLAR = [
  { id: 'firca-sabah', ad: 'Sabah dişlerimi fırçaladım', ikon: 'firca' },
  { id: 'ip', ad: 'Diş ipi kullandım', ikon: 'ip' },
  { id: 'firca-aksam', ad: 'Akşam dişlerimi fırçaladım', ikon: 'firca' },
  { id: 'saglikli-atistirma', ad: 'Günde bir kez sağlıklı bir şey yedim', ikon: 'yemek' }
]

const LISTE_ANAHTARI = (pid) => `td_hasta_liste_${pid}`

export function listeyiOku(pid) {
  try {
    const ham = JSON.parse(localStorage.getItem(LISTE_ANAHTARI(pid)) || '{}')
    const bugun = new Date().toISOString().slice(0, 10)
    // Farklı güne ait işaretler otomatik temizlenir
    return ham.gun === bugun ? ham.adimlar || {} : {}
  } catch {
    return {}
  }
}

export function listeyiYaz(pid, adimlar) {
  try {
    localStorage.setItem(LISTE_ANAHTARI(pid), JSON.stringify({
      gun: new Date().toISOString().slice(0, 10),
      adimlar
    }))
  } catch { /* tarayıcı kaydı kapalı olabilir, sessiz geç */ }
}