// Bildirim Merkezi — hekime ve hastaya bildirilen olaylar
//
// SORUN (eski sistem): listNotifications() yalnız randevu ve kontrol
// tarihinden HESAPLI bildirim üretiyordu. Yani:
//   - yeni kayıt talebi geldiğinde hekime bildirilmiyordu
//   - hasta röntgen/foto yüklediğinde hekime bildirilmiyordu
//   - okundu bilgisi tutulmuyordu (her açılışta aynı bildirimler)
//   - bildirim geçmişi saklanmıyordu
//
// ÇÖZÜM: Bildirimler artık KAYDEDİLİR. Olay olduğunda satır yazılır,
// hekim okur, okundu bilgisi tutulur ve geçmiş sorgulanabilir.
import { supabase, hasSupabase } from './supabase.js'
import { load, save, keys, getSession } from './store.js'
import { bakimKontrol } from './bakim.js'

// Bildirim türleri — ikon ve renk eşlemesi için tek kaynak
export const TURLER = {
  kayit_talebi: { ad: 'Kayıt Talebi', onem: 'yuksek', ikon: 'kayit' },
  randevu: { ad: 'Randevu Talebi', onem: 'normal', ikon: 'randevu' },
  foto: { ad: 'Yeni Görsel', onem: 'yuksek', ikon: 'foto' },
  belge: { ad: 'Yeni Belge', onem: 'normal', ikon: 'belge' },
  anamnez: { ad: 'Anamnez Güncellendi', onem: 'normal', ikon: 'anamnez' },
  sevk: { ad: 'Sevk Talebi', onem: 'yuksek', ikon: 'sevk' },
  kontrol: { ad: 'Kontrol Zamanı', onem: 'normal', ikon: 'kontrol' },
  randevu_bildirimi: { ad: 'Randevu Onaylandı', onem: 'normal', ikon: 'randevu' },
  // Hekim kayıt talebini kabul etti — hasta ön değerlendirme formunu dolduracak
  kabul: { ad: 'Başvurunuz Onaylandı', onem: 'yuksek', ikon: 'kabul' },
  bakim: { ad: 'Sistem Bakımı', onem: 'kritik', ikon: 'bakim' },
  gorusme: { ad: 'Görüşme Talebi', onem: 'yuksek', ikon: 'gorusme' }
}

/**
 * Bildirim üretir ve kaydeder.
 *
 * @param {object} p
 * @param {string} p.tur        TURLER anahtarlarından biri
 * @param {string} p.title      Tek satırlık başlık
 * @param {string} [p.body]     Açıklama
 * @param {string} [p.hekimId]  Bildirimin gideceği hekim (yoksa tüm hekimler)
 * @param {string} [p.hastaId]  İlgili hasta (tıklayınca hasta sayfasına gider)
 * @param {string} [p.link]     Tıklanınca gidilecek yol
 * @param {boolean} [p.onem]    true = dikkat çekici
 */
export async function bildirimOlustur({ tur, title, body = '', hekimId = null, hastaId = null, link = '', onem = null }) {
  if (!tur || !title) return { error: 'Tür ve başlık zorunlu.' }

  // Bakımdayken bildirim yazılmaz; olay kaybolmaz, bakım bitince üretilir
  const bakimHatasi = bakimKontrol('Bildirim')
  if (bakimHatasi) return bakimHatasi

  const onemDegeri = onem ?? (TURLER[tur]?.onem || 'normal')
  const satir = {
    doctor_id: hekimId,
    patient_id: hastaId,
    kind: tur,
    title,
    body,
    link: link || '',
    onem: onemDegeri,
    status: 'bekliyor',
    created_at: new Date().toISOString()
  }

  if (hasSupabase) {
    try {
      const { data, error } = await supabase.from('notifications').insert(satir).select().single()
      if (!error) return { ok: true, id: data?.id }
      // Tablo yoksa (SQL kurulmamış) tarayıcıya yaz
    } catch { /* tarayıcıya düş */ }
  }

  const mevcut = load(keys.bildirimler, [])
  mevcut.unshift({ ...satir, id: `b${Date.now()}`, okundu: false })
  save(keys.bildirimler, mevcut.slice(0, 200))
  return { ok: true, yerel: true }
}

/**
 * Bildirimleri listeler.
 * @param {object} p
 * @param {boolean} [p.sadeceOkunmamis] yalnız okunmamışlar
 * @param {number}  [p.limit]
 */
