// Diş Geleceği Simülatörü — klinik ilerleme motoru testleri
// TÜBİTAK sunumunda "bu tahmin mi, kural mı?" sorusunu kanıtlar.
import { describe, it, expect } from 'vitest'
import { senaryolar, acilDişler, paraTL, maliyetMetni, UCRETLER } from '../ai/prognos.js'
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

  it('gecikme senaryosunun maliyeti hiçbir zaman düşmez', () => {
    const durumlar = ['saglam', 'dolgu', 'kanal', 'kaplama', 'takip', 'implant', 'cekim']
    for (const s of durumlar) {
      const r = senaryolar({ fdi: 16, status: s, plaque: 1, yas: 30 })
      const [hemen, gecik, hic] = r.senaryolar
      expect(gecik.maliyet.max, `${s}: gecikenin maliyeti düşmemeli`).toBeGreaterThanOrEqual(hemen.maliyet.max)
      expect(hic.maliyet.max, `${s}: müdahalesiz maliyet düşmemeli`).toBeGreaterThanOrEqual(gecik.maliyet.max)
      expect(gecik.maliyet.seans).toBeGreaterThanOrEqual(hemen.maliyet.seans)
    }
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

describe('Para biçimi', () => {
  it('binlik ayırımlı kısa biçim üretir', () => {
    expect(paraTL(500)).toBe('500')
    expect(paraTL(1800)).toBe('2B')
    expect(paraTL(12500)).toBe('13B')
    expect(paraTL(0)).toBe('—')
  })

  it('maliyet aralığını okunur biçimde yazar', () => {
    expect(maliyetMetni({ min: 1800, max: 5000 })).toContain('–')
    expect(maliyetMetni({ min: 1800, max: 5000 })).toContain('bin ₺')
  })

  it('her ücret tanımı tutarlı', () => {
    for (const [k, u] of Object.entries(UCRETLER)) {
      expect(u.ad, k).toBeTruthy()
      expect(u.min, k).toBeGreaterThanOrEqual(0)
      expect(u.max, k).toBeGreaterThanOrEqual(u.min)
      expect(u.seans, k).toBeGreaterThanOrEqual(1)
    }
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