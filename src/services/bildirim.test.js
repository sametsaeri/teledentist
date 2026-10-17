// Bildirim Merkezi testleri
//
// SORUN (eski sistem): listNotifications() yalnız randevu ve kontrol
// tarihinden hesaplanıyordu. Yeni kayıt talebi, hasta yüklediği görsel
// veya kritik anamnez hekime BİLDİRİLMEZDI ve okundu bilgisi tutulmazdı.
// Bu testler, bildirimin gerçekten ÜRETİLDİĞİNİ ve OKUNDUĞUNU zorunlu kılar.
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../services/supabase.js', async () => {
  const { supabaseMock } = await import('../test/supabase-mock.js')
  return supabaseMock()
})

import {
  bildirimOlustur, listBildirimler, bildirimOkundu, tumunuOkundu,
  bildirimSil, okunmamisSayisi, bildirimLinki, gecenSure, TURLER
} from '../services/bildirim.js'
import { bakimAc } from '../services/bakim.js'

beforeEach(() => {
  localStorage.clear()
})

const ORNEK = {
  tur: 'kayit_talebi',
  title: 'Elif Yıldırım kayıt talebi gönderdi',
  body: 'elif@test.com · Hasta',
  link: '/hekim?tab=istek'
}

describe('bildirimOlustur — olay bildirimi üretilir', () => {
  it('başarılı kayıt yapar', async () => {
    const r = await bildirimOlustur(ORNEK)
    expect(r.error).toBeUndefined()
    expect(r.ok).toBe(true)
  })

  it('tür ve başlık zorunludur', async () => {
    expect((await bildirimOlustur({ title: 'Başlıksız' })).error).toBeTruthy()
    expect((await bildirimOlustur({ tur: 'randevu' })).error).toBeTruthy()
  })

  it('bildirim listelenebilir olur', async () => {
    await bildirimOlustur(ORNEK)
    const liste = await listBildirimler()
    expect(Array.isArray(liste)).toBe(true)
    expect(liste.length).toBeGreaterThan(0)
  })

  it('BAKIMDA bildirim yazılmaz (veri bozulmasın)', async () => {
    bakimAc({ neden: 'veritabani' })
    const r = await bildirimOlustur(ORNEK)
    expect(r.error).toBeTruthy()
    expect(r.error).toMatch(/bakım/i)
  })
})

describe('TURLER — desteklenen bildirim türleri', () => {
  it('kayıt talebi, görsel, anamnez, sevk ve randevu TÜRLERİ tanımlı', () => {
    // Bu türler olmadan hekim olaylardan haberdar olamaz
    expect(TURLER.kayit_talebi).toBeTruthy()
    expect(TURLER.foto).toBeTruthy()
    expect(TURLER.belge).toBeTruthy()
    expect(TURLER.anamnez).toBeTruthy()
    expect(TURLER.sevk).toBeTruthy()
    expect(TURLER.randevu).toBeTruthy()
    expect(TURLER.randevu_bildirimi).toBeTruthy()
  })

  it('her türün okunabilir adı ve önemi var', () => {
    for (const t of Object.values(TURLER)) {
      expect(t.ad).toBeTruthy()
      expect(['normal', 'yuksek', 'kritik']).toContain(t.onem)
    }
  })

  it('kayıt talebi ve sevk YÜKSEK önceliklidir (gecikmemeli)', () => {
    expect(TURLER.kayit_talebi.onem).toBe('yuksek')
    expect(TURLER.sevk.onem).toBe('yuksek')
    expect(TURLER.foto.onem).toBe('yuksek')
  })
})

