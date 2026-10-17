// Ön Değerlendirme (Pre-Anamnez) Asistanı — testler
//
// GÜVENLİK TESTLERİ ÖNCELİKLİDİR:
//   1) KIRMIZI BAYRAK TESPİTİ — acil durum kaçırılmamalı
//   2) TEŞHİS KONULMAMASI — asistan tanı/reçete yazmamalı
//   3) TETİKLEME KURALI — hekim onayı olmadan süreç başlamamalı
//   4) VERİ KAYBI — cevaplar kaydedilmeli, kaldığı yerden devam etmeli

import { describe, it, expect, beforeEach } from 'vitest'
import fs from 'node:fs'
import {
  ADIMLAR, SAGLIK_SECENEKLERI, ALISKANLIK_SORULARI, ILAC_RISKLERI, KIRMIZI_BAYRAKLAR,
  kirmiziBayraklariBul, acilDurumVar, riskleriDegerlendir, ozetUret,
  cevabiKaydet, onGorusmeyiTamamla, onGorusmeTamamMi, onGorusmeyiErtele,
  ertelendiMi, onGorusmeyiSifirla, kabulMesaji
} from '../services/onGorusme.js'

beforeEach(() => {
  localStorage.clear()
})

/* ========================================================== */
/* 1) GÜVENLİK: KIRMIZI BAYRAK TESPİTİ                      */
/* ========================================================== */

describe('KIRMIZI BAYRAK — acil durum kaçırılmamalı', () => {
  it('dört acil durum da tanımlı', () => {
    expect(KIRMIZI_BAYRAKLAR.length).toBe(4)
    // Not: 'kırığı' ile 'kırık' farklı kelimelerdir; id üzerinden doğrula
    const idler = KIRMIZI_BAYRAKLAR.map((b) => b.id)
    expect(idler).toEqual(expect.arrayContaining(['nefes', 'sisiklik', 'kiriklik', 'kanama']))
    // Her bayrak kullanıcıya sorulabilir bir soru taşımalı
    for (const b of KIRMIZI_BAYRAKLAR) {
      expect(b.ad).toBeTruthy()
      expect(b.soru).toMatch(/\?$/)
      expect(b.acil).toBe(true)
    }
  })

  it('her bayrak yalnız "evet" cevabında tetiklenir', () => {
    // Yanlışlıkla "hayır" ile tetiklenmemeli
    for (const b of KIRMIZI_BAYRAKLAR) {
      expect(acilDurumVar({ [b.id]: false })).toBe(false)
      expect(acilDurumVar({ [b.id]: 'hayir' })).toBe(false)
      expect(acilDurumVar({ [b.id]: true })).toBe(true)
      expect(acilDurumVar({ [b.id]: 'evet' })).toBe(true)
    }
  })

  it('belirti yoksa acil sayılmaz', () => {
    expect(acilDurumVar({})).toBe(false)
    expect(acilDurumVar({ sikayet: 'Dişim ağrıyor', saglik: ['diyabet'] })).toBe(false)
  })

  it('hasta serbest metinde yazınca da yakalanır', () => {
    expect(acilDurumVar({ agri: 'gece nefes alırken güçlük çekiyorum' })).toBe(true)
    expect(acilDurumVar({ sikayet: 'yanağımda şişlik var' })).toBe(true)
    expect(acilDurumVar({ sikayet: 'çenem kırıldı' })).toBe(true)
    expect(acilDurumVar({ sikayet: 'diş eti kanaması durmuyor' })).toBe(true)
  })

  it('TÜRKÇE büyük/küçük harf farkı sonucu değiştirmez', () => {
    expect(acilDurumVar({ sikayet: 'YANAKLARIMDA ŞİŞLİK OLDU' })).toBe(true)
  })

  it('birden çok bayrak birlikte raporlanır', () => {
    const bayraklar = kirmiziBayraklariBul({ nefes: true, sisiklik: true })
    expect(bayraklar.length).toBe(2)
    expect(bayraklar.map((b) => b.id)).toEqual(expect.arrayContaining(['nefes', 'sisiklik']))
  })

  it('acil ekranı acil talimatını içermek ZORUNDADIR', async () => {
    const kod = fs.readFileSync('src/components/OnGorusmeAnamnez.jsx', 'utf8')
    expect(kod).toMatch(/acil servise gidin/i)
    expect(kod).toMatch(/En yakın acil servis/i)
  })

  it('her adımda acil kontrol bulunur (süreç atlanamaz)', async () => {
    const kod = fs.readFileSync('src/components/OnGorusmeAnamnez.jsx', 'utf8')
    expect(kod).toContain('AcilKontrol')
    // guncelle() her yanıttan sonra bayrak kontrol eder
    expect(kod).toMatch(/kirmiziBayraklariBul\(birlestirilmis\)/)
  })
})

