// KOD KURALLARI — statik denetim testleri
// Bunlar bileşen açmadan, kaynak kodu okuyarak çalışır; bu yüzden
// saniyeler içinde "böyle bir hata yazma" kuralını zorunlu kılar.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const KOK = process.cwd()
const SRC = path.join(KOK, 'src')

function tumDosyalar(uzanti = ['.js', '.jsx']) {
  const cikti = []
  const gez = (d) => {
    for (const ad of fs.readdirSync(d)) {
      if (ad === 'node_modules' || ad === 'dist' || ad === '.git') continue
      const yol = path.join(d, ad)
      const st = fs.statSync(yol)
      if (st.isDirectory()) gez(yol)
      else if (uzanti.includes(path.extname(yol))) cikti.push(yol)
    }
  }
  gez(SRC)
  return cikti
}

const KAYNAKLAR = tumDosyalar()
// Test dosyaları kendi hatalarını anlatmak için bu kalıpları yorumda içerebilir
const JSX = KAYNAKLAR.filter((f) => f.endsWith('.jsx') && !f.includes('.test.'))

const oku = (f) => fs.readFileSync(f, 'utf8')
const gor = (f) => path.relative(KOK, f)

describe('Kural 1 — useEffect asla doğrudan fonksiyon referansı almaz', () => {
  it('`useEffect(load, [])` biçimi hiçbir yerde kullanılmıyor', () => {
    // 16.10.2026 beyaz ekran hatasının kaynağıydı:
    // useEffect bir Promise döndüren fonksiyonu "temizleme fn" sanıp çağırıyordu.
    const supheli = []
    for (const f of JSX) {
      oku(f).split('\n').forEach((s, i) => {
        if (/useEffect\(\s*[A-Za-z_$][\w$]*\s*(,|\))/.test(s)) supheli.push(`${gor(f)}:${i + 1}  ${s.trim()}`)
      })
    }
    expect(supheli, `useEffect doğrudan fonksiyon alıyor (temizleme riski):\n${supheli.join('\n')}`).toHaveLength(0)
  })

  it('kısa gövdeli useEffect yok — hepsi blok gövdeli', () => {
    // `useEffect(() => load(), [])` de Promise döner; yalnız `() => { ... }` güvenlidir.
    const supheli = []
    for (const f of JSX) {
      oku(f).split('\n').forEach((s, i) => {
        const m = s.match(/useEffect\(\(\)\s*=>\s*/)
        if (!m) return
        const sonraki = s.slice(m.index + m[0].length)
        // `=>` ve `(` arasında kalan tüm boşlukları at
        const ilk = sonraki.trimStart()[0]
        if (ilk && ilk !== '{') supheli.push(`${gor(f)}:${i + 1}  ${s.trim()}`)
      })
    }
    expect(supheli, `Kısa gövdeli useEffect (temizleme riski):\n${supheli.join('\n')}`).toHaveLength(0)
  })
})

describe('Kural 2 — Ölü buton/menü/yer tutucu olmaz', () => {
  it('hiçbir yerde "yakında geliyor" tarzı yer tutucu metin yok', () => {
    const supheli = []
    // Not: boş durum açıklamaları ("henüz eklenmemiş") meşrudur; yalnız
// "bu özellik yapılacak" anlamına gelen ifadeler yasaktır.
    const desen = /\b(TODO|FIXME|XXX)\b|yakında|coming soon|devamı(na)? (gelecek|eklenecek)|henüz (aktif değil|yapılmadı)/i
    for (const f of JSX) {
      oku(f).split('\n').forEach((s, i) => {
        if (desen.test(s)) supheli.push(`${gor(f)}:${i + 1}  ${s.trim().slice(0, 80)}`)
      })
    }
    expect(supheli, `Yer tutucu metin:\n${supheli.join('\n')}`).toHaveLength(0)
  })

  it('her sayfa dosyası bir yerde import ediliyor (kullanılmayan sayfa yok)', () => {
    const tumKod = KAYNAKLAR.map(oku).join('\n')
    const olu = fs.readdirSync(path.join(SRC, 'pages'))
      .filter((f) => f.endsWith('.jsx') && !f.includes('.test.'))
      .map((f) => f.replace('.jsx', ''))
      .filter((ad) => !new RegExp(`[./'"]${ad}(\\.jsx)?['"]`).test(tumKod))
    expect(olu, `Hiçbir yerde import edilmeyen sayfa: ${olu.join(', ')}`).toHaveLength(0)
  })

  it('her rol için panel menüsü tanımlı', () => {
    const kod = oku(path.join(SRC, 'components/PanelLayout.jsx'))
    for (const rol of ['hekim', 'admin', 'hasta', 'ebeveyn', 'sekreter', 'teknisyen']) {
      const tanimli = new RegExp(`(^|\\n)\\s*${rol}:\\s*\\[|MENUS\\.${rol}\\s*=|MENUS\\.${rol}\\s*:`).test(kod)
      expect(tanimli, `PanelLayout'ta ${rol} menüsü yok`).toBe(true)
    }
    expect(kod).toMatch(/ROLE_TR\s*=/)
  })

  it('panel rotaları rol korumasıyla tanımlı', () => {
    const appKod = oku(path.join(SRC, 'App.jsx'))
    expect(appKod).toMatch(/roles=\{\['hekim'\]\}/)
    expect(appKod).toMatch(/roles=\{\['hasta', 'ebeveyn'[^\]]*\]\}/)
    expect(appKod).toContain('/personel-girisi')
    expect(appKod).toContain('/hekim-girisi')
    expect(appKod).toContain('path="/admin"')
  })
})