describe('okundu takibi — bildirimler tekrar tekrar gösterilmez', () => {
  it('yeni bildirim okunmamış sayılır', async () => {
    await bildirimOlustur(ORNEK)
    expect(await okunmamisSayisi()).toBeGreaterThan(0)
  })

  it('okundu işaretlenince sayı azalır', async () => {
    await bildirimOlustur(ORNEK)
    const ilkSayi = await okunmamisSayisi()
    const liste = await listBildirimler()
    await bildirimOkundu(liste[0].id)
    expect(await okunmamisSayisi()).toBe(ilkSayi - 1)
  })

  it('okunmamış filtresi çalışır', async () => {
    await bildirimOlustur({ ...ORNEK, title: 'Birinci' })
    const liste = await listBildirimler()
    await bildirimOkundu(liste[0].id)
    const okunmamis = await listBildirimler({ sadeceOkunmamis: true })
    expect(okunmamis.some((b) => b.title === 'Birinci')).toBe(false)
  })

  it('tümünü okundu işaretleme çalışır', async () => {
    await bildirimOlustur({ ...ORNEK, title: 'Birinci' })
    await bildirimOlustur({ ...ORNEK, title: 'İkinci' })
    await tumunuOkundu()
    expect(await okunmamisSayisi()).toBe(0)
  })

  it('olmayan id hata döndürür, çökmez', async () => {
    expect((await bildirimOkundu(null)).error).toBeTruthy()
    expect((await bildirimOkundu(undefined)).error).toBeTruthy()
  })

  it('bildirim silinebilir (gürültü temizliği)', async () => {
    await bildirimOlustur(ORNEK)
    const liste = await listBildirimler()
    await bildirimSil(liste[0].id)
    const sonra = await listBildirimler()
    expect(sonra.length).toBe(liste.length - 1)
  })
})

describe('bildirimLinki — tıklayınca doğru yere gider', () => {
  it('verilen link varsa o kullanılır', () => {
    expect(bildirimLinki({ link: '/hekim?tab=istek' })).toBe('/hekim?tab=istek')
  })

  it('hasta varsa hasta sayfasına gider', () => {
    expect(bildirimLinki({ patient_id: 'p1' })).toBe('/hekim/hasta/p1')
  })

  it('kayıt talebi bildirimi kayıt sayfasına gider', () => {
    expect(bildirimLinki({ kind: 'kayit_talebi' })).toBe('/hekim?tab=istek')
  })

  it('randevu bildirimi randevu sekmesine gider', () => {
    expect(bildirimLinki({ kind: 'randevu' })).toBe('/hekim?tab=randevu')
  })

  it('hiçbir ipucu yoksa ana panele düşer (kırık bağlantı olmaz)', () => {
    expect(bildirimLinki({ kind: 'bilinmeyen' })).toBe('/hekim')
    expect(bildirimLinki({})).toBe('/hekim')
  })
})

