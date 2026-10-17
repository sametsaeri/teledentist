// Diş Geleceği Simülatörü — klinik ilerleme motoru testleri
// TÜBİTAK sunumunda "bu tahmin mi, kural mı?" sorusunu kanıtlar.
import { describe, it, expect } from 'vitest'
import { senaryolar, acilDişler, seansMetni, ISLEMLER } from '../ai/prognos.js'
import fs from 'node:fs'
import { disBilgisi, kontrolAraligi, UST_SIRA, ALT_SIRA } from '../data/disAdlari.js'

const YENI = { fdi: 16, status: 'dolgu', plaque: 1, yas: 30 }

describe('senaryolar — her diş için üç senaryo üretir', () => {
  it('tam olarak üç senaryo döner', () => {
    const r = senaryolar(YENI)
    expect(r.senaryolar).toHaveLength(3)
    expect(r.senaryolar[0].baslik).toContain('Şimdi')
    expect(r.senaryolar[1].baslik).toContain('geciktirirsem')
    expect(r.senaryolar[2].baslik).toContain('Hiç')
  })

  it('gecikme senaryosu daima daha kötüdür (kural tutarlılığı)', () => {
    const durumlar = ['saglam', 'dolgu', 'kanal', 'kaplama', 'takip', 'implant', 'cekim']
    for (const s of durumlar) {
      const r = senaryolar({ fdi: 16, status: s, plaque: 1, yas: 30 })
      const [hemen, gecik, hic] = r.senaryolar
      expect(gecik.agirPuan, `${s}: gecikme ağrı riski artmalı`).toBeGreaterThanOrEqual(hemen.agirPuan)
      expect(hic.agirPuan, `${s}: müdahalesiz risk gecikmeden az olmamalı`).toBeGreaterThanOrEqual(gecik.agirPuan)
      expect(gecik.kayipRiski).toBeGreaterThanOrEqual(hemen.kayipRiski)
      expect(hic.kayipRiski).toBeGreaterThanOrEqual(gecik.kayipRiski)
    }
  })

  it('gecikme senaryosunun seans sayısı hiçbir zaman düşmez', () => {
    const durumlar = ['saglam', 'dolgu', 'kanal', 'kaplama', 'takip', 'implant', 'cekim']
    for (const s of durumlar) {
      const r = senaryolar({ fdi: 16, status: s, plaque: 1, yas: 30 })
      const [hemen, gecik, hic] = r.senaryolar
      // Ücret karşılaştırması kaldırıldı (devlet projesi, belirlenmiş fiyat yok)
      expect(gecik.seans, `${s}: gecikenin seansı düşmemeli`).toBeGreaterThanOrEqual(hemen.seans)
      expect(hic.seans, `${s}: müdahalesiz seans düşmemeli`).toBeGreaterThanOrEqual(gecik.seans)
    }
  })

  // REGRESYON: devlet projesidir; belirlenmiş ücret YOKTUR.
  it('senaryoda ÜCRET bilgisi YOKTUR', () => {
    const r = senaryolar({ fdi: 16, status: 'kanal', plaque: 2, yas: 40 })
    for (const s of r.senaryolar) {
      expect(s.maliyet, 'senaryo ücret içermemeli').toBeUndefined()
      expect(s.min).toBeUndefined()
      expect(s.max).toBeUndefined()
      expect(s.seans, 'seans bilgisi OLMALI').toBeGreaterThan(0)
    }
    // Karşılaştırma tablosunda da ücret satırı bulunmamalı
    const etiketler = r.karsilastirma.map((k) => k.etiket)
    expect(etiketler.some((e) => /maliyet|fiyat|ücret/i.test(e))).toBe(false)
    expect(etiketler).toContain('Toplam seans')
  })

  it('ağrı olasılığı ve kayıp riski 0-100 arasında', () => {
    const r = senaryolar({ fdi: 11, status: 'kanal', plaque: 3, yas: 70 })
    for (const s of r.senaryolar) {
      expect(s.agirPuan).toBeGreaterThanOrEqual(0)
      expect(s.agirPuan).toBeLessThanOrEqual(100)
      expect(s.kayipRiski).toBeGreaterThanOrEqual(0)
      expect(s.kayipRiski).toBeLessThanOrEqual(100)
    }
  })

  it('risk faktörü (yüksek plak / yaş) süreci hızlandırır', () => {
    const dusuk = senaryolar({ fdi: 16, status: 'dolgu', plaque: 0, yas: 25 })
    const yuksek = senaryolar({ fdi: 16, status: 'dolgu', plaque: 3, yas: 70 })
    expect(yuksek.riskKaydir).toBeGreaterThan(dusuk.riskKaydir)
    expect(yuksek.senaryolar[2].agirPuan).toBeGreaterThan(dusuk.senaryolar[2].agirPuan)
  })

  it('adımlar zaman sırasına göre artar', () => {
    const r = senaryolar(YENI)
    for (const s of r.senaryolar) {
      const aylar = s.adimlar.map((a) => a.ay)
      for (let i = 1; i < aylar.length; i++) expect(aylar[i]).toBeGreaterThanOrEqual(aylar[i - 1])
      expect(s.adimlar[0].ay).toBe(0)
    }
  })

  it('her adım anlatım ve risk notu içerir (boş metin yok)', () => {
    const durumlar = ['saglam', 'dolgu', 'kanal', 'kaplama', 'takip', 'implant', 'cekim']
    for (const d of durumlar) {
      const r = senaryolar({ fdi: 16, status: d })
      for (const s of r.senaryolar) {
        for (const a of s.adimlar) {
          expect(a.baslik.length, `${d}: adım başlığı`).toBeGreaterThan(3)
          expect(a.anlatim.length, `${d}: adım anlatımı`).toBeGreaterThan(30)
          expect(a.riskNotu.length, `${d}: adım risk notu`).toBeGreaterThan(10)
          expect(a.evre).toBeGreaterThanOrEqual(0)
          expect(a.evre).toBeLessThanOrEqual(5)
        }
      }
    }
  })

  it('senaryolar diş bilgisini de taşır', () => {
    const r = senaryolar({ fdi: 36 })
    expect(r.dis.no).toBe(36)
    expect(r.dis.tamAd).toContain('Sol Alt')
  })

  it('bilinmeyen durumda çökmez, sağlam kuralına düşer', () => {
    const r = senaryolar({ fdi: 16, status: 'boyle-bir-durum-yok' })
    expect(r.senaryolar).toHaveLength(3)
    expect(r.senaryolar[0].adimlar[0].baslik).toContain('sağlıklı')
  })

  it('karşılaştırma tablosu dört satır içerir', () => {
    const r = senaryolar(YENI)
    expect(r.karsilastirma).toHaveLength(4)
    r.karsilastirma.forEach((k) => {
      expect(k.etiket).toBeTruthy()
      expect(k.degerler).toHaveLength(3)
    })
  })

  it('girdi yoksa da çalışır (bozuk veri koruması)', () => {
    expect(() => senaryolar()).not.toThrow()
    expect(senaryolar().senaryolar).toHaveLength(3)
  })
})