/* ========================================================== */
/* 2) YASAL: TEŞHİS KONULMAZ                                */
/* ========================================================== */

describe('TEŞHİS KONULMAZ — ön değerlendirme sınırı', () => {
  it('özet tanı/reçete dili içermez', () => {
    const ozet = ozetUret({
      sikayet: 'Sol arka dişim ağrıyor',
      agri: 'Zonklayıcı, sıcak tetikliyor',
      saglik: ['yok'],
      ilac_isaret: ['yok']
    })
    // Kesin tanım dili
    expect(ozet).not.toMatch(/\bçürük\b/i)
    expect(ozet).not.toMatch(/\bpulpitis\b/i)
    expect(ozet).not.toMatch(/teşhis(?:i| edil)?\s*[:=]/i)
    expect(ozet).not.toMatch(/reçete/i)
  })

  it('önet "ön değerlendirme" ve "hekimindir" ibaresi içerir', () => {
    const ozet = ozetUret({ sikayet: 'x' })
    expect(ozet).toMatch(/ön değerlendirme/i)
    expect(ozet).toMatch(/diş hekiminindir/i)
  })

  it('arayüz her ekranda yasal uyarı gösterir', async () => {
    const kod = fs.readFileSync('src/components/OnGorusmeAnamnez.jsx', 'utf8')
    expect(kod).toMatch(/tanı koymaz ve reçete/i)
    expect(kod).toMatch(/nihai kararı.*diş hekiminiz/i)
  })
})

/* ========================================================== */
/* 3) ÖZET FORMATI — klinik düzene uygun                     */
/* ========================================================== */

describe('ozetUret — hekimin beklediği düzen', () => {
  it('tanımlı başlıklar birebir sırayla yer alır', () => {
    const ozet = ozetUret({ sikayet: 'test' })
    const basliklar = ozet.split('\n').map((s) => s.trim())
    expect(basliklar[0]).toBe('[HASTA ANAMNEZ ÖZETİ]')
    expect(basliklar[1]).toMatch(/Ana Şikayet:/)
    expect(basliklar[2]).toMatch(/Ağrı Detayı \(Türü\/Tetikleyici\/Süre\):/)
    expect(basliklar[3]).toMatch(/Tıbbi Geçmiş & Bulaşıcı Hastalıklar:/)
    expect(basliklar[4]).toMatch(/Kullanılan İlaçlar & Alerjiler:/)
    expect(basliklar[5]).toMatch(/Kırmızı Bayraklar \/ Riskler:/)
    expect(basliklar[6]).toMatch(/Diğer Alışkanlıklar \(Sigara\/Bruksizm\):/)
    expect(basliklar).toContain('---')
  })

  it('kırmızı bayrak varsa ACİL olarak işaretlenir', () => {
    const ozet = ozetUret({ sisiklik: true })
    expect(ozet).toMatch(/ACİL/)
  })

  it('kan sulandırıcı kullanımı risk olarak bildirilir', () => {
    const ozet = ozetUret({ ilac_isaret: ['kan_sulandirici'] })
    expect(ozet).toMatch(/Kırmızı Bayraklar[\s\S]*Kan sulandırıcı/)
  })

  it('bisfosfonat (kemik ilacı) risk olarak bildirilir', () => {
    const ozet = ozetUret({ ilac_isaret: ['bisfosfonat'] })
    expect(ozet).toMatch(/Bisfosfonat|Kemik ilacı/i)
  })

  it('risk yoksa "Tespit edilmedi" yazar', () => {
    const ozet = ozetUret({ saglik: ['yok'], ilac_isaret: ['yok'], hijyen: [] })
    expect(ozet).toMatch(/Tespit edilmedi/)
  })

  it('sağlık durumları okunur ada çevrilir', () => {
    const ozet = ozetUret({ saglik: ['diyabet', 'hipertansiyon'] })
    expect(ozet).toContain('Diyabet')
    expect(ozet).toContain('Tansiyon')
  })

  it('alışkanlıklar bruksizm/sigara olarak listelenir', () => {
    const ozet = ozetUret({ hijyen: ['bruksizm', 'sigara'] })
    expect(ozet).toMatch(/sıkıyor/i)
    expect(ozet).toMatch(/Sigara/)
  })

  it('riskleriDegerlendir riskleri tekilleştirir', () => {
    const riskler = riskleriDegerlendir({ saglik: ['kalp', 'kalp', 'diyabet'] })
    expect(new Set(riskler).size).toBe(riskler.length)
  })
})

