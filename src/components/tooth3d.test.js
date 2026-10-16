// 3B diş modeli geometrisi testleri
// 32 dişin hepsi konumlanmalı, üst ve alt çene ayrı ayrı çizilmeli.
import { describe, it, expect } from 'vitest'
import { disKonumu } from '../components/Tooth3D.jsx'
import { UST_SIRA, ALT_SIRA, disBilgisi } from '../data/disAdlari.js'

const HEPSIFDI = [...UST_SIRA, ...ALT_SIRA]

describe('disKonumu — 3B yerleşim', () => {
  it('32 dişin tamamı konum alır', () => {
    expect(HEPSIFDI).toHaveLength(32)
    for (const n of HEPSIFDI) {
      const k = disKonumu(n)
      expect(k, `${n} konumlanmadı`).toBeTruthy()
      expect(Number.isFinite(k.x), `${n} x geçersiz`).toBe(true)
      expect(Number.isFinite(k.y), `${n} y geçersiz`).toBe(true)
      expect(Number.isFinite(k.z), `${n} z geçersiz`).toBe(true)
      expect(Number.isFinite(k.ry), `${n} ry geçersiz`).toBe(true)
      expect(Number.isFinite(k.rx), `${n} rx geçersiz`).toBe(true)
    }
  })

  it('üst çene yukarıda, alt çene aşağıda durur', () => {
    const ust = disKonumu(16)
    const alt = disKonumu(46)
    expect(ust.y).toBeLessThan(0)
    expect(alt.y).toBeGreaterThan(0)
    expect(alt.y - ust.y).toBeGreaterThan(150) // çeneler ayrı görünmeli
  })

  it('her çenenin 16 dişi vardır', () => {
    const ustKonum = UST_SIRA.map(disKonumu).filter(Boolean)
    const altKonum = ALT_SIRA.map(disKonumu).filter(Boolean)
    expect(ustKonum).toHaveLength(16)
    expect(altKonum).toHaveLength(16)
  })

  it('dişler yay üzerinde simetrik yerleşir', () => {
    // 16 ile 46 ayna konumda (sağ üst 1. büyük azı ↔ sağ alt 1. büyük azı)
    const a = disKonumu(16)
    const b = disKonumu(46)
    expect(Math.abs(a.x)).toBeCloseTo(Math.abs(b.x), 5)
  })

  it('orta dişler merkeze yakın, arka dişler dışa taşar', () => {
    const kesici = Math.abs(disKonumu(11).x)
    const kenar = Math.abs(disKonumu(18).x)
    expect(kesici).toBeLessThan(kenar)
  })

  it('geçersiz numara null döner', () => {
    expect(disKonumu(10)).toBeNull()
    expect(disKonumu(99)).toBeNull()
    expect(disKonumu(0)).toBeNull()
  })

  it('diş hekimliği konvansiyonu: hastanın sağı gözlemcinin solunda', () => {
    // Odontogram hastaya bakış açısıyla çizilir: hastanın SAĞ çenesi
    // ekranın SOL tarafında görünür. Bu klinik alışkanlıktır.
    for (const n of [18, 17, 16, 15, 14, 13, 12, 11, 41, 42, 43, 44, 45, 46, 47, 48]) {
      expect(disKonumu(n).x, `${n} (hastanın sağı) ekranın solunda olmalı`).toBeLessThan(0)
    }
    for (const n of [21, 22, 23, 24, 25, 26, 27, 28, 31, 32, 33, 34, 35, 36, 37, 38]) {
      expect(disKonumu(n).x, `${n} (hastanın solu) ekranın sağında olmalı`).toBeGreaterThan(0)
    }
  })

  it('diş bilgisiyle senkron çalışır', () => {
    for (const n of HEPSIFDI) {
      const k = disKonumu(n)
      const b = disBilgisi(n)
      expect(k.tip, `${n} tip eşleşmedi`).toBe(b.tip.ikon)
    }
  })
})