describe('gecenSure — göreli zaman okunabilir', () => {
  it('taze bildirim "az önce" der', () => {
    expect(gecenSure(new Date().toISOString())).toBe('az önce')
  })

  it('dakika/saat/gün biçiminde özetler', () => {
    expect(gecenSure(new Date(Date.now() - 5 * 60000).toISOString())).toBe('5 dk önce')
    expect(gecenSure(new Date(Date.now() - 3 * 3600000).toISOString())).toBe('3 saat önce')
    expect(gecenSure(new Date(Date.now() - 2 * 86400000).toISOString())).toBe('2 gün önce')
  })

  it('eski bildirimde tarih gösterir', () => {
    const eski = new Date(Date.now() - 30 * 86400000).toISOString()
    expect(gecenSure(eski)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('zaman yoksa boş döner (boş metin satırı oluşmaz)', () => {
    expect(gecenSure(null)).toBe('')
    expect(gecenSure(undefined)).toBe('')
  })
})

// REGRESYON: bu bağlantılar olmadan hekim olayları göremez.
describe('olay bağlantıları — hekime ulaşır', () => {
  it('kayıt talebi gönderimi bildirim üretir', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/services/auth.js', 'utf8')
    const adet = (kod.match(/bildirimOlustur/g) || []).length
    // RPC yolunda bildirim üretilir (auth.signUp yolu kaldırıldı)
    expect(adet).toBeGreaterThanOrEqual(1)
  })

  it('dosya yükleme bildirimi yalnız HASTA yüklüyorsa üretilir', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/services/db.js', 'utf8')
    expect(kod).toMatch(/hastaYukledi/)
    expect(kod).toMatch(/\['hasta', 'ebeveyn'\]\.includes/)
  })

  it('randevu talebi hekime bildirilir', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/services/db.js', 'utf8')
    const bolum = kod.split('export async function insertAppointment')[1]?.split('export')[0] || ''
    expect(bolum).toContain('bildirimOlustur')
    expect(bolum).toMatch(/tur:\s*'randevu'/)
  })

  it('randevu ONAYLANDIĞINDA hastaya bildirilir', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/services/db.js', 'utf8')
    expect(kod).toMatch(/randevuOnayBildirimi/)
    expect(kod).toMatch(/tur:\s*'randevu_bildirimi'/)
  })

  it('sevk hedef hekime bildirilir', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/services/db.js', 'utf8')
    const bolum = kod.split('export async function referPatient')[1]?.split('export')[0] || ''
    expect(bolum).toContain('bildirimOlustur')
    expect(bolum).toMatch(/tur:\s*'sevk'/)
  })

  it('KRİTİK anamnez hekime bildirilir (sade riskli durumda)', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/AnamnezForm.jsx', 'utf8')
    expect(kod).toMatch(/if \(riskli\.length\)/)
    expect(kod).toMatch(/tur:\s*'anamnez'/)
  })
})

describe('bildirim arayüzü — kullanıcıya gösterilir', () => {
  it('zil rozeti OKUNMAMIŞ sayısını gösterir', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/BildirimMerkezi.jsx', 'utf8')
    expect(kod).toContain('bell-count')
    expect(kod).toContain('okunmamisSayisi')
  })

  it('"tümünü okundu işaretle" eylemi vardır', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/BildirimMerkezi.jsx', 'utf8')
    expect(kod).toMatch(/Tümünü okundu işaretle/)
    expect(kod).toContain('tumunuOkundu')
  })

  it('okunmamış / tümü sekmeleri vardır', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/BildirimMerkezi.jsx', 'utf8')
    expect(kod).toMatch(/Okunmamış \(/)
    expect(kod).toMatch(/Tümü \(/)
  })

  it('bildirim tam sayfa rotası tanımlı', async () => {
    const fs = await import('node:fs')
    const app = fs.readFileSync('src/App.jsx', 'utf8')
    expect(app).toContain('path="/bildirimler"')
    expect(app).toContain('BildirimMerkezi')
  })

  it('her rol bildirim merkezine erişebilir (hekim ve hasta farklı görür)', async () => {
    const fs = await import('node:fs')
    const app = fs.readFileSync('src/App.jsx', 'utf8')
    expect(app).toMatch(/roles=\{\['hekim', 'admin', 'hasta', 'ebeveyn'/)
  })

  it('bildirim menüsü hekim ve hasta menüsünde bulunur', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/PanelLayout.jsx', 'utf8')
    expect((kod.match(/'\/bildirimler'/g) || []).length).toBeGreaterThanOrEqual(3)
  })

  it('SQL kurulumu yeni bildirim kolonlarını ekler', async () => {
    const fs = await import('node:fs')
    const sql = fs.readFileSync('db/migration_arsiv_kvkk.sql', 'utf8')
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS link/)
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS onem/)
    expect(sql).toContain('notif_hasta_oku')
  })

  it('mobilde bildirim satırı tam genişlik olur', async () => {
    const fs = await import('node:fs')
    const css = fs.readFileSync('src/index.css', 'utf8')
    const bas = css.indexOf('BİLDİRİM MERKEZİ')
    expect(bas).toBeGreaterThan(-1)
    expect(css.slice(bas)).toMatch(/bildirim-satir/)
  })
})