/* ========================================================== */
/* 4) TETİKLEME KURALI                                        */
/* ========================================================== */

describe('TETİKLEME — yalnız hekim onayı sonrası', () => {
  it('süreç hekim onay bildirimi olmadan otomatik açılmaz', async () => {
    const kod = fs.readFileSync('src/pages/PatientPanel.jsx', 'utf8')
    // Otomatik açılış YALNIZCA "kabul" bildirimine bağlı olmalı
    expect(kod).toMatch(/b\.kind === 'kabul'/)
  })

  it('kabul bildirimi yoksa form otomatik açılmaz', async () => {
    const kod = fs.readFileSync('src/pages/PatientPanel.jsx', 'utf8')
    expect(kod).toMatch(/if \(!kabul\) return/)
  })

  it('hekim onaylarken kabul bildirimi gönderilir', async () => {
    const kod = fs.readFileSync('src/pages/Portal.jsx', 'utf8')
    expect(kod).toMatch(/tur: 'kabul'/)
    expect(kod).toContain('kabulMesaji')
  })

  it('kabul mesajı hekimin adını içerir', () => {
    const m = kabulMesaji('Resul Yel')
    expect(m).toContain('Resul Yel')
    expect(m).toMatch(/onaylanmıştır/i)
    expect(m).toMatch(/anamnez/i)
  })

  it('hekim adı "Dt." önekiyle çift eklenmez', () => {
    expect(kabulMesaji('Dr. Ahmet')).toContain('Dr. Ahmet')
    expect(kabulMesaji('Dr. Ahmet')).not.toContain('Dt. Dr.')
    expect(kabulMesaji('Ahmet')).toContain('Dt. Ahmet')
  })

  it('hekim adı boşsa nötr ifade kullanılır', () => {
    const m = kabulMesaji('')
    expect(m).toContain('Diş hekiminiz')
    expect(m).not.toContain('Dt.  ')
  })

  it('hasta zorlanmaz: "Şimdi değil" seçeneği vardır', async () => {
    const kod = fs.readFileSync('src/components/OnGorusmeAnamnez.jsx', 'utf8')
    expect(kod).toMatch(/Şimdi değil/)
  })
})

/* ========================================================== */
/* 5) VERİ KAYBI YOK                                          */
/* ========================================================== */