export async function listBildirimler({ sadeceOkunmamis = false, limit = 60 } = {}) {
  const hekim = getSession()
  let liste = []

  if (hasSupabase) {
    try {
      let q = supabase.from('notifications').select('*')
      // Hekimin bildirimleri: kendine ait olanlar + hekim kanalı (null)
      if (hekim?.role === 'hekim' || hekim?.role === 'admin') {
        q = q.or(`doctor_id.eq.${hekim.id},doctor_id.is.null`)
      } else if (hekim?.id) {
        q = q.eq('patient_id', hekim.id)
      }
      if (sadeceOkunmamis) q = q.neq('status', 'okundu')
      const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
      if (!error && data) {
        liste = data.map((r) => ({
          ...r,
          okundu: r.status === 'okundu' || r.status === 'kapandi'
        }))
      }
    } catch { /* tarayıcıya düş */ }
  }

  if (!liste.length) {
    // Tarayıcı kaydı (SQL kurulmamışsa veya sunucu yanıt vermediyse)
    const hepsi = load(keys.bildirimler, [])
    liste = hepsi
      .filter((b) => {
        // Oturum yoksa (yerel/demo mod) hepsini göster — hiçbir bildirim
        // sessizce kaybolmamalı. Oturum varsa role göre süzenlenir.
        if (!hekim?.id) return true
        if (hekim.role === 'hekim' || hekim.role === 'admin') {
          // Hekim kanalı (doctor_id boş) her hekime gider
          return !b.doctor_id || b.doctor_id === hekim.id || b.patient_id === hekim.id
        }
        return b.patient_id === hekim.id
      })
      .map((b) => ({ ...b, okundu: !!b.okundu }))
      .filter((b) => (sadeceOkunmamis ? !b.okundu : true))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, limit)
  }

  return liste
}

/** Okunmamış bildirim sayısı — rozet için. */
export async function okunmamisSayisi() {
  const liste = await listBildirimler({ sadeceOkunmamis: true, limit: 200 })
  return liste.length
}

/**
 * Tek bildirimi okundu işaretler.
 *
 * SUNUCU VE TARAYICI İKİSİ DE GÜNCELLENİR. Neden: veri katmanı sunucuya
 * ulaşamazsa tarayıcıya düşer. Sunucu yazımı "başarılı" dönse bile yerel
 * kopya güncellenmezse, o bildirim okunmamış görünmeye devam eder ve
 * kullanıcı aynı uyarıyı tekrar tekrar görür.
 */
export async function bildirimOkundu(id) {
  if (id === null || id === undefined) return { error: 'Bildirim yok.' }
  if (hasSupabase) {
    try {
      await supabase.from('notifications').update({ status: 'okundu' }).eq('id', id)
    } catch { /* sunucu yazılamadı — yerel kopya yine de güncellenir */ }
  }
  save(keys.bildirimler, load(keys.bildirimler, []).map((b) => (b.id === id ? { ...b, okundu: true } : b)))
  return { ok: true }
}

/** Tüm bildirimleri okundu işaretler. */
export async function tumunuOkundu() {
  const hekim = getSession()
  if (hasSupabase) {
    try {
      let q = supabase.from('notifications').update({ status: 'okundu' }).neq('status', 'okundu')
      if (hekim?.role === 'hekim' || hekim?.role === 'admin') {
        q = q.or(`doctor_id.eq.${hekim.id},doctor_id.is.null`)
      } else if (hekim?.id) {
        q = q.eq('patient_id', hekim.id)
      }
      await q
    } catch { /* sunucu yazılamadı — yerel kopya yine de güncellenir */ }
  }
  save(keys.bildirimler, load(keys.bildirimler, []).map((b) => ({ ...b, okundu: true })))
  return { ok: true }
}

/** Bildirimi siler (gürültü temizliği). */
export async function bildirimSil(id) {
  if (hasSupabase) {
    try {
      await supabase.from('notifications').delete().eq('id', id)
    } catch { /* sunucu silinemedi — yerel kopya yine de temizlenir */ }
  }
  save(keys.bildirimler, load(keys.bildirimler, []).filter((b) => b.id !== id))
  return { ok: true }
}

/** Bildirim nereye götürür? Yoksa hasta sayfasına düşer. */
export function bildirimLinki(b) {
  if (b.link) return b.link
  if (b.patient_id) return `/hekim/hasta/${b.patient_id}`
  if (b.kind === 'kayit_talebi') return '/hekim?tab=istek'
  if (b.kind === 'randevu') return '/hekim?tab=randevu'
  // Hekimin kabulü: hasta ön değerlendirme formunu dolduracak
  if (b.kind === 'kabul') return '/hastam'
  if (b.kind === 'gorusme') return b.link || '/video'
  return '/hekim'
}

/** "3 dakika önce" biçiminde göreli zaman. */
export function gecenSure(zaman) {
  if (!zaman) return ''
  const fark = Date.now() - new Date(zaman).getTime()
  const dakika = Math.floor(fark / 60000)
  if (dakika < 1) return 'az önce'
  if (dakika < 60) return `${dakika} dk önce`
  const saat = Math.floor(dakika / 60)
  if (saat < 24) return `${saat} saat önce`
  const gun = Math.floor(saat / 24)
  if (gun < 7) return `${gun} gün önce`
  return String(zaman).slice(0, 10)
}