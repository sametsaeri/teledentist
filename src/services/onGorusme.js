// Ön Değerlendirme (Pre-Anamnez) Asistanı — veri katmanı ve akış mantığı
//
// YASAL / ETİK SINIR — BU DOSYA EN ÖNEMLİ KURALI İÇERİR:
//   Bu süreç bir ÖN DEĞERLENDİRMEDİR. Teşhis koymaz, reçete yazmaz,
//   tedavi önermez. Yalnızca hastanın ifadelerini HEKİM adına düzenli
//   biçimde toplar. Nihai karar ve teşhis diş hekimindir.
//
// GÜVENLİK — KIRMIZI BAYRAK TESPİTİ:
//   Bazı bulgular acildir (nefes darlığı, yayılan yüz şişliği, çene kırığı
//   şüphesi, kontrol edilemeyen kanama). Bunlarda süreç DURDURULUR ve
//   hastaya "derhal acil servise gidin" denir. Bu tespit bilgiyi
//   kaçırmamak için serbest metinlerde de arama yapar.
//
// KABUL KURALI (TRIGGER):
//   Süreç YALNIZCA kayıt talebi hekimce ONAYLANDIKTA sonra çalışır.
//   Hekim onayı = profiles satırı oluşmuş olması (hasta giriş yapabiliyor).
//   Onaylanmamış talep bu ekranı göremez.

import { load, save, keys, getSession } from './store.js'

/* ------------------------------------------------------------------ */
/* ADIMLAR — sohbet sırası. Tek seferde hepsi sorulmaz.                */
/* ------------------------------------------------------------------ */

export const ADIMLAR = [
  {
    id: 'sikayet',
    baslik: 'Ana şikâyetiniz',
    soru: 'Bugün bizi hangi konuda ziyaret ediyorsunuz?',
    yardim: 'Örneğin diş ağrısı, hassasiyet, kanama, estetik bir şikâyet…',
    tip: 'uzunmetin'
  },
  {
    id: 'agri',
    baslik: 'Ağrı detayları',
    soru: 'Bu ağrıyı biraz anlatır mısınız?',
    yardim: 'Ağrı nasıl hissediliyor, ne zamandır var, sıcak-soğuk etkiliyor mu, gece uykunuzu böldü mü?',
    tip: 'soru'
  },
  {
    id: 'saglik',
    baslik: 'Genel sağlık durumunuz',
    soru: 'Bilinen bir sağlık durumunuz var mı?',
    yardim: 'İşaretleyebilirsiniz; hiçbiri yoksa boş bırakın.',
    tip: 'coklu'
  },
  {
    id: 'ilac',
    baslik: 'İlaçlarınız',
    soru: 'Düzenli olarak kullandığınız ilaç var mı?',
    yardim: 'Özellikle kan sulandırıcı, kemik ilacı (bisfosfonat), şeker ilacı veya kalp ilacı. Aldığınız ağrı kesiciler de önemlidir.',
    tip: 'soru'
  },
  {
    id: 'hijyen',
    baslik: 'Diş bakımı ve alışkanlıklar',
    soru: 'Günlük alışkanlıklarınız hakkında birkaç soru:',
    yardim: '',
    tip: 'coklu'
  },
  {
    id: 'bulasici',
    baslik: 'Bulaşıcı hastalık durumu',
    soru: 'Bilinen bir bulaşıcı hastalık durumunuz var mı?',
    yardim: 'Hepatit B/C, HIV gibi durumlar tedavi planını doğrudan etkiler; varsa belirtmeniz önemlidir.',
    tip: 'soru'
  }
]

/* ------------------------------------------------------------------ */
/* SEÇENEKLER                                                          */
/* ------------------------------------------------------------------ */

