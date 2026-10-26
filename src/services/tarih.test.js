import { describe, it, expect } from 'vitest'
import { isGunuMu, otomatikRandevuGunu, sonrakiBosGun } from './tarih.js'

const gun = (y, m, d) => new Date(y, m - 1, d)

describe('tarih — klinik randevu günü yardımcıları', () => {
  it('isGunuMu: cumartesi ve pazar iş günü değildir', () => {
    expect(isGunuMu(gun(2026, 10, 24))).toBe(false) // okt 2026 cumartesi
    expect(isGunuMu(gun(2026, 10, 25))).toBe(false) // pazar
    expect(isGunuMu(gun(2026, 10, 26))).toBe(true)  // pazartesi
    expect(isGunuMu(gun(2026, 10, 23))).toBe(true)  // cuma
  })

  it('otomatikRandevuGunu: cumadan sonraki randevu pazartesidir', () => {
    expect(otomatikRandevuGunu(gun(2026, 10, 23))).toBe('2026-10-26')
  })

  it('otomatikRandevuGunu: bugünden 1 gün sonraki iş günü döner', () => {
    // Salı → Çarşamba
    expect(otomatikRandevuGunu(gun(2026, 10, 20))).toBe('2026-10-21')
    // Cumartesi → Pazartesi
    expect(otomatikRandevuGunu(gun(2026, 10, 24))).toBe('2026-10-26')
  })

  it('sonrakiBosGun: dolu günleri ve hafta sonunu atlar', () => {
    // Pazartesi 26'dan başla; 27 ve 28 dolu → 2 arşısı boş olsa da bugün ics, 29 perşembe boş
    const dolu = new Set(['2026-10-27', '2026-10-28'])
    expect(sonrakiBosGun(dolu, gun(2026, 10, 26))).toBe('2026-10-29')
  })

  it('sonrakiBosGun: cumartesi/pazar tamamen atlanır', () => {
    // 27-30 (salı-cuma) dolu → cumartesi/pazar atlanır, sonraki boş: kasım 2 (pazartesi)
    const dolu = new Set(['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30'])
    expect(sonrakiBosGun(dolu, gun(2026, 10, 26))).toBe('2026-11-02')
  })

  it('sonrakiBosGun: hepsi doluysa bile makul bir gün döner (sonsuz döngü yok)', () => {
    const dolu = new Set()
    for (let i = 1; i < 100; i++) {
      const d = new Date(gun(2026, 10, 26)); d.setDate(d.getDate() + i)
      dolu.add(d.toISOString().slice(0, 10))
    }
    const r = sonrakiBosGun(dolu, gun(2026, 10, 26))
    expect(r).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
