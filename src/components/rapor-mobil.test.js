// Klinik rapor ve mobil uyumluluk testleri
//
// 1) RAPOR: hekimin girdiği tüm klinik veri rapora yansımalıdır.
//    Anamnez, dosya arşivi ve tedavi geçmişi eklenmeden önce rapor
//    yalnız diş durumu gösteriyordu — klinik kayıt eksikti.
//
// 2) MOBİL: dar ekranda menü öğeleri erişilemez hâle gelmemeli.
//    Eski kural `.panel-menu { flex-direction: row }` idi; menü grupları
//    `hidden` olduğu için telefonda çoğu bölüme ulaşılamıyordu.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const CSS = fs.readFileSync('src/index.css', 'utf8')
const RAPOR = fs.readFileSync('src/pages/Clinical.jsx', 'utf8')

// Mobil kuralları dosyanın SONUNDAki "MOBİL UYUMLULUK" bölümündedir.
// Dosyanın başında başka @media blokları da var (landing page için);
// bunlardan birine denk gelmek testleri yanlış yere düşürürdü.
const MOBIL = CSS.slice(CSS.indexOf('MOBİL UYUMLULUK'))
if (!CSS.includes('MOBİL UYUMLULUK')) throw new Error('MOBİL UYUMLULUK bölümü bulunamadı')

/**
 * Verilen breakpoint'in mobil bölümdeki TÜM bloklarını birleştirir.
 *
 * Aynı breakpoint birden çok yerde geçer (ör. 640px beş kez) ve her biri
 * farklı bileşenleri düzenler. Yalnız ilkini ya da sonuncusunu almak
 * kuralların bir kısmını kaçırır; bu yüzden hepsi toplanır.
 */
function mediaBlok(basamak) {
  const isaret = `@media (max-width: ${basamak}px)`
  const parcalar = []
  let bas = MOBIL.indexOf(isaret)
  while (bas !== -1) {
    parcalar.push(MOBIL.slice(bas, bas + 1600))
    bas = MOBIL.indexOf(isaret, bas + 1)
  }
  return parcalar.join('\n/* --- sonraki blok --- */\n')
}

describe('KLİNİK RAPOR — hekimin verisi rapora yansır', () => {
  it('anamnez bölümü raporda var', () => {
    expect(RAPOR).toMatch(/Anamnez/)
    expect(RAPOR).toContain('anamnesisApi')
  })

  it('anamnezdeki riskli durumlar raporda UYARI olarak gösterilir', () => {
    expect(RAPOR).toContain('rapor-uyari')
    expect(RAPOR).toMatch(/Kritik uyarı/)
  })

  it('sistemik hastalıklar, alerji ve ilaçlar rapora yazılır', () => {
    expect(RAPOR).toMatch(/Sistemik hastalıklar/)
    expect(RAPOR).toMatch(/Alerjiler/)
    expect(RAPOR).toMatch(/Kullandığı ilaçlar/)
  })

  it('dosya arşivi (röntgen/belge envanteri) raporda listelenir', () => {
    expect(RAPOR).toContain('listMedicalFiles')
    expect(RAPOR).toMatch(/Dosya Arşivi/)
  })

  it('randevu geçmişi rapora yazılır', () => {
    expect(RAPOR).toContain('listAppointments')
    expect(RAPOR).toMatch(/Randevu Geçmişi/)
  })

  it('klinik notlar rapora yazılır', () => {
    expect(RAPOR).toContain('notesApi')
    expect(RAPOR).toMatch(/Klinik Notlar/)
  })

  it('diş durumu üst/alt çene olarak ayrılır', () => {
    expect(RAPOR).toMatch(/Üst çene/)
    expect(RAPOR).toMatch(/Alt çene/)
  })

  it('hasta kimlik bilgileri (TC, doğum, kan grubu) raporda yer alır', () => {
    expect(RAPOR).toMatch(/T\.C\. Kimlik/)
    expect(RAPOR).toMatch(/Doğum Tarihi/)
    expect(RAPOR).toMatch(/Kan Grubu/)
  })

  it('rapor tarihi yazılır (hangi tarihte üretildi bellidir)', () => {
    expect(RAPOR).toMatch(/tarihinde oluşturuldu/)
  })

  it('KVKK rıza metni onam bölümünde yer alır', () => {
    expect(RAPOR).toMatch(/KVKK/)
    expect(RAPOR).toMatch(/5\/1/)
  })

  it('hasta ve hekim imza alanı vardır', () => {
    expect(RAPOR).toContain('imza-cizgi')
    expect(RAPOR).toMatch(/Hekim/)
  })

  it('yazdır/PDF düğmesi ve araç çubuğu vardır', () => {
    expect(RAPOR).toMatch(/Yazdır \/ PDF Kaydet/)
    expect(RAPOR).toContain('no-print')
  })

  it('rapor tanı koymadığını açıkça belirtir (tıbbi sınır)', () => {
    expect(RAPOR).toMatch(/Tıbbi tanı içermez|tedavi kararı/i)
  })

  it('yazdırmada menü ve araç çubuğu gizlenir', () => {
    const yazdir = CSS.slice(CSS.indexOf('@media print'))
    expect(yazdir).toMatch(/\.panel-side/)
    expect(yazdir).toMatch(/display: none/)
  })
})