/** Sağlık durumları — HASTALIKLAR ile uyumlu (hekim formuyla aynı kaynak) */
export const SAGLIK_SECENEKLERI = [
  { id: 'diyabet', ad: 'Diyabet (şeker hastalığı)' },
  { id: 'hipertansiyon', ad: 'Tansiyon' },
  { id: 'kalp', ad: 'Kalp hastalığı / kapağı' },
  { id: 'astim', ad: 'Astım / KOAH' },
  { id: 'bobrek', ad: 'Böbrek hastalığı' },
  { id: 'tiroid', ad: 'Tiroid hastalığı' },
  { id: 'epilepsi', ad: 'Epilepsi' },
  { id: 'kan_hastaligi', ad: 'Kan hastalığı / pıhtılaşma' },
  { id: 'alerji', ad: 'Bilinen alerji' },
  { id: 'gebelik', ad: 'Gebelik' },
  { id: 'emzirme', ad: 'Emzirme' },
  { id: 'yok', ad: 'Hiçbiri yok' }
]

/** Alışkanlık soruları */
export const ALISKANLIK_SORULARI = [
  { id: 'bruksizm', ad: 'Diş sıkıyor / gıcırdatıyorum', riskli: false },
  { id: 'sigara', ad: 'Sigara kullanıyorum', riskli: false },
  { id: 'tutun', ad: 'Tütün / puro / nargile', riskli: true },
  { id: 'alkol', ad: 'Düzenli alkol tüketiyorum', riskli: false }
]

/**
 * ACİL BAYRAKLAR — her biri için hastaya "derhal acile gidin" denmelidir.
 * `metinler` alanı serbest metinde aranacak kelimelerdir (hastanın
 * kendi ifadesiyle yazdığı cevapları da yakalamak için).
 */
export const KIRMIZI_BAYRAKLAR = [
  {
    id: 'nefes',
    ad: 'Nefes darlığı',
    soru: 'Nefes alırken güçlük çekiyor musunuz?',
    acil: true,
    metinler: [
      'nefes darlığı', 'nefes alam', 'nefesim kesil', 'nefes almakta', 'nefes almada',
      'nefes dar', 'güçlük çek', 'dispne', 'stridor',
      'boğuluyorum', 'boğazıma', 'soluklanam', 'hava çekem', 'nefesim dar'
    ]
  },
  {
    id: 'sisiklik',
    ad: 'Yüzde/boyunda hızlı yayılan şişlik',
    soru: 'Yüzünüzde veya boynunuzda hızla büyüyen bir şişlik var mı?',
    acil: true,
    metinler: [
      'şişlik', 'şişti', 'şişmiş', 'şişiyor', 'şişer', 'yutamıyorum',
      'yanağımda şiş', 'boynum şiş', 'yüzüm şiş', 'kulak altımda', 'boyunlarımda şiş'
    ]
  },
  {
    id: 'kiriklik',
    ad: 'Çene kırığı şüphesi',
    soru: 'Çenenize bir darbe aldınız mı veya çeneniz kilitli kaldı mı?',
    acil: true,
    metinler: [
      'çene kırık', 'çenem kırık', 'çene kırıldı', 'çenem kırıldı', 'çenem kırılma',
      'darbe aldım', 'çarpma', 'çarpış', 'kilitli kaldı', 'kilitlen',
      'ağzımı açamıyorum', 'ağzımı kapatamıyorum', 'çenem kalktı'
    ]
  },
  {
    id: 'kanama',
    ad: 'Kontrol edilemeyen kanama',
    soru: 'Diş eti kanamanızı durduramadınız mı?',
    acil: true,
    metinler: [
      'kanama durmuyor', 'kanaması durmuyor', 'kanamayı durduram', 'kanıyı durduram', 'kanı durduram',
      'sürekli kanıyor', 'kan kaybı', 'durduramıyorum'
    ]
  }
]

/**
 * "şişlik yok", "nefes darlığım yok" gibi OLUMSUZ cümleleri elemer.
 * Hasta "şişlik yok" yazdığında acil bayrak kalkmamalı.
 */
