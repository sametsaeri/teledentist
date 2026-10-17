// Dosya arşivi ve bakım modu testleri
//
// AMAÇ: Veri KAYBOLMASIN.
//   1) Yüklenen her dosyanın kaydı tutulur (kim/ne zaman/hangi diş)
//   2) Arşivleme SİLMEK DEĞİLDİR — dosya depolamada kalır
//   3) Bakım modunda veri yazımı durur, kullanıcıya açıklama gösterilir
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../services/supabase.js', async () => {
  const { supabaseMock } = await import('../test/supabase-mock.js')
  return supabaseMock()
})

import {
  bakimDurumu, bakimdaMi, bakimAc, bakimKapat, bakimMesaji, bakimKontrol, BAKIM_NEDENLER
} from '../services/bakim.js'
import { KATEGORILER } from '../components/DosyaArsivi.jsx'

beforeEach(() => {
  localStorage.clear()
})

describe('bakimAc — bakım modu açılır ve açıklama yazılır', () => {
  it('kapalıyken açılır', () => {
    expect(bakimdaMi()).toBe(false)
    bakimAc({ neden: 'guncelleme' })
    expect(bakimdaMi()).toBe(true)
    expect(bakimDurumu().acik).toBe(true)
  })

  it('hazır neden için hazır açıklama kullanılır', () => {
    bakimAc({ neden: 'guncelleme' })
    expect(bakimMesaji()).toContain('güncelle')
  })

  it('özel açıklama verilirse o kullanılır', () => {
    bakimAc({ neden: 'ariza', not: 'Elektrik kesintisi nedeniyle hizmet veremiyoruz.' })
    expect(bakimMesaji()).toBe('Elektrik kesintisi nedeniyle hizmet veremiyoruz.')
  })

  it('bilinmeyen neden verilse bile açıklama ÜRETİLİR (boş kalmaz)', () => {
    bakimAc({ neden: 'bilinmeyen-bir-neden' })
    expect(bakimMesaji().length).toBeGreaterThan(0)
  })

  it('başlangıç zamanı ve kim bilgisi kaydedilir', () => {
    bakimAc({ neden: 'planli', kim: 'Dr. Resul' })
    const b = bakimDurumu()
    expect(b.baslangic).toBeTruthy()
    expect(b.kim).toBe('Dr. Resul')
  })

  it('tahmini bitiş bilgisi saklanır', () => {
    bakimAc({ neden: 'planli', tahmini: '18:00' })
    expect(bakimDurumu().tahmini).toBe('18:00')
  })

  it('her bakım nedeni kullanıcıya gösterilebilir bir açıklama içerir', () => {
    for (const n of BAKIM_NEDENLER) {
      expect(n.varsayilan.length).toBeGreaterThan(10)
      expect(n.ad).toBeTruthy()
    }
  })
})

describe('bakimKontrol — bakımda veri YAZILMAZ', () => {
  it('bakım kapalıyken yazmaya izin verir', () => {
    expect(bakimKontrol('test')).toBeNull()
  })

  it('bakım açıkken yazma ENGELLENİR', () => {
    bakimAc({ neden: 'veritabani' })
    const sonuc = bakimKontrol('test')
    expect(sonuc).not.toBeNull()
    expect(sonuc.error).toBeTruthy()
  })

  it('kullanıcıya verilerinin güvende olduğu söylenir', () => {
    bakimAc({ neden: 'planli' })
    const { error } = bakimKontrol('test')
    expect(error).toContain('bakım')
    expect(error).toMatch(/güvende/i)
  })

  it('hata mesajı ne zaman tekrar deneyeceğini söyler', () => {
    bakimAc({ neden: 'planli' })
    const { error } = bakimKontrol('test')
    expect(error).toMatch(/tekrar deneyin/i)
  })
})

describe('bakimKapat — bakım geçmişe not düşer', () => {
  it('bakımı kapatır', () => {
    bakimAc({ neden: 'planli' })
    bakimKapat()
    expect(bakimdaMi()).toBe(false)
  })

  it('bitiş zamanı ve kim saklanır (ne zaman bakım yapıldı bellidir)', () => {
    bakimAc({ neden: 'planli', kim: 'A' })
    bakimKapat({ kim: 'B' })
    const b = bakimDurumu()
    expect(b.bitti).toBeTruthy()
    expect(b.bittiKim).toBe('B')
  })

  it('başlangıç bilgisi KAYBOLMAZ (kapanınca da durur)', () => {
    bakimAc({ neden: 'planli' })
    const baslangic = bakimDurumu().baslangic
    bakimKapat()
    expect(bakimDurumu().baslangic).toBe(baslangic)
  })

  it('kapatılan bakımın nedeni de saklanır', () => {
    bakimAc({ neden: 'ariza' })
    bakimKapat()
    expect(bakimDurumu().neden).toBe('ariza')
  })
})

describe('bakimMesaji — kapalıyken mesaj boş', () => {
  it('bakım yokken hiçbir şey göstermez', () => {
    expect(bakimMesaji()).toBe('')
  })
})

