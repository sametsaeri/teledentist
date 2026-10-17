// Bakım (devre dışı) modu — kullanıcıya açıklama gösterilir.
//
// AMAÇ: Sistem bakımı sırasında veri kaybı yaşanmasın, kullanıcı
// neden erişemediğini bilsin. Bakım sırasında:
//   1) Yazma işlemleri durdurulur (veri bozulmaz)
//   2) Kullanıcıya net açıklama gösterilir
//   3) Bakım bittiğinde kayıt tutulur (ne zaman, kim, neden)
//
// KAYIT YERİ: Önce SUNUCU (bakim_durumu tablosu), yetmezse tarayıcı.
// Sunucuda tutulmasının nedeni: bakım açıldığında TÜM cihazlar ve
// TÜM kullanıcılar aynı anda etkilenmelidir. Tarayıcıda tutulursa
// yalnız bakımı açan cihazda görünür ve kullanıcılar açıklamayı
// göremez ("panel açılmıyor" sanır).

import { load, save } from './store.js'
import { supabase, hasSupabase } from './supabase.js'

const KEY = 'td_bakim'

export const BAKIM_NEDENLER = [
  { id: 'planli', ad: 'Planlı bakım', varsayilan: 'Sistemimiz planlı bakım nedeniyle geçici olarak kullanıma kapalıdır.' },
  { id: 'guncelleme', ad: 'Yazılım güncellemesi', varsayilan: 'Sistem güncellemesi yapılıyor. Kısa süre içinde yeniden hizmet vereceğiz.' },
  { id: 'veritabani', ad: 'Veritabanı çalışması', varsayilan: 'Veritabanı bakımı nedeniyle hizmetlerimize kısa süreli ara veriyoruz.' },
  { id: 'ariza', ad: 'Beklenmeyen arıza', varsayilan: 'Beklenmeyen bir sorun nedeniyle hizmetlerimize ara verildi. Ekibimiz çalışıyor.' }
]

/**
 * Bakım kaydı.
 *
 * KAPALIYKEN DE ALANLAR ATILMAZ: bakım geçmişi (ne zaman, kim, neden)
 * saklanmalıdır. Yalnızca `acik` false olur. Böylece "son bakım ne zamandı"
 * sorusu cevaplanabilir ve geçmiş kayıt yok olmaz.
 */
export function bakimDurumu() {
  const b = load(KEY, null)
  if (!b) return { acik: false }
  return { ...b, acik: !!b.acik }
}

/** Bakımda mı? Yazma işlemleri bu koşulda durdurulur. */
export function bakimdaMi() {
  return bakimDurumu().acik === true
}

/**
 * Sunucudaki bakım durumunu okur.
 *
 * NEDEN: Bakım tek bir cihazda açılırsa yalnız o cihazda görünür ve
 * diğer kullanıcılar açıklama göremez. Sunucudan okunduğunda TÜM
 * cihazlar aynı anda etkilenir.
 *
 * @returns {object|null} sunucudan okunan durum, okunamazsa null
 */
export async function bakimDurumunuCek() {
  if (!hasSupabase) return null
  try {
    const { data, error } = await supabase.from('bakim_durumu').select('*').eq('id', 1).maybeSingle()
    if (error || !data) return null
    return {
      acik: !!data.acik,
      neden: data.neden,
      aciklama: data.aciklama,
      not: data.neden ? '' : '',
      tahmini: data.tahmini,
      kim: data.kim,
      baslangic: data.baslangic,
      bitti: data.bitti,
      bittiKim: data.bitti_kim,
      bitisNotu: data.bitis_notu
    }
  } catch {
    return null
  }
}

/** Sunucudaki durumu indirir ve tarayıcıya yazar (yedek olarak). */
export async function bakimSenkronla() {
  const sunucu = await bakimDurumunuCek()
  if (!sunucu) return bakimDurumu()
  save(KEY, sunucu)
  return sunucu
}

/**
 * Bakım modunu açar.
 * @param {object} p
 * @param {string} p.neden   BAKIM_NEDENLER içinden bir id veya serbest metin
 * @param {string} p.not     Kullanıcıya gösterilecek ek açıklama
 * @param {string} p.tahmini Bitiş tahmini (serbest metin)
 * @param {string} p.kim     Bakımı başlatan kişi
 */
export async function bakimAc({ neden = 'planli', not = '', tahmini = '', kim = 'sistem yöneticisi' } = {}) {
  // Hazır nedenlerden biri mi, yoksa serbest metin mi?
  const hazir = BAKIM_NEDENLER.find((n) => n.id === neden)
  const aciklama = not.trim() || hazir?.varsayilan || 'Sistemimiz geçici olarak bakımdadır.'
  const kayit = {
    acik: true,
    neden: hazir ? neden : 'ozel',
    aciklama,
    not,
    tahmini,
    kim,
    baslangic: new Date().toISOString()
  }
  save(KEY, kayit)

  // Sunucuya da yaz: tüm cihazlar aynı anda etkilensin
  if (hasSupabase) {
    try {
      await supabase.from('bakim_durumu').upsert({
        id: 1, acik: true, neden: kayit.neden, aciklama, tahmini, kim,
        baslangic: kayit.baslangic, bitti: null, updated_at: new Date().toISOString()
      })
    } catch { /* sunucu yazılamadı — tarayıcı kaydı geçerli */ }
  }
  return kayit
}

/** Bakımı kapatır; geçmişe not düşülür. */
export async function bakimKapat({ not = '', kim = 'sistem yöneticisi' } = {}) {
  const onceki = bakimDurumu()
  const kayit = {
    ...onceki,
    acik: false,
    bitti: new Date().toISOString(),
    bittiKim: kim,
    bitisNotu: not
  }
  save(KEY, kayit)

  if (hasSupabase) {
    try {
      await supabase.from('bakim_durumu').upsert({
        id: 1,
        acik: false,
        neden: kayit.neden || '',
        aciklama: kayit.aciklama || '',
        tahmini: kayit.tahmini || '',
        kim: kayit.kim || '',
        bitti: kayit.bitti,
        bitti_kim: kim,
        bitis_notu: not,
        updated_at: new Date().toISOString()
      })
    } catch { /* sunucu yazılamadı */ }
  }
  return kayit
}

/** Kullanıcıya gösterilecek tek satırlık açıklama. */
export function bakimMesaji() {
  const b = bakimDurumu()
  if (!b.acik) return ''
  return b.aciklama || BAKIM_NEDENLER.find((n) => n.id === b.neden)?.varsayilan || 'Sistemimiz geçici olarak bakımdadır.'
}

/**
 * Bakımdayken yazma yapılmasını engeller.
 * @returns {object|null} hata varsa döner, yoksa null (yazma yapılabilir)
 */
export function bakimKontrol(yazmaYapilacak) {
  if (bakimdaMi()) {
    return {
      error: 'Sistem bakımda olduğu için bu işlem şu anda yapılamıyor. ' +
        'Verileriniz güvende; bakım bitince tekrar deneyin.'
    }
  }
  return null
}