// KVKK rıza akışı testleri
//
// YASAL DAYANAK: 6698 sayılı Kanun md. 5/1 (aydınlatma yükümlülüğü)
// ve md. 3/6 (özel nitelikli veri — açık rıza).
//
// KURAL: Onay alınmadan kayıt talebi OLUŞTURULAMAZ. Bu kural hem
// arayüzde (düğme pasif) hem de veri katmanında (registerRequest)
// zorunludur — tarayıcı doğrulaması tek başına hukuken yeterli değildir.
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../services/supabase.js', async () => {
  const { supabaseMock } = await import('../test/supabase-mock.js')
  return supabaseMock()
})

import { registerRequest } from '../services/auth.js'
import { rizaKaydi, KVKK_SURUM } from '../components/KvkkOnay.jsx'

beforeEach(() => {
  localStorage.clear()
})

const GECERLI = {
  name: 'Elif Yıldırım',
  email: 'elif@test.com',
  pass: 'Test123456',
  role: 'hasta',
  phone: '0532 111 22 33',
  kvkkOnay: true
}

describe('registerRequest — KVKK onayı olmadan talep YAZILMAZ', () => {
  it('onay verilmemişse talep reddedilir', async () => {
    const r = await registerRequest({ ...GECERLI, kvkkOnay: false })
    expect(r.ok).toBeUndefined()
    expect(r.error).toContain('KVKK')
    expect(r.error).toMatch(/onaylamadan/i)
  })

  it('onay alanı hiç gönderilmemişse de reddedilir (undefined bile sayılmaz)', async () => {
    const { kvkkOnay, ...onaysiz } = GECERLI
    const r = await registerRequest(onaysiz)
    expect(r.ok).toBeUndefined()
    expect(r.error).toContain('KVKK')
  })

  it('yalnızca true kabul edilir; "true" metni de geçmez', async () => {
    const r = await registerRequest({ ...GECERLI, kvkkOnay: 'true' })
    expect(r.ok).toBeUndefined()
    expect(r.error).toContain('KVKK')
  })

  it('onay verilmişse diğer doğrulamalar aynen çalışır', async () => {
    // KVKK onayı VAR ama e-posta geçersiz -> e-posta hatası önce gelir
    const r = await registerRequest({ ...GECERLI, kvkkOnay: true, email: 'gecersiz' })
    expect(r.error).toContain('e-posta')
    expect(r.error).not.toContain('KVKK')
  })
})

describe('rizaKaydi — kanıt değeri taşıyan onay kaydı', () => {
  it('onay, sürüm ve zaman damgası içerir', () => {
    const r = rizaKaydi({ ad: 'Elif' })
    expect(r.kvkk_onay).toBe(true)
    expect(r.kvkk_surum).toBe(KVKK_SURUM)
    expect(r.kvkk_zaman).toBeTruthy()
    expect(Date.parse(r.kvkk_zaman)).not.toBeNaN()
  })

  it('kayıt sürümü metni içerir (hangi metin okundu bilinir)', () => {
    const r = rizaKaydi({ ad: 'Elif' })
    expect(r.kvkk_versiyon_metni).toContain(KVKK_SURUM)
  })

  it('zaman damgası geçerli ve bugüne yakın', () => {
    const r = rizaKaydi({})
    const t = Date.parse(r.kvkk_zaman)
    expect(Number.isNaN(t)).toBe(false)
    const fark = Math.abs(Date.now() - t)
    expect(fark).toBeLessThan(60000) // 1 dakikadan eski olmamalı
  })
})

describe('KVKK_SURUM — metin sürümleme', () => {
  it('sürüm numarası biçimlidir (noktayla ayrılmış)', () => {
    expect(KVKK_SURUM).toMatch(/^\d+\.\d+$/)
  })
})

// REGRESYON: düğme pasif olsa bile Enter ile form gönderilebilirdi.
// Aynı kontrol hem arayüzde hem veri katmanında olmalı.
describe('arayüz ve veri katmanı AYNI kuralı uygular', () => {
  it('kayıt ekranında KVKK kutusu bağlı', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/pages/Pages.jsx', 'utf8')
    expect(kod).toContain('KvkkOnay')
  })

  it('gönder düğmesi onaysız durumda pasiftir', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/pages/Pages.jsx', 'utf8')
    expect(kod).toMatch(/disabled=\{[^}]*!kvkk/)
  })

  it('submit içinde de onay yeniden doğrulanır (Enter tuşu atlatamaz)', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/pages/Pages.jsx', 'utf8')
    // submit fonksiyonunda "if (!kvkk)" kontrolü bulunmalı
    expect(kod).toMatch(/if\s*\(!kvkk\)\s*\{/)
  })

  it('hekim paneli rıza kanıtını gösterir', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/pages/Portal.jsx', 'utf8')
    expect(kod).toContain('kvkk_onay')
    expect(kod).toMatch(/KVKK rızası alındı/)
  })
})

describe('KVKK metni — yasal zorunlulukları içerir', () => {
  it('metin 6698 kanununu ve açık rıza kavramını anlatır', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/KvkkOnay.jsx', 'utf8')
    expect(kod).toContain('6698')
    expect(kod).toMatch(/açık rıza/i)
  })

  it('sağlık verisinin özel nitelikli olduğu belirtilir', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/KvkkOnay.jsx', 'utf8')
    expect(kod).toMatch(/özel nitelikli/i)
  })

  it('veri sahibinin KVKK md. 11 hakları sıralanır', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/KvkkOnay.jsx', 'utf8')
    expect(kod).toMatch(/11\. madde/)
    expect(kod).toMatch(/düzeltilmesini| silinmesini/)
  })

  it('rıza geri çekme hakkı anlatılır', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/KvkkOnay.jsx', 'utf8')
    expect(kod).toMatch(/geri çek/i)
  })

  it('onay kutusu metin görüntülenmeden ETKİNLEŞMEZ', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/KvkkOnay.jsx', 'utf8')
    expect(kod).toMatch(/disabled=\{!okundu\}/)
  })
})