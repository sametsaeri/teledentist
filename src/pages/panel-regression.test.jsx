// REGRESYON TESTİ — 16 Ekim 2026 beyaz ekran hatası
//
// Hata: `useEffect(load, [])` yazıldığında load bir Promise döndürüyordu.
// React bunu temizleme (cleanup) fonksiyonu sanıp modülden çıkarken çağırıyor,
// Promise bir fonksiyon olmadığı için "l is not a function" hatası veriyor
// ve uygulama beyaz ekrana düşüyordu.
//
// Bu test her hekim paneli modülünü açıp KAPATARAK bu hatanın tekrarını
// yakalar. Yeni modül eklendiğinde buraya da eklenmelidir.
import { describe, it, expect, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { setSession } from '../services/store.js'

const HEKIM = {
  id: '22222222-2222-3333-4444-555555555555',
  role: 'hekim',
  email: 'hekim@test.com',
  name: 'Test Hekim',
  branch: 'endodonti'
}
const HASTA = {
  id: '11111111-2222-3333-4444-555555555555',
  role: 'hasta',
  email: 'hasta@test.com',
  name: 'Test Hasta',
  phone: '0555 000 00 00'
}

// Ağ isteklerini beklemeden test edebilmek için supabase çağrıları
// "sunucuda kayıt yok" hatasıyla karşılaştırılır → uygulamanın
// localStorage yedek yolu denenmiş olur.
vi.mock('../services/supabase.js', async () => {
  const { supabaseMock } = await import('../test/supabase-mock.js')
  return supabaseMock()
})

import { PanelLayout } from '../components/PanelLayout.jsx'
import { DoctorList } from '../pages/Portal.jsx'
import { PatientPanel } from '../pages/PatientPanel.jsx'
import { StaffPanel } from '../pages/StaffPanel.jsx'
import { TedaviSureleri, ClinicJournal, DoctorSchedule, DailyFlow, ClinicStats } from '../pages/DoctorModules.jsx'

// Her render sonrası "temizleme fonksiyonu bir fonksiyon olmalı" kontrolü yapılır.
// Vitest, mount/unmount sırasında oluşan hataları zaten test hatası olarak yazar.
//
// NOT: Router ile sarılır. Modüllerde <Link> kullanımı normaldir ve
// router bağlamı olmadan render edilirse bileşenin kendisi değil, test
// düzeneği hata verir.
function mountUnmount(element) {
  const { unmount } = render(<MemoryRouter>{element}</MemoryRouter>)
  unmount() // <-- asıl test edilen adım
}

describe('Beyaz ekran regresyon testi (16.10.2026)', () => {
  it('hekim paneli modülleri açılıp kapatılınca çökmez', () => {
    setSession(HEKIM)
    localStorage.setItem('td_users', JSON.stringify([HASTA, HEKIM]))

    const moduller = [
      ['Günlük Akış', () => <DailyFlow appts={[]} patients={[HASTA]} onComplete={() => {}} />],
      ['Tedavi Süreleri', () => <TedaviSureleri patients={[HASTA]} plans={[]} />],
      ['Klinik Günlük', () => <ClinicJournal patients={[HASTA]} />],
      ['Kişisel Takvim', () => <DoctorSchedule />]
    ]

    for (const [ad, bileşen] of moduller) {
      expect(() => mountUnmount(bileşen()), `${ad} açılıp kapatılınca çökmemeli`).not.toThrow()
    }
  })

  it('hasta paneli açılıp kapatılınca çökmez', () => {
    setSession(HASTA)
    expect(() => mountUnmount(<PatientPanel />)).not.toThrow()
  })

  it('sekreter paneli açılıp kapatılınca çökmez', () => {
    setSession({ ...HEKIM, role: 'sekreter' })
    expect(() => mountUnmount(<StaffPanel />)).not.toThrow()
  })

  it('hekim listesi ve paneller sürekli açılıp kapanınca çökmez', async () => {
    setSession(HEKIM)
    localStorage.setItem('td_users', JSON.stringify([HASTA, HEKIM]))

    // Menüden modüllere 5 kez geçiş yap (döngüsel)
    for (const t of ['ozet', 'sure', 'takvim', 'gunluk-not', 'foto']) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[`/hekim?tab=${t}`]}>
          <PanelLayout><DoctorList /></PanelLayout>
        </MemoryRouter>
      )
      await act(async () => {})          // panelin yüklenen rozetlerini bekle
      unmount()
    }
    cleanup()
  })

  it('panel menüsü grupları doğru render edilir', async () => {
    setSession(HEKIM)
    render(
      <MemoryRouter initialEntries={['/hekim']}>
        <PanelLayout><div>içerik</div></PanelLayout>
      </MemoryRouter>
    )
    await act(async () => {})
    expect(screen.getAllByText('Genel').length).toBeGreaterThan(0)
    // Finans grubu kaldırıldı; yerine Tedavi (Tedavi Süreleri) var
    expect(screen.queryAllByText('Finans').length).toBe(0)
    expect(screen.queryAllByText('İşletme').length).toBe(0)
    expect(screen.getAllByText('Tedavi').length).toBeGreaterThan(0)
  })

  it('menüde bir grup açılınca diğeri kapanır (ekran kirliliği olmaz)', async () => {
    setSession(HEKIM)
    render(
      <MemoryRouter initialEntries={['/hekim']}>
        <PanelLayout><div>içerik</div></PanelLayout>
      </MemoryRouter>
    )
    await act(async () => {})

    const bas = (ad) => [...document.querySelectorAll('.menu-group-head')]
      .find((d) => (d.textContent || '').includes(ad))
    const acik = () => [...document.querySelectorAll('.menu-group-head')]
      .filter((d) => d.getAttribute('aria-expanded') === 'true')
      .map((d) => (d.textContent || '').trim())

    // Başlangıçta yalnız etkin sayfanın grubu açık
    expect(acik().join()).toContain('Genel')

    await act(async () => { bas('Tedavi').click() })
    expect(bas('Tedavi').getAttribute('aria-expanded')).toBe('true')
    expect(acik().length).toBeLessThanOrEqual(2) // etkin grup + tıklanan grup

    await act(async () => { bas('İletişim').click() })
    expect(bas('İletişim').getAttribute('aria-expanded')).toBe('true')
    expect(bas('Tedavi').getAttribute('aria-expanded')).toBe('false')
  })

  it('erişimi olmayan rolün menüsü görünmez (ölü menü yok)', async () => {
    setSession({ ...HEKIM, role: 'teknisyen' })
    render(
      <MemoryRouter initialEntries={['/personel']}>
        <PanelLayout><div>içerik</div></PanelLayout>
      </MemoryRouter>
    )
    await act(async () => {})
    const yazi = document.body.textContent || ''
    // Teknisyen için hekim modülleri görünmemeli
    expect(yazi).not.toContain('Tedavi Süreleri')
    // Devlet projesidir: ücret ekranları hiçbir rol için var olmamalı
    expect(yazi).not.toContain('Fiyatlandırma')
    expect(yazi).not.toContain('Bakiye')
    expect(yazi).not.toContain('Malzeme Envanteri')
    expect(yazi).not.toContain('Laboratuvar')
  })
})
