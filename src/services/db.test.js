// Veri katmanı testleri — Supabase olmadan / tablo yokken yedek yollar.
// Amaç: "modül asla ölü görünmesin" kuralının teknik garantisi.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../services/supabase.js', async () => {
  const { supabaseMock } = await import('../test/supabase-mock.js')
  return supabaseMock()
})

import {
  listPatients, listDoctors, getPatient, getSetupStatus, store,
  materialsApi, labApi, pricesApi, invoicesApi, eventsApi
} from '../services/db.js'
import { setSession } from '../services/store.js'

const HASTA = { id: 'h1', role: 'hasta', name: 'Ayşe Yılmaz', email: 'a@t.com', phone: '0555' }
const EBEVEYN = { id: 'e1', role: 'ebeveyn', name: 'Mehmet Yılmaz', email: 'm@t.com' }
const HEKIM = { id: 'd1', role: 'hekim', name: 'Dr. Resul', email: 'd@t.com' }
const SEKRETER = { id: 's1', role: 'sekreter', name: 'Sekreter', email: 's@t.com' }

beforeEach(() => {
  localStorage.clear()
  setSession(null)
  localStorage.setItem('td_users', JSON.stringify([HASTA, EBEVEYN, HEKIM, SEKRETER]))
})

describe('Okuma fonksiyonları — sunucu boşken yere düşer', () => {
  it('listPatients sunucudan veri gelmezse yerel hasta kayıtlarını döndürür', async () => {
    const liste = await listPatients()
    expect(liste.map((u) => u.id).sort()).toEqual(['e1', 'h1'])
  })

  it('listPatients sadece hasta ve ebeveynleri döndürür, hekimi/sekreteri göstermez', async () => {
    const liste = await listPatients()
    expect(liste.some((u) => u.role === 'hekim')).toBe(false)
    expect(liste.some((u) => u.role === 'sekreter')).toBe(false)
  })

  it('listDoctors yalnızca hekimleri döndürür', async () => {
    const liste = await listDoctors()
    expect(liste).toHaveLength(1)
    expect(liste[0].role).toBe('hekim')
  })

  it('getPatient bulunamazsa null döner, istisna atmaz', async () => {
    await expect(getPatient('yok-boyle-bir-id')).resolves.toBeNull()
  })
})

describe('getSetupStatus — hata durumunda çökmemeli (16.10.2026 regresyonu)', () => {
  it('kurulum SQL çalıştırılmamışsa kullanıcıya gösterilebilir hata döner', async () => {
    const sonuc = await getSetupStatus()
    expect(sonuc).toBeTruthy()
    expect(typeof sonuc.error).toBe('string')
    expect(sonuc.error.length).toBeGreaterThan(0)
  })
})

describe('store() — tablo yoksa tarayıcıya kaydeder', () => {
  it('list() yerel kayıtları döndürür', async () => {
    await materialsApi.insert({ name: 'Kompozit A1', adet: 4 })
    await materialsApi.insert({ name: 'Eldiven', adet: 100 })
    const liste = await materialsApi.list()
    expect(liste).toHaveLength(2)
    expect(liste.map((r) => r.name).sort()).toEqual(['Eldiven', 'Kompozit A1'])
  })

  it('insert() veriyi kaybolmadan saklar ve id üretir', async () => {
    const sonuc = await materialsApi.insert({ name: 'Lityum', adet: 1 })
    expect(sonuc.ok).toBe(true)
    const liste = await materialsApi.list()
    expect(liste[0].id).toBeTruthy()
    expect(liste[0].created_at).toBeTruthy()
  })

  it('update() yalnızca hedef kaydı değiştirir, diğerleri bozulmaz', async () => {
    await materialsApi.insert({ name: 'A', adet: 1 })
    await materialsApi.insert({ name: 'B', adet: 2 })
    await labApi.insert({ tooth: '11', durum: 'bekliyor' })

    const [hedef] = await materialsApi.list()
    await materialsApi.update(hedef.id, { adet: 9 })

    const sonra = await materialsApi.list()
    expect(sonra.find((r) => r.name === 'A').adet).toBe(9)
    expect(sonra.find((r) => r.name === 'B').adet).toBe(2)
    expect(sonra).toHaveLength(2)
    // Başka tablo etkilenmemeli
    expect(await labApi.list()).toHaveLength(1)
  })

  it('remove() kaydı siler', async () => {
    await pricesApi.insert({ name: 'Dolgu', fiyat: 500 })
    const liste = await pricesApi.list()
    await pricesApi.remove(liste[0].id)
    expect(await pricesApi.list()).toHaveLength(0)
  })

  it('where filtresi doğru çalışır', async () => {
    await eventsApi.insert({ baslik: 'Toplantı', kind: 'toplanti' })
    await eventsApi.insert({ baslik: 'İzin', kind: 'izin' })
    const sadeceToplanti = await eventsApi.list({ where: { kind: 'toplanti' } })
    expect(sadeceToplanti).toHaveLength(1)
    expect(sadeceToplanti[0].baslik).toBe('Toplantı')
  })

  it('faturalar da yere düşer (yeni tablolar kurulmamış olsa bile)', async () => {
    const r = await invoicesApi.insert({ hasta: 'Ayşe Yılmaz', tutar: 1200 })
    expect(r.ok).toBe(true)
    expect(await invoicesApi.list()).toHaveLength(1)
  })

  it('list() sunucudan veri gelirse onu tercih eder', async () => {
    // Bu test sunucu yanıtını taklit eder
    const { supabase } = await import('../services/supabase.js')
    const onceki = supabase.from
    supabase.from = () => {
      const q = { select: () => q, eq: () => q }
      q.order = () => q
      q.then = (c) => Promise.resolve({ data: [{ id: 'srv1', name: 'Sunucudan' }], error: null }).then(c)
      return q
    }
    // Taze bir store (önceki testlerde "tablo yok"a düşmüş olabilir)
    const taze = store('materials_sunucu_testi')
    const liste = await taze.list()
    supabase.from = onceki
    expect(liste[0].name).toBe('Sunucudan')
  })
})

describe('Veri kaybı yok', () => {
  it('aynı kayıt iki kez eklenince ikisi de durur (silme yok)', async () => {
    await materialsApi.insert({ name: 'İplik', adet: 5 })
    await materialsApi.insert({ name: 'İplik', adet: 5 })
    expect(await materialsApi.list()).toHaveLength(2)
  })

  it('farklı tablolar birbirine karışmaz', async () => {
    await materialsApi.insert({ name: 'X', adet: 1 })
    await labApi.insert({ name: 'X', adet: 1 })
    expect(await materialsApi.list()).toHaveLength(1)
    expect(await labApi.list()).toHaveLength(1)
    expect(localStorage.getItem('td_materials')).toBeTruthy()
    expect(localStorage.getItem('td_lab_cases')).toBeTruthy()
  })
})