describe('acilDişler — en acil dişleri öne çıkarır', () => {
  it('sağlam ve çekilmiş dişleri listelemez', () => {
    const liste = acilDişler({ 11: { status: 'saglam' }, 21: { status: 'cekim' }, 16: { status: 'dolgu' } })
    expect(liste).toHaveLength(1)
    expect(liste[0].fdi).toBe(16)
  })

  it('acil olmayan dişleri öne alır (en riskli diş başta)', () => {
    const liste = acilDişler({
      16: { status: 'dolgu' },
      26: { status: 'kanal' },
      36: { status: 'takip' }
    })
    expect(liste.length).toBe(3)
    for (let i = 1; i < liste.length; i++) expect(liste[i - 1].aciliyet).toBeGreaterThanOrEqual(liste[i].aciliyet)
    // Tedavisiz dolgu, ilerlemiş çürük evresine kadar gittiği için en acil olan odur
    expect(liste[0].fdi).toBe(16)
    expect(liste[0].status).toBe('dolgu')
  })

  it('boş diş verisinde boş liste döner', () => {
    expect(acilDişler({})).toEqual([])
    expect(acilDişler()).toEqual([])
  })
})

describe('İşlem süreleri — ücretsiz planlama', () => {
  it('seans sayısını okunur biçimde yazar', () => {
    expect(seansMetni(1)).toBe('1 seans')
    expect(seansMetni(3)).toBe('3 seans')
    expect(seansMetni(0)).toBe('—')
  })

  it('her işlem tanımı tutarlı ve ÜCRETSİZ', () => {
    for (const [k, i] of Object.entries(ISLEMLER)) {
      expect(i.ad, k).toBeTruthy()
      expect(i.seans, k).toBeGreaterThanOrEqual(1)
      expect(i.sure, k).toBeTruthy()
      // Devlet projesidir: ücret alanı hiçbir işlemde bulunmamalı
      expect(i.min, `${k} ücret içermemeli`).toBeUndefined()
      expect(i.max, `${k} ücret içermemeli`).toBeUndefined()
      expect(i.price, `${k} ücret içermemeli`).toBeUndefined()
    }
  })
})

// REGRESYON: bu proje devlet projesidir ve devlet tarafından belirlenmiş
// bir fiyat/ücret listesi YOKTUR. Ücret göstermek yanıltıcıdır.
// REGRESYON: kurulum betikleri username'i ŞARTSIZ yazıyordu. Betik her
// çalıştırıldığında kullanıcının panelden değiştirdiği kullanıcı adı geri
// alınıyor ve kullanıcı "Bu kullanıcı adı bulunamadı" hatası alıyordu.
// Kurulum betikleri IDEMPOTENT olmalıdır: var olan veriyi değiştirmemeli.
describe('KURULUM BETİKLERİ idempotent olmalı (kullanıcı adını ezmemeli)', () => {
  const DOSYALAR = [
    'db/migration_users.sql',
    'db/KURULUM_HESAPLAR.sql',
    'db/SUPABASE_SETUP.sql'
  ]

  it('her betikte username ataması YALNIZCA boşsa çalışır', () => {
    for (const f of DOSYALAR) {
      const sql = fs.readFileSync(f, 'utf8')
      const atamalar = sql.split('SET username')[1] || ''
      // Her "SET username" ifadesinden sonraki WHERE koşulu boş kontrol içermeli
      const kosullar = sql.match(/SET username = 'resulyel'[\s\S]*?;/g) || []
      expect(kosullar.length, f).toBeGreaterThan(0)
      for (const k of kosullar) {
        expect(k, `${f}: username şartsız yazılıyor — mevcut kullanıcı adı ezilir`)
          .toMatch(/username IS NULL OR username = ''/)
      }
    }
  })
})