function olumsuzEslesme(butunMetin, kelime) {
  let bas = 0
  while (true) {
    const i = butunMetin.indexOf(kelime, bas)
    if (i === -1) return false
    const onceki = butunMetin.slice(Math.max(0, i - 24), i)
    // Kelimenin hemen öncesinde olumsuzluk varsa bu eşleşmeyi atla
    if (/(yok|olmayan|olmadı|olmadan|hiç|nekadar)\s*$/i.test(onceki)) {
      bas = i + kelime.length
      continue
    }
    return true
  }
}

/** İlaçlar — riskli olanlar işaretlenir (tedavi öncesi hekim değerlendirmesi) */
export const ILAC_RISKLERI = [
  { id: 'kan_sulandirici', ad: 'Kan sulandırıcı', riskli: true },
  { id: 'bisfosfonat', ad: 'Kemik ilacı (bisfosfonat)', riskli: true },
  { id: 'antibiyotik', ad: 'Düzenli antibiyotik', riskli: false },
  { id: 'seker_ilaci', ad: 'Şeker (diyabet) ilacı', riskli: false },
  { id: 'kalp_ilaci', ad: 'Kalp / tansiyon ilacı', riskli: false },
  { id: 'agirtkesici', ad: 'Ağrı kesici', riskli: false },
  { id: 'yok', ad: 'İlaç kullanmıyorum', riskli: false }
]

/* ------------------------------------------------------------------ */
/* ACİL TESPİTİ                                                        */
/* ------------------------------------------------------------------ */

/**
 * Verilen cevaplarda kırmızı bayrak arar.
 *
 * İki yöntem birlikte çalışır:
 *   1) Hasta "evet" dediyse (bayrak id'si cevaplarda)
 *   2) Hasta serbest metinde belirttiyse (kelime eşleşmesi)
 *
 * GÜVENLİK NOTU: Metin taraması TÜM alanları kapsar — özellikle
 * "sikayet" (ana şikâyet) alanı. Hasta "yanağım şişti" dediğinde
 * en çok orada yazar; alan dışarıda bırakılırsa acil bir bulgu kaçar.
 * Yanlış pozitif (hastanın "yok" demesi) acil ekranında net bir bilgi
 * olduğu için kabul edilebilir; yanlış NEGATİF ise kabul edilemez.
 *
 * @returns {{id:string, ad:string}[]} bulunan bayraklar
 */
export function kirmiziBayraklariBul(cevaplar = {}) {
  const bulunan = []

  // Tüm serbest metinleri birleştir (tek seferde, verimlilik için)
  const butunMetin = Object.entries(cevaplar)
    .filter(([, v]) => typeof v === 'string' || Array.isArray(v))
    .map(([, v]) => (Array.isArray(v) ? v.join(' ') : v))
    .join(' ')
    .toLocaleLowerCase('tr')

  for (const bayrak of KIRMIZI_BAYRAKLAR) {
    // 1) Doğrudan "evet" işareti
    if (cevaplar[bayrak.id] === true || cevaplar[bayrak.id] === 'evet') {
      bulunan.push({ id: bayrak.id, ad: bayrak.ad })
      continue
    }
    // 2) Serbest metin içinde kelime taraması (TÜM alanlar)
    //    "şişlik yok" gibi olumsuz cümleler eleme yapılır
    if (bayrak.metinler.some((m) => olumsuzEslesme(butunMetin, m))) {
      bulunan.push({ id: bayrak.id, ad: bayrak.ad })
    }
  }
  return bulunan
}

/** Acil uyarısı gerekiyor mu? */
export function acilDurumVar(cevaplar) {
  return kirmiziBayraklariBul(cevaplar).length > 0
}

/* ------------------------------------------------------------------ */
/* DEĞERLENDİRME                                                       */
/* ------------------------------------------------------------------ */

/**
 * Toplanan cevaplardan tedavi öncesi dikkat edilecek riskleri çıkarır.
 * Bunlar hekimin anamnez formundaki "riskli" işaretlerle eşleşir.
 */
