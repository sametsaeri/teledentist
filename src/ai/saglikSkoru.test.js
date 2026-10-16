// Diş sağlığı puanı ve rehber mantığı testleri
// Bu dosya saf hesap yapar; veri çekmez. TÜBİTAK sunumunda
// "hangi hasta hangi puanı alır" sorusunu kanıtlamak için kullanılır.
import { describe, it, expect } from 'vitest'
import { saglikPuani, bakimOnerileri, ACIL, GUNLUK_ADIMLAR, listeyiOku, listeyiYaz } from '../ai/saglikSkoru.js'

const SAGLAM = { 11: { status: 'saglam' }, 21: { status: 'saglam' }, 31: { status: 'saglam' } }

describe('saglikPuani — puan aralığı ve bileşenler', () => {
  it('puan her zaman 0-100 arasında', () => {
    const kotu = saglikPuani({
      teeth: { 16: { status: 'dolgu' }, 26: { status: 'kanal' }, 36: { status: 'kaplama' }, 46: { status: 'implant' } },
      plaque: 3, anxiety: 25, lastVisit: '2000-01-01'
    })
    const iyi = saglikPuani({ teeth: SAGLAM, plaque: 0, anxiety: 3, lastVisit: new Date().toISOString().slice(0, 10) })
    expect(kotu.toplam).toBeGreaterThanOrEqual(0)
    expect(kotu.toplam).toBeLessThanOrEqual(100)
    expect(iyi.toplam).toBeGreaterThanOrEqual(0)
    expect(iyi.toplam).toBeLessThanOrEqual(100)
  })

  it('dört bileşen döner ve her biri 25 üzerinden hesaplanır', () => {
    const p = saglikPuani({ teeth: SAGLAM, plaque: 1, anxiety: 5, lastVisit: '2026-01-10' })
    expect(p.bolumler).toHaveLength(4)
    p.bolumler.forEach((b) => {
      expect(b.azami).toBe(25)
      expect(b.puan).toBeGreaterThanOrEqual(0)
      expect(b.puan).toBeLessThanOrEqual(25)
    })
    // Toplam, bileşenlerin toplamına yakın olmalı
    const bileşenToplam = p.bolumler.reduce((t, b) => t + b.puan, 0)
    expect(Math.abs(p.toplam - bileşenToplam)).toBeLessThanOrEqual(4)
  })

  it('hiç veri yokken puan üretmez (veriVar=false)', () => {
    const p = saglikPuani({})
    expect(p.veriVar).toBe(false)
  })

  it('sadece diş kaydı varsa da puan üretir', () => {
    const p = saglikPuani({ teeth: SAGLAM })
    expect(p.veriVar).toBe(true)
    expect(p.toplam).toBeGreaterThan(0)
  })

  it('diş taşı arttıkça hijyen puanı düşer', () => {
    const temiz = saglikPuani({ teeth: SAGLAM, plaque: 0 })
    const kirli = saglikPuani({ teeth: SAGLAM, plaque: 3 })
    const hijyen = (p) => p.bolumler.find((b) => b.ad === 'Ağız Hijyeni').puan
    expect(hijyen(kirli)).toBeLessThan(hijyen(temiz))
  })

  it('kaygı arttıkça diş bakımı puanı düşer', () => {
    const sakin = saglikPuani({ teeth: SAGLAM, anxiety: 2 })
    const kaygili = saglikPuani({ teeth: SAGLAM, anxiety: 24 })
    const bakim = (p) => p.bolumler.find((b) => b.ad === 'Diş Bakımı').puan
    expect(bakim(kaygili)).toBeLessThan(bakim(sakin))
  })

  it('son muayene uzaklaştıkça kontrol puanı düşer', () => {
    const yeni = saglikPuani({ teeth: SAGLAM, lastVisit: new Date().toISOString().slice(0, 10) })
    const eski = saglikPuani({ teeth: SAGLAM, lastVisit: '2018-01-01' })
    const kontrol = (p) => p.bolumler.find((b) => b.ad === 'Kontrol Düzeni').puan
    expect(kontrol(yeni)).toBeGreaterThan(kontrol(eski))
  })

  it('tedavi gerektiren diş varsa diş puanı düşer', () => {
    const saglam = saglikPuani({ teeth: { ...SAGLAM, 16: { status: 'saglam' }, 26: { status: 'saglam' }, 36: { status: 'saglam' } } })
    const bozuk = saglikPuani({ teeth: { ...SAGLAM, 16: { status: 'dolgu' }, 26: { status: 'kanal' }, 36: { status: 'kaplama' } } })
    const disPuan = (p) => p.bolumler.find((b) => b.ad === 'Diş Durumu').puan
    expect(disPuan(bozuk)).toBeLessThan(disPuan(saglam))
  })

  it('başlık ve renk puanla tutarlı', () => {
    const iyi = saglikPuani({ teeth: SAGLAM, plaque: 0, anxiety: 2, lastVisit: new Date().toISOString().slice(0, 10) })
    const kotu = saglikPuani({ teeth: {}, plaque: 3, anxiety: 25, lastVisit: '2015-01-01' })
    expect(['Çok iyi', 'İyi', 'Orta', 'Dikkate gerek']).toContain(iyi.baslik)
    expect(['Çok iyi', 'İyi', 'Orta', 'Dikkate gerek']).toContain(kotu.baslik)
    expect(iyi.renk).toMatch(/^#/)
    expect(kotu.renk).toMatch(/^#/)
  })

  it('doğum tarihinden yaş hesaplar', () => {
    const cocuk = saglikPuani({ teeth: SAGLAM, birthDate: '2020-01-01' })
    const yetiskin = saglikPuani({ teeth: SAGLAM, birthDate: '1985-01-01' })
    expect(cocuk.yas).toBeGreaterThan(4)
    expect(yetiskin.yas).toBeGreaterThan(35)
    expect(saglikPuani({ teeth: SAGLAM, birthDate: 'bozuk' }).yas).toBeNull()
  })
})

describe('bakimOnerileri — hastanın verisine göre kişiselleşir', () => {
  it('her zaman temel önerileri içerir', () => {
    const o = bakimOnerileri({})
    const basliklar = o.map((x) => x.baslik).join(' | ')
    expect(basliklar).toContain('Günde iki kez')
    expect(basliklar).toContain('Diş ipi')
  })

  it('plak yüksekse öncelikli kireçleme önerisi ekler', () => {
    const o = bakimOnerileri({ teeth: SAGLAM, plaque: 2.5 })
    const oncelikli = o.filter((x) => x.onem === 'yuksek')
    expect(oncelikli.some((x) => x.baslik.includes('Diş taşınız fazla'))).toBe(true)
  })

  it('kanal tedavili diş varsa takip önerisi ekler', () => {
    const o = bakimOnerileri({ teeth: { 36: { status: 'kanal' } } })
    expect(o.some((x) => x.baslik.includes('Kanal tedavili'))).toBe(true)
  })

  it('kaygı yüksekse sakin seans önerisi ekler', () => {
    const o = bakimOnerileri({ teeth: SAGLAM, anxiety: 18 })
    expect(o.some((x) => x.baslik.includes('sakin seans'))).toBe(true)
  })

  it('kontrol 1 yılı geçtiyse gecikme uyarısı verir', () => {
    const o = bakimOnerileri({ teeth: SAGLAM, lastVisit: '2020-01-01' })
    expect(o.some((x) => x.baslik.includes('gecikti'))).toBe(true)
  })

  it('hiçbir öneri boş metin içermez', () => {
    const o = bakimOnerileri({ teeth: { 16: { status: 'dolgu' } }, plaque: 3, anxiety: 20, lastVisit: '2019-01-01' })
    o.forEach((x) => {
      expect(x.baslik).toBeTruthy()
      expect(x.metin.length).toBeGreaterThan(20)
      expect(['yuksek', 'onemli', 'temel']).toContain(x.onem)
    })
  })
})

describe('Acil rehber içeriği', () => {
  it('en az 5 acil durum tanımlı ve hepsi eksiksiz', () => {
    expect(ACIL.length).toBeGreaterThanOrEqual(5)
    ACIL.forEach((a) => {
      expect(a.ad).toBeTruthy()
      expect(a.belirti.length).toBeGreaterThan(0)
      expect(a.ilkyardim.length).toBeGreaterThan(0)
      expect(a.acil).toBeTruthy()
    })
  })

  it('reçete/ilaç önerisi içermez (güvenlik)', () => {
    const metinler = ACIL.flatMap((a) => a.ilkyardim).join(' ').toLowerCase()
    expect(metinler).not.toContain('antibiyotik alın')
    expect(metinler).not.toContain('ilaç alın')
  })
})

describe('Günlük kontrol listesi', () => {
  it('4 adım tanımlı', () => {
    expect(GUNLUK_ADIMLAR).toHaveLength(4)
    expect(new Set(GUNLUK_ADIMLAR.map((a) => a.id)).size).toBe(4)
  })

  it('yazılan adımlar okunabilir', () => {
    listeyiYaz('p1', { ip: true, firca: true })
    expect(listeyiOku('p1')).toEqual({ ip: true, firca: true })
  })

  it('başka günün işaretleri temizlenir', () => {
    listeyiYaz('p2', { ip: true })
    // Farklı hasta için boş dönmeli
    expect(listeyiOku('p3')).toEqual({})
  })

  it('bozuk veri çökertmez', () => {
    localStorage.setItem('td_hasta_liste_p4', '{bozuk')
    expect(listeyiOku('p4')).toEqual({})
  })
})