describe('DEVLET PROJESİ KURALI — hiçbir yerde ücret gösterilmez', () => {
  const KAYNAKLAR = [
    'src/ai/prognos.js',
    'src/components/DisGelecek.jsx',
    'src/pages/DoctorModules.jsx',
    'src/pages/Portal.jsx',
    'src/components/PanelLayout.jsx'
  ]

  it('ücret tabloları ve para birimi kaldırılmıştır', () => {
    for (const f of KAYNAKLAR) {
      const kod = fs.readFileSync(f, 'utf8')
      expect(kod, `${f}: UCRETLER tanımlı olmamalı`).not.toContain('UCRETLER')
      expect(kod, `${f}: paraTL kullanılmamalı`).not.toContain('paraTL')
      expect(kod, `${f}: maliyetMetni kullanılmamalı`).not.toContain('maliyetMetni')
      expect(kod, `${f}: "bin ₺" gösterilmemeli`).not.toContain('bin ₺')
    }
  })

  it('hekim panelinde Fiyatlandırma ve Hesap sekmeleri YOKTUR', () => {
    const portal = fs.readFileSync('src/pages/Portal.jsx', 'utf8')
    const layout = fs.readFileSync('src/components/PanelLayout.jsx', 'utf8')
    for (const kod of [portal, layout]) {
      expect(kod).not.toMatch(/tab=fiyat/)
      expect(kod).not.toMatch(/tab=hesap/)
      expect(kod).not.toContain('Fiyatlandırma')
      expect(kod).not.toContain('Hesap ve Bakiye')
    }
  })

  it('yerine Tedavi Süreleri modülü vardır', () => {
    expect(fs.readFileSync('src/pages/Portal.jsx', 'utf8')).toContain("tab === 'sure'")
    expect(fs.readFileSync('src/pages/Portal.jsx', 'utf8')).toContain('TedaviSureleri')
    expect(fs.readFileSync('src/components/PanelLayout.jsx', 'utf8')).toContain("['/hekim?tab=sure', Clock, 'Tedavi Süreleri']")
    expect(fs.readFileSync('src/pages/DoctorModules.jsx', 'utf8')).toContain('export function TedaviSureleri')
  })

  it('modül ücret bilgisi sunmaz, bunu kullanıcıya da söyler', () => {
    const kod = fs.readFileSync('src/pages/DoctorModules.jsx', 'utf8')
    const bolum = kod.split('export function TedaviSureleri')[1]?.split('/* ====')[0] || ''
    expect(bolum).toMatch(/devlet projes/i)
    expect(bolum).not.toContain('₺')
  })

  it('hasta panelinde ücret gösterilmez', () => {
    const kod = fs.readFileSync('src/pages/PatientPanel.jsx', 'utf8')
    expect(kod).not.toContain('₺')
    expect(kod).not.toMatch(/fiyat|ücret/i)
  })
})

describe('disAdlari — FDI adlandırma', () => {
  it('32 dişin tamamı tanımlı', () => {
    const hepsi = [...UST_SIRA, ...ALT_SIRA]
    expect(hepsi).toHaveLength(32)
    for (const n of hepsi) {
      const b = disBilgisi(n)
      expect(b, `${n} tanımsız`).toBeTruthy()
      expect(b.tamAd.length, `${n} adı`).toBeGreaterThan(8)
      expect(b.tip, `${n} tipi`).toBeTruthy()
      expect(b.tip.yuzey.length, `${n} yüzey bilgisi`).toBeGreaterThan(2)
    }
  })

  it('geçersiz numara null döner', () => {
    expect(disBilgisi(0)).toBeNull()
    expect(disBilgisi(99)).toBeNull()
    expect(disBilgisi('abc')).toBeNull()
  })

  it('çeyre yönü doğru', () => {
    expect(disBilgisi(16).tamAd).toContain('Sağ Üst')
    expect(disBilgisi(26).tamAd).toContain('Sol Üst')
    expect(disBilgisi(36).tamAd).toContain('Sol Alt')
    expect(disBilgisi(46).tamAd).toContain('Sağ Alt')
    expect(disBilgisi(18).yirmiYas).toBe(true)
  })

  it('kontrol aralığı duruma göre değişir', () => {
    expect(kontrolAraligi('kanal').ay).toBe(3)
    expect(kontrolAraligi('takip').ay).toBe(3)
    expect(kontrolAraligi('dolgu').ay).toBe(6)
    expect(kontrolAraligi('saglam').ay).toBe(12)
  })
})