describe('Kural 3 — Emoji yerine gerçek SVG ikon', () => {
  it('kaynak kodda gerçek emoji karakteri bulunmuyor', () => {
    // Not: → ✓ ★ gibi tipografik işaretler emoji değildir, metin içinde kullanılabilir.
    // Gerçek emoji (renkli resim karakterleri) yasaktır.
    const emoji = /[\u{1F000}-\u{1FAFF}\u{2705}\u{274C}\u{2B50}\u{2B55}\u{26A0}\u{FE0F}]/u
    const olu = []
    for (const f of JSX) if (emoji.test(oku(f))) olu.push(gor(f))
    expect(olu, `Emoji içeren dosya: ${olu.join(', ')}`).toHaveLength(0)
  })

  it('ikonlar tek merkezden (Icons.jsx) geliyor', () => {
    // ToothChart gibi görselleştirme dosyaları kendi çizimini yapabilir
    const muaf = ['ToothChart.jsx', 'Icons.jsx']
    const olu = []
    for (const f of JSX) {
      if (muaf.some((m) => f.endsWith(m))) continue
      if (/<svg/i.test(oku(f))) olu.push(gor(f))
    }
    expect(olu, `Elle yazılmış <svg> içeren dosya: ${olu.join(', ')}`).toHaveLength(0)
  })
})

describe('Kural 4 — Gizli dosyalar korunur', () => {
  it('.env dosyaları .gitignore içinde', () => {
    expect(oku(path.join(KOK, '.gitignore'))).toMatch(/\.env/)
  })

  it('.env örneğinde tarayıcıya sızan gizli anahtar yok', () => {
    // Tarayıcıya giden değişkenler yalnızca VITE_ önekli olabilir.
    // SUPABASE_ACCESS_TOKEN / PROJECT_REF yalnızca terminal komutları içindir.
    const sunucuTarafi = ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_REF', 'SUPABASE_DB_URL']
    for (const satir of oku(path.join(KOK, '.env.example')).split('\n')) {
      const m = satir.match(/^\s*([A-Za-z_]+)\s*=/)
      if (!m) continue
      const ad = m[1]
      if (sunucuTarafi.includes(ad)) continue
      expect(ad, `${ad} tarayıcıya sızabilir; VITE_ öneki kullanılmalı`).toMatch(/^VITE_/)
    }
  })
})