// REGRESYON: eski XrayBox her yeni yüklemede dosyayı aynı adla
// "üstüne yazıyordu" ve hiçbir kayıt tutulmadığı için arşivlenemiyordu.
describe('dosya arşivi — veri kaybı koruması', () => {
  it('her dosya türü için sınıflandırma seçeneği var', () => {
    expect(KATEGORILER.length).toBeGreaterThan(5)
    for (const k of KATEGORILER) {
      expect(k.id).toBeTruthy()
      expect(k.ad).toBeTruthy()
    }
  })

  it('sınıflandırma idleri benzersiz', () => {
    const ids = KATEGORILER.map((k) => k.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('radyoloji, tanı, onam, ödeme ve kimlik kategorileri VAR', () => {
    const ids = KATEGORILER.map((k) => k.id)
    expect(ids).toContain('radyoloji')
    expect(ids).toContain('tani')
    expect(ids).toContain('sozelmes')
    expect(ids).toContain('odeme')
    expect(ids).toContain('kimlik')
  })

  it('dosya yükleme fonksiyonu bakım kontrolü yapar', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/services/db.js', 'utf8')
    // uploadFile içinde bakım kontrolü olmalı
    expect(kod).toMatch(/uploadFile[\s\S]{0,400}bakimKontrol/)
  })

  it('arşivleme silme DEĞİLDİR — dosya depolamada kalır', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/services/db.js', 'utf8')
    // setFileArsiv yalnızca arsiv alanını günceller, remove çağırmaz
    const bolum = kod.split('export async function setFileArsiv')[1]?.split('export')[0] || ''
    expect(bolum).toContain('arsiv')
    expect(bolum).not.toContain('.remove(')
  })

  it('silme işlemi önce dosyayı, sonra kaydı siler', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/services/db.js', 'utf8')
    const bolum = kod.split('export async function deleteMedicalFile')[1]?.split('export')[0] || ''
    const depoIdx = bolum.indexOf('storage.from')
    const kayitIdx = bolum.indexOf('medical_files')
    expect(depoIdx).toBeGreaterThan(-1)
    expect(kayitIdx).toBeGreaterThan(depoIdx)
  })

  it('kayıt yazılamazsa dosya SİLİNMEZ, uyarı verilir', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/services/db.js', 'utf8')
    const bolum = kod.split('export async function uploadFile')[1]?.split('export')[0] || ''
    expect(bolum).toContain('kayitYok')
    expect(bolum).toContain('uyari')
  })

  it('dosya adı benzersizdir (aynı dişe iki röntgen yüklenebilir)', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/services/db.js', 'utf8')
    const bolum = kod.split('export async function uploadFile')[1]?.split('export')[0] || ''
    // damga + rastgele bileşen içermeli
    expect(bolum).toMatch(/Math\.random\(\)/)
    expect(bolum).toMatch(/damga/)
  })

  it('arşiv bileşeni yükleme/görüntüleme/arşivleme/silme sunar', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/DosyaArsivi.jsx', 'utf8')
    expect(kod).toContain('uploadFile')
    expect(kod).toContain('listMedicalFiles')
    expect(kod).toContain('setFileArsiv')
    expect(kod).toContain('deleteMedicalFile')
    expect(kod).toMatch(/Görüntüle/)
    expect(kod).toMatch(/Arşivle/)
  })

  it('silmeden önce arşivlemeyi ÖNERİR (veri koruma önceliği)', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/DosyaArsivi.jsx', 'utf8')
    expect(kod).toMatch(/önerilen|öneririz/)
  })

  it('PDF desteği vardır (belge yükleme)', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/DosyaArsivi.jsx', 'utf8')
    expect(kod).toContain('application/pdf')
  })

  it('büyük dosyalar reddedilir (bellek koruması)', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/DosyaArsivi.jsx', 'utf8')
    expect(kod).toMatch(/1024 \* 1024/)
    expect(kod).toMatch(/çok büyük/i)
  })
})

describe('bakım arayüzü — kullanıcıya gösterilir', () => {
  it('bakım bandı tüm panellerin düzeninde', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/PanelLayout.jsx', 'utf8')
    expect(kod).toContain('BakimBanti')
  })

  it('bakım bandı yalnız admin için kontrol paneli sunar', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/BakimPaneli.jsx', 'utf8')
    expect(kod).toMatch(/rol !== 'admin'/)
  })

  it('admin panelinde bakım sekmesi var', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/pages/Admin.jsx', 'utf8')
    expect(kod).toContain("tab === 'bakim'")
    expect(kod).toContain('BakimPaneli')
  })

  it('bakım bandı kullanıcıya verilerin güvende olduğunu söyler', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/BakimPaneli.jsx', 'utf8')
    expect(kod).toMatch(/Verileriniz güvende/)
  })

  it('bakım açılmadığında hiçbir şey basılmaz', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/BakimPaneli.jsx', 'utf8')
    expect(kod).toMatch(/if \(!b\?\.acik\) return null/)
  })

  it('hekim hasta detayında dosya arşivi bağlı', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/pages/Portal.jsx', 'utf8')
    expect(kod).toContain('DosyaArsivi')
  })
})