export function riskleriDegerlendir(cevaplar = {}) {
  const riskler = []
  const saglik = cevaplar.saglik || []
  const ilac = cevaplar.ilac_isaret || []
  const alis = cevaplar.hijyen || []

  // Kan sulandırıcı / bisfosfonat: diş çekimi ve implant için kritik
  if (ilac.includes('kan_sulandirici')) riskler.push('Kan sulandırıcı kullanımı')
  if (ilac.includes('bisfosfonat')) riskler.push('Kemik ilacı (bisfosfonat) kullanımı')

  // Kalp kapağı / protez kalp kapakçığı
  if (saglik.includes('kalp')) riskler.push('Kalp hastalığı / kapağı')
  // Gebelik: röntgen ve birçok tedavi ertelenebilir
  if (saglik.includes('gebelik')) riskler.push('Gebelik')
  if (saglik.includes('emzirme')) riskler.push('Emzirme')
  if (saglik.includes('diyabet')) riskler.push('Diyabet')
  if (saglik.includes('bobrek')) riskler.push('Böbrek hastalığı')
  if (saglik.includes('epilepsi')) riskler.push('Epilepsi')
  if (saglik.includes('alerji')) riskler.push('Bilinen alerji')
  if (alis.includes('tutun')) riskler.push('Tütün ürünü kullanımı')
  if (saglik.includes('kan_hastaligi')) riskler.push('Kan hastalığı / pıhtılaşma')

  return [...new Set(riskler)]
}

/* ------------------------------------------------------------------ */
/* ÖZET                                                                */
/* ------------------------------------------------------------------ */

const adBul = (liste, id) => liste.find((x) => x.id === id)?.ad || id

/**
 * Hekimin paneline aktarılacak özet metnini üretir.
 * Format klinik düzene göre sabittir; hekim bunu kopyalayıp rapora yapıştırabilir.
 */
