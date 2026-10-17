// Anamnez akışı testleri
//
// KURAL: Anamnez HEKİM doldurur. Hasta panelinde veri GİREN form bulunmaz.
// Bu testler iki kuralı zorunlu kılar:
//   1) Kayıt, hekimin girdiği veriyi sunucuya yazar
//   2) Kritik işaretlenen durumlar hastaya uyarı olarak düşer
import { describe, it, expect, beforeEach } from 'vitest'
import { HASTALIKLAR, kayittanFormu, formdanKayit } from '../components/AnamnezForm.jsx'

beforeEach(() => {
  localStorage.clear()
})

describe('HASTALIKLAR — diş tedavisini etkileyen durumlar', () => {
  it('her hastalığın id ve adı var', () => {
    expect(HASTALIKLAR.length).toBeGreaterThan(10)
    for (const h of HASTALIKLAR) {
      expect(h.id).toBeTruthy()
      expect(h.ad).toBeTruthy()
    }
  })

  it('id Benzersiz (çift kayıt olmaz)', () => {
    const ids = HASTALIKLAR.map((h) => h.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('tedavi öncesi dikkat gerektiren durumlar riskli işaretli', () => {
    const riskli = HASTALIKLAR.filter((h) => h.riskli).map((h) => h.id)
    // Kan sulandırıcı, kalp kapağı ve gebelik diş tedavisini doğrudan etkiler
    expect(riskli).toContain('kan_sulandirici')
    expect(riskli).toContain('kalp')
    expect(riskli).toContain('gebelik')
  })

  it('riskli olmayanlar da var (her şey riskli değil)', () => {
    expect(HASTALIKLAR.some((h) => !h.riskli)).toBe(true)
  })
})

describe('formdanKayit — klinik kayıt satırı üretir', () => {
  it('hasta kimliği ve hekim bilgisi yazılır', () => {
    const k = formdanKayit({}, 'h1')
    expect(k.patient_id).toBe('h1')
    expect(k).toHaveProperty('doctor_id')
  })

  it('riskli hastalık varsa critical İŞARETLENİR (hasta uyarısı düşer)', () => {
    const riskli = HASTALIKLAR.find((h) => h.riskli).id
    expect(formdanKayit({ sistemik: [riskli] }, 'h1').critical).toBe(true)
  })

  it('riskli hastalık yoksa critical YANLIŞ (gürültü uyarı olmaz)', () => {
    const guvenli = HASTALIKLAR.find((h) => !h.riskli).id
    expect(formdanKayit({ sistemik: [guvenli] }, 'h1').critical).toBe(false)
    expect(formdanKayit({ sistemik: [] }, 'h1').critical).toBe(false)
  })

  it('tüm klinik alanlar boş string olarak kaydedilir (null yazılmaz)', () => {
    const k = formdanKayit({}, 'h1')
    for (const alan of ['alerjiler', 'ilaclar', 'gecmis_hastaliklar', 'notlar']) {
      expect(k[alan]).toBe('')
    }
  })

  it('sistemik hastalıklar dizi olarak saklanır', () => {
    const k = formdanKayit({ sistemik: ['diyabet', 'astim'] }, 'h1')
    expect(Array.isArray(k.sistemik)).toBe(true)
    expect(k.sistemik).toHaveLength(2)
  })
})

describe('kayittanFormu — eski/yeni kayıtları forma çevirir', () => {
  it('dizi gelen sistemik alan olduğu gibi korunur', () => {
    const f = kayittanFormu({ sistemik: ['diyabet'] })
    expect(f.sistemik).toEqual(['diyabet'])
  })

  it('virgülle gelen ESKİ format da okunur (geriye uyum)', () => {
    const f = kayittanFormu({ sistemik: 'diyabet, astim' })
    expect(f.sistemik).toEqual(['diyabet', 'astim'])
  })

  it('bozuk veri çökmez, boş forma döner', () => {
    expect(() => kayittanFormu(null)).not.toThrow()
    expect(kayittanFormu(null).sistemik).toEqual([])
    expect(kayittanFormu({}).sistemik).toEqual([])
  })
})

// REGRESYON: eskiden hasta panelinde "Hekime Soru Sor" formu vardı ve
// localStorage'a yazıyordu. Veri hiçbir yere ulaşmıyordu ama kullanıcıya
// "hekiminize düşecektir" yalanı söyleniyordu. Artık hasta panelinde
// veri toplayan form yoktur.
describe('hasta panelinde veri toplayan form YOKTUR', () => {
  it('PatientPanel anamnez/hiçbir formu içe aktarmaz', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/pages/PatientPanel.jsx', 'utf8')
    expect(kod).not.toContain('HastaSoruFormu')
    expect(kod).not.toMatch(/insertTriage|insertHygiene|insertAnxiety/)
  })

  it('hasta menüsünde form rotaları yerine randevu/görüşme var', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/components/PanelLayout.jsx', 'utf8')
    expect(kod).toContain("['/randevu', Calendar, 'Randevu Al']")
    expect(kod).toContain("['/video', Video, 'Hekimimle Görüş']")
    expect(kod).not.toContain("'/triyaj'")
    expect(kod).not.toContain("'/hijyen'")
    expect(kod).not.toContain("'/anksiyete'")
  })

  it('anamnez formu HEKİM panelinde bağlı', async () => {
    const fs = await import('node:fs')
    const kod = fs.readFileSync('src/pages/Portal.jsx', 'utf8')
    expect(kod).toContain('AnamnezForm')
    expect(kod).toMatch(/Anamnez[\s\S]{0,80}Geçmiş Hastalık/)
  })
})