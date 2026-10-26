// Randevu otomatik doldurma testleri:
// 1) Panel içi form hastanın adı, telefonu ve önerilen tarihiyle açılır.
// 2) Gönderimde talep hastaya bağlanır (patient_id ile sunucuya yazılır).
// 3) Hasta verilmemişse form boş açılır.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import '../i18n.js'
import { Appointment, PanelRandevu } from './Pages.jsx'
import { setSession } from '../services/store.js'

// Özelleştirilmiş mock: okumalar "tablo yok" der (localStorage yolu denenir),
// yazmalar yakalanır ve başarılı sayılır — hasta_id'nin talebe eklendiği görülür.
const insertlar = []

function taklitZincir(veri, hata) {
  const sonuc = { data: veri, error: hata }
  const q = {
    select: () => taklitZincir(veri, hata),
    insert: (satir) => { insertlar.push(satir); return taklitZincir([satir], null) },
    upsert: () => taklitZincir([veri], null),
    update: () => taklitZincir([veri], null),
    delete: () => taklitZincir([veri], null)
  }
  q.eq = q.neq = q.gt = q.gte = q.lt = q.lte = q.like = q.ilike = q.in = q.contains = () => q
  q.order = q.limit = q.offset = q.range = q.single = q.maybeSingle = () => taklitZincir(veri, hata)
  q.then = (coz, red) => Promise.resolve(sonuc).then(coz, red)
  q.catch = (red) => Promise.resolve(sonuc).catch(red)
  q.finally = (ff) => Promise.resolve(sonuc).finally(ff)
  return q
}

vi.mock('../services/supabase.js', () => ({
  hasSupabase: true,
  supabase: {
    from: () => taklitZincir(null, { message: 'relation "x" does not exist', code: '42P01' }),
    rpc: () => Promise.resolve({ data: null, error: null }),
    storage: {
      from: () => ({
        list: () => Promise.resolve({ data: [], error: null }),
        upload: () => Promise.resolve({ error: null }),
        remove: () => Promise.resolve({ error: null }),
        getPublicUrl: (yol) => ({ data: { publicUrl: yol } }),
        createSignedUrl: () => Promise.resolve({ data: { signedUrl: '' }, error: null })
      })
    },
    auth: {
      signInWithPassword: () => Promise.resolve({ data: {}, error: { message: 'test ortami' } }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      setSession: () => Promise.resolve({ data: {}, error: null }),
      signOut: () => Promise.resolve({ error: null }),
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } })
    }
  }
}))

const HASTA = {
  id: 'hasta-1', role: 'hasta', name: 'Örnek Hasta', phone: '05001112233', email: 'ornek@ornek.com'
}

beforeEach(() => {
  localStorage.clear()
  insertlar.length = 0
})

const f = (jsx) => <MemoryRouter>{jsx}</MemoryRouter>

describe('Appointment — hasta bilgisi otomatik doldurma', () => {
  it('hasta verilirse ad, telefon ve önerilen tarih dolu gelir', () => {
    render(f(<Appointment hasta={HASTA} panelMi />))
    expect(screen.getByDisplayValue('Örnek Hasta')).toBeTruthy()
    expect(screen.getByDisplayValue('05001112233')).toBeTruthy()
    // Önerilen tarih YYYY-MM-AA biçimli ilk iş günü olmalı
    const tarih = document.querySelector('input[type="date"]')
    expect(tarih?.value || '').toMatch(/^\d{4}-\d{2}-\d{2}$/)
    cleanup()
  })

  it('hasta verilmemişse form boş açılır', () => {
    render(f(<Appointment panelMi />))
    expect(screen.queryByDisplayValue('Örnek Hasta')).toBeNull()
    cleanup()
  })

  it('gönderimde talep hastanın ID\'si ile kaydedilir', async () => {
    const user = userEvent.setup()
    render(f(<Appointment hasta={HASTA} panelMi />))
    await user.type(screen.getByPlaceholderText(/örn: 16 nolu/), '16 nolu dişte ağrı')
    const checkboxes = document.querySelectorAll('input[type="checkbox"]')
    await user.click(checkboxes[checkboxes.length - 1]) // KVKK
    await user.click(screen.getByRole('button', { name: 'Gönder' }))
    const randevuSatiri = insertlar.find((i) => i && i.name === 'Örnek Hasta')
    expect(randevuSatiri, 'insert çağrısı yapılmadı').toBeTruthy()
    expect(randevuSatiri.patient_id).toBe('hasta-1')
    expect(randevuSatiri.status).toBe('yeni')
    cleanup()
  })
})

describe('PanelRandevu — giriş davranışı', () => {
  it('girişli hastanın profil bilgisi forma taşınır', async () => {
    setSession(HASTA)
    localStorage.setItem('td_users', JSON.stringify([HASTA]))
    render(f(<PanelRandevu />))
    await screen.findByText('Randevu Al')
    // Profil yüklemesi sonrasında ad otomatik gelir
    await screen.findByDisplayValue('Örnek Hasta')
    cleanup()
  })
})