export function ozetUret(cevaplar = {}, meta = {}) {
  const ad = (k) => adBul(SAGLIK_SECENEKLERI, k)
  const alAd = (k) => adBul(ALISKANLIK_SORULARI, k)
  const ilAd = (k) => adBul(ILAC_RISKLERI, k)

  const bayraklar = kirmiziBayraklariBul(cevaplar)
  const riskler = riskleriDegerlendir(cevaplar)

  const lines = []
  lines.push('[HASTA ANAMNEZ ÖZETİ]')
  lines.push(`• Ana Şikayet: ${cevaplar.sikayet || 'Belirtilmedi'}`)

  const agri = cevaplar.agri
  lines.push(`• Ağrı Detayı (Türü/Tetikleyici/Süre): ${agri || 'Belirtilmedi'}`)

  const saglikVar = (cevaplar.saglik || []).filter((s) => s !== 'yok')
  lines.push(`• Tıbbi Geçmiş & Bulaşıcı Hastalıklar: ${
    saglikVar.length ? saglikVar.map(ad).join(', ') : 'Bilinen durum yok'
  }${cevaplar.bulasici ? ` | ${cevaplar.bulasici}` : ''}`)

  const ilacVar = (cevaplar.ilac_isaret || []).filter((s) => s !== 'yok')
  const alerji = (cevaplar.saglik || []).includes('alerji') || cevaplar.alerji
  lines.push(`• Kullanılan İlaçlar & Alerjiler: ${
    ilacVar.length ? ilacVar.map(ilAd).join(', ') : 'İlaç kullanmıyor'
  }${cevaplar.ilac_not ? ` (${cevaplar.ilac_not})` : ''}${alerji ? ` | Alerji: ${alerji === true ? 'var' : alerji}` : ''}`)

  lines.push(`• Kırmızı Bayraklar / Riskler: ${
    bayraklar.length
      ? `ACİL — ${bayraklar.map((b) => b.ad).join(', ')}`
      : riskler.length ? riskler.join(', ') : 'Tespit edilmedi'
  }`)

  const alis = (cevaplar.hijyen || []).map(alAd)
  lines.push(`• Diğer Alışkanlıklar (Sigara/Bruksizm): ${alis.length ? alis.join(', ') : 'Belirtilmedi'}`)

  lines.push('---')
  lines.push(`Hastanın ifadesiyle ön değerlendirme alınmıştır. Teşhis koymamıştır; değerlendirme diş hekiminindir.`)
  if (meta.tarih) lines.push(`Toplama tarihi: ${meta.tarih}`)
  if (meta.sure) lines.push(`Süre: ${meta.sure} dk`)

  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* KAYIT                                                                */
/* ------------------------------------------------------------------ */

/** Süreç tamamlandı mı? (giriş sonrası tekrar sormamak için) */
export function onGorusmeTamamMi(pid) {
  const kayit = load(rakamYolu(pid), null)
  return !!(kayit?.tamamlandi)
}

/** Daha önce "şimdi değil" denildi mi? */
export function ertelendiMi(pid) {
  const kayit = load(rakamYolu(pid), null)
  return !!kayit?.ertelendi
}

function rakamYolu(pid) {
  return `${keys.onGorusme}_${pid}`
}

/**
 * Cevabı kaydeder (her adımda otomatik çağrılır — veri kaybı olmasın).
 * @returns {{kaydedildi:boolean, acil:boolean, bayraklar:Array}}
 */
export function cevabiKaydet(pid, cevaplar, meta = {}) {
  const mevcut = load(rakamYolu(pid), {}) || {}
  const yeni = { ...mevcut, ...cevaplar, pid, guncellendi: new Date().toISOString() }
  save(rakamYolu(pid), yeni)
  const bayraklar = kirmiziBayraklariBul(yeni)
  return { kaydedildi: true, acil: bayraklar.length > 0, bayraklar }
}

/** Süreci tamamla: özet üretilir ve saklanır. */
export function onGorusmeyiTamamla(pid, meta = {}) {
  const cevaplar = load(rakamYolu(pid), {}) || {}
  const kayit = {
    ...cevaplar,
    pid,
    tamamlandi: true,
    ozet: ozetUret(cevaplar, meta),
    riskler: riskleriDegerlendir(cevaplar),
    bayraklar: kirmiziBayraklariBul(cevaplar),
    bitis: new Date().toISOString()
  }
  save(rakamYolu(pid), kayit)
  return kayit
}

/** Süreci atla (hasta "şimdi değil" dedi). */
export function onGorusmeyiErtele(pid) {
  const mevcut = load(rakamYolu(pid), {}) || {}
  save(rakamYolu(pid), { ...mevcut, pid, ertelendi: true })
}

/** Kaydı sil (yeniden başlatma). */
export function onGorusmeyiSifirla(pid) {
  try { localStorage.removeItem(rakamYolu(pid)) } catch { /* yoksay */ }
}

/** Hekim için kayıtlı özet var mı? */
export function onGorusmeOzeti(pid) {
  return load(rakamYolu(pid), null)?.ozet || null
}

/** Hekim panelinde göreceği riskler (hastanın anamnezine eklenir). */
export function onGorusmeRiskleri(pid) {
  return load(rakamYolu(pid), null)?.riskler || []
}

/**
 * Hekim onayı sonrası gösterilecek mesaj.
 * Hastaya hekimin onayladığını ve neden anamnez sorulduğunu anlatır.
 */
export function kabulMesaji(hekimAdi) {
  const ad = String(hekimAdi || '').trim()
  const kim = ad ? (ad.toLowerCase().startsWith('dt.') || ad.toLowerCase().startsWith('dr.') ? ad : `Dt. ${ad}`) : 'Diş hekiminiz'
  return `${kim} tarafından başvurunuz onaylanmıştır. ` +
    `Görüşme öncesinde doktorunuza iletilmek üzere lütfen birkaç kısa anamnez sorusunu yanıtlayınız.`
}