describe('VERİ KAYBI — cevaplar saklanmalı', () => {
  const ORNEK = {
    sikayet: 'Sol arka dişim ağrıyor',
    agri: 'Zonklayıcı',
    saglik: ['diyabet'],
    ilac_isaret: ['yok'],
    hijyen: ['sigara'],
    bulasici: 'yok'
  }

  it('her yanıt otomatik kaydedilir', () => {
    const r = cevabiKaydet('p1', { sikayet: 'test' })
    expect(r.kaydedildi).toBe(true)
  })

  it('kayıt sırasıyla tamamlanır', () => {
    cevabiKaydet('p1', { sikayet: 'ağrı' })
    cevabiKaydet('p1', { agri: 'zonklayıcı' })
    cevabiKaydet('p1', { saglik: ['diyabet'] })
    const kayit = onGorusmeyiTamamla('p1')
    expect(kayit.sikayet).toBe('ağrı')
    expect(kayit.agri).toBe('zonklayıcı')
    expect(kayit.saglik).toEqual(['diyabet'])
  })

  it('tamamlanan form bir daha sorulmaz', () => {
    expect(onGorusmeTamamMi('p1')).toBe(false)
    cevabiKaydet('p1', ORNEK)
    onGorusmeyiTamamla('p1')
    expect(onGorusmeTamamMi('p1')).toBe(true)
  })

  it('ertelenen form tamamlanmış sayılmaz', () => {
    cevabiKaydet('p1', ORNEK)
    onGorusmeyiErtele('p1')
    expect(ertelendiMi('p1')).toBe(true)
    expect(onGorusmeTamamMi('p1')).toBe(false)
  })

  it('sıfırlama formu yeniden başlatır', () => {
    cevabiKaydet('p1', ORNEK)
    onGorusmeyiTamamla('p1')
    onGorusmeyiSifirla('p1')
    expect(onGorusmeTamamMi('p1')).toBe(false)
  })

  it('farklı hastaların kayıtları karışmaz', () => {
    cevabiKaydet('hasta1', { sikayet: 'birinci' })
    cevabiKaydet('hasta2', { sikayet: 'ikinci' })
    expect(onGorusmeyiTamamla('hasta1').ozet).toContain('birinci')
    expect(onGorusmeyiTamamla('hasta1').ozet).not.toContain('ikinci')
  })

  it('kayda acil uyarısı da düşer', () => {
    const r = cevabiKaydet('p1', { nefes: true })
    expect(r.acil).toBe(true)
    expect(r.bayraklar.length).toBeGreaterThan(0)
  })

  it('sıfır veriyle çalışınca çökmez', () => {
    expect(() => ozetUret()).not.toThrow()
    expect(ozetUret()).toContain('Belirtilmedi')
    expect(kirmiziBayraklariBul()).toEqual([])
  })
})

/* ========================================================== */
/* 6) AKIŞ TASARIMI                                            */
/* ========================================================== */

describe('AKIŞ — tek adım odaklı sohbet', () => {
  it('birden fazla adım tanımlı (hepsi tek seferde sorulmaz)', () => {
    expect(ADIMLAR.length).toBeGreaterThanOrEqual(5)
    for (const a of ADIMLAR) {
      expect(a.id).toBeTruthy()
      expect(a.baslik).toBeTruthy()
      expect(a.soru).toBeTruthy()
    }
  })

  it('adım kimlikleri benzersiz', () => {
    const ids = ADIMLAR.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('şikayet, ağrı, sağlık, ilaç, hijyen ve bulaşıcı durum toplanır', () => {
    const ids = ADIMLAR.map((a) => a.id)
    expect(ids).toContain('sikayet')
    expect(ids).toContain('agri')
    expect(ids).toContain('saglik')
    expect(ids).toContain('ilac')
    expect(ids).toContain('hijyen')
    expect(ids).toContain('bulasici')
  })

  it('seçenek listeleri tutarlı', () => {
    for (const liste of [SAGLIK_SECENEKLERI, ALISKANLIK_SORULARI, ILAC_RISKLERI]) {
      expect(liste.length).toBeGreaterThan(0)
      for (const s of liste) {
        expect(s.id).toBeTruthy()
        expect(s.ad).toBeTruthy()
      }
    }
  })

  it('sağlık seçenekleri hekim anamnez formuyla uyumlu', async () => {
    const kod = fs.readFileSync('src/components/AnamnezForm.jsx', 'utf8')
    // Kan sulandırıcı ve diyabet her iki tarafta da riskli olmalı
    expect(kod).toMatch(/kan_sulandirici/)
    expect(kod).toMatch(/diyabet/)
  })

  it('ilerleme göstergesi vardır', async () => {
    const kod = fs.readFileSync('src/components/OnGorusmeAnamnez.jsx', 'utf8')
    expect(kod).toContain('og-ilerleme')
    expect(kod).toMatch(/ADIMLAR\.length/)
  })
})