describe('MOBİL — dar ekranda menü öğeleri erişilebilir kalır', () => {
  it('dizüstü için menü YATAY sarmalamaya zorlanmaz', () => {
    // 760px altındaki eski kural yatay menüye çeviriyordu
    const blok = mediaBlok(760)
    expect(blok).toMatch(/flex-direction:\s*column/)
  })

  it('menü öğeleri tam genişlik ve dokunulabilir yükseklikte', () => {
    const blok = mediaBlok(760)
    expect(blok).toMatch(/menu-group-body a/)
    expect(blok).toMatch(/min-height:\s*4[0-9]px/)
  })

  it('dokunma hedefleri en az 40px (44px kılavuzuna yakın)', () => {
    expect(CSS).toMatch(/@media \(max-width: 760px\), \(pointer: coarse\)/)
    expect(CSS).toMatch(/min-height:\s*4[0-9]px/)
  })

  it('küçük "tiny" butonlar mobilde büyür (onayla/sil yanlış dokunulurdu)', () => {
    expect(CSS).toMatch(/button\.tiny/)
    const blok = mediaBlok(760)
    expect(blok).toMatch(/tiny/)
  })

  it('form ızgaraları tek sütuna iner (yatay taşma olmaz)', () => {
    const blok = mediaBlok(640)
    expect(blok).toMatch(/grid-template-columns:\s*1fr/)
  })

  it('inputlar mobilde 16px olur (iOS otomatik yakınlaştırmasın)', () => {
    expect(CSS).toMatch(/font-size:\s*16px\s*!important/)
  })

  it('inputlar en az 46px yükseklikte (klavye kapatmaz)', () => {
    expect(CSS).toMatch(/min-height:\s*46px/)
  })

  it('KPI kutuları 2 sütunda kalır (dikeyde yer israfı olmaz)', () => {
    const blok = mediaBlok(640)
    expect(blok).toMatch(/kpi-row[\s\S]{0,120}repeat\(2, 1fr\)/)
  })

  it('tablolar yatay kaydırılır (taşmaz)', () => {
    const blok = mediaBlok(760)
    expect(blok).toMatch(/overflow-x:\s*auto/)
  })

  it('modal tam ekran olur (metin sığmaz)', () => {
    const blok = mediaBlok(640)
    expect(blok).toMatch(/\.modal\b/)
    expect(blok).toMatch(/min-height:\s*100vh/)
  })

  it('arşiv ve istek satırları alt alta yığılır', () => {
    const blok = mediaBlok(760)
    expect(blok).toMatch(/arsiv-satir/)
    expect(blok).toMatch(/flex-direction:\s*column/)
  })

  it('arşiv eylem butonları dokunulabilir ve tam genişlik', () => {
    const blok = mediaBlok(760)
    expect(blok).toMatch(/arsiv-eylem button/)
  })

  it('anamnez hastalık kutucukları büyür', () => {
    const blok = mediaBlok(640)
    expect(blok).toMatch(/hastalik-chip/)
  })

  it('KVKK metni mobilde okunur yükseklikte', () => {
    const blok = mediaBlok(640)
    expect(blok).toMatch(/kvkk-metin/)
    expect(blok).toMatch(/max-height:\s*5\dvh/)
  })

  it('randevu/görüşme butonları tam genişlik', () => {
    const blok = mediaBlok(760)
    expect(blok).toMatch(/rg-satir/)
    expect(blok).toMatch(/width:\s*100%/)
  })

  it('hasta paneli eylem butonları tam genişlik', () => {
    const blok = mediaBlok(640)
    expect(blok).toMatch(/record-actions/)
  })

  it('giriş/kayıt ekranı butonları en az 50px', () => {
    const blok = mediaBlok(640)
    expect(blok).toMatch(/btn-full/)
    expect(blok).toMatch(/min-height:\s*50px/)
  })

  it('dokunmatik cihaz tespiti yapılır (pointer: coarse)', () => {
    expect(CSS).toContain('pointer: coarse')
  })
})