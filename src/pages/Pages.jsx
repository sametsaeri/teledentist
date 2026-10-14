import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Reveal } from '../components/Reveal.jsx'
import { load, save, keys } from '../services/store.js'
import { login, allUsers } from '../services/auth.js'
import { suggestRecall } from '../ai/recall.js'

export function Home() {
  const { t } = useTranslation()
  return (
    <div>
      <div className="hero">
        <h1>Diş Kliniğiniz Cebinizde</h1>
        <p>Teledentist ile muayene öncesi triyaj, röntgen ve fotoğrafla ön değerlendirme, tedavi takibi tek panelde. Yalnızca diş hekimliği.</p>
        <div className="hero-actions">
          <Link to="/e-randevu"><span className="btn btn-primary">Hemen Randevu Al</span></Link>
          <Link to="/teledentistry"><span className="btn btn-ghost">{t('home_cta2')}</span></Link>
        </div>
        <div className="stat-row">
          <div className="stat"><b>4</b>Diş bölümü</div>
          <div className="stat"><b>32</b>Diş takibi (FDI)</div>
          <div className="stat"><b>3/6/12</b>Ay kontrol önerisi</div>
        </div>
      </div>

      <Reveal>
        <div className="card">
          <h2>Hekimlerimizin Amacı</h2>
          <p>Yüz yüze muayenenin yerini almak değil, onu hızlandırmak. Şikayetinizi önden alıyoruz, röntgen ve fotoğraflarınızı inceliyoruz, kliniğe hazır bir tedavi planıyla geliyorsunuz. Kırsalda yaşayan, hareket kısıtlılığı olan ve özel bakım gereksinimi olan hastalar için erişimi kolaylaştırıyoruz.</p>
        </div>
      </Reveal>

      <Reveal>
        <div className="card">
          <h2>Takip Nasıl İşler?</h2>
          <div className="grid">
            <div><h3>1. Randevu</h3><p className="muted">Bölümünü seç, şikayetini yaz, 15 dakika önce klinikte ol.</p></div>
            <div><h3>2. Ön Değerlendirme</h3><p className="muted">Triyaj anketi + fotoğraf yükle, hekim önden incelesin.</p></div>
            <div><h3>3. Tedavi</h3><p className="muted">Klinikte muayene ve tedavi, diş haritana işlenir.</p></div>
            <div><h3>4. Kontrol</h3><p className="muted">Riskine göre 3/6/12 ay sonra hatırlatma alırsın.</p></div>
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="card">
          <h2>Bölümlerimiz</h2>
          <div className="grid">
            <div><h3>Restoratif (Dolgu)</h3><p className="muted">Çürük ve kırık dişler.</p></div>
            <div><h3>Endodonti (Kanal)</h3><p className="muted">Kanal tedavileri.</p></div>
            <div><h3>Periodontoloji</h3><p className="muted">Diş eti ve diş taşı.</p></div>
            <div><h3>Pedodonti</h3><p className="muted">Çocuk diş sağlığı.</p></div>
          </div>
          <p><Link to="/e-randevu"><button>Bölüm Seç ve Randevu Al</button></Link></p>
        </div>
      </Reveal>
    </div>
  )
}

export function About() {
  const sections = [
    { t: 'Teledentistry Nedir?', d: 'Uzaktan diş hekimliği hizmetlerinin bilgi ve iletişim teknolojileri aracılığıyla sunulması.' },
    { t: 'Kullanım Alanları', d: 'Tarama (Triage), ilk değerlendirme, danışmanlık, tanı ve tedavi planlaması, takip ve kontrol, ağız-diş sağlığı eğitimi, hekimler arası konsültasyon.' },
    { t: 'Erişilebilirlik Avantajları', d: 'Kırsal bölgelerde yaşayan bireyler, hareket kısıtlılığı olan hastalar, özel bakım gereksinimi olan bireyler.' },
    { t: 'Klinik Süreçlere Katkısı', d: 'Hasta-hekim-bakıcı iletişiminin güçlenmesi, klinik karar süreçlerinin hızlanması, hibrit model (yüz yüze + uzaktan) önerisi.' },
    { t: 'Hasta Perspektifi', d: 'Yüz yüze iletişim eksikliği, şikayetleri ifade etme zorluğu, hizmete erişimde güçlük. Triyaj anketi ve fotoğrafla ön değerlendirme bu yüzden var.' },
    { t: 'Hukuki ve Etik Sorunlar', d: 'Hasta gizliliği, veri güvenliği, hukuki standart eksikliği. KVKK onamı zorunludur.' },
    { t: 'Araştırma Alanları', d: 'Dental anksiyete etkisi, evde ağız hijyeni eğitimi, plak indeksi etkileri, kırsal bölgelerde memnuniyet. Sitemizdeki anketler bu veriyi üretir.' },
    { t: 'Sonuç', d: 'Teledentistry, erişilebilirliği artıran güçlü bir tamamlayıcı sağlık hizmetidir.' }
  ]
  return (
    <div>
      <div className="info-hero">
        <h1>Teledentistry Kullanım Amaçları ve Etki Alanları</h1>
        <p>Aşağı kaydırdıkça her bölüm animasyonla açılır. Yalnızca diş hekimliği kapsamı.</p>
      </div>
      {sections.map((s, i) => (
        <Reveal key={s.t} delay={(i % 2) * 80}>
          <div className="card info-section">
            <div className="info-num">{i + 1}</div>
            <div><h3>{s.t}</h3><p>{s.d}</p></div>
          </div>
        </Reveal>
      ))}
      <Reveal>
        <div className="card toolbar">
          <Link to="/triyaj"><button>Triyajı Dene</button></Link>
          <Link to="/egitim"><button className="ghost">Eğitime Git</button></Link>
          <Link to="/e-randevu"><button className="ghost">E-Randevu</button></Link>
        </div>
      </Reveal>
    </div>
  )
}

export function Appointment() {
  const params = new URLSearchParams(window.location.search)
  const initialDept = params.get('dept') || ''
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [dept, setDept] = useState(initialDept)
  const [complaint, setComplaint] = useState('')
  const [kvkk, setKvkk] = useState(false)
  const [done, setDone] = useState(false)

  const submit = () => {
    if (!name || !contact || !complaint) return alert('Ad, iletişim ve şikayet zorunlu.')
    if (!kvkk) return alert('KVKK onayı gerekli.')
    const list = load(keys.appointments, [])
    list.push({ id: Date.now(), name, contact, dept: dept || 'genel-dis', complaint, date: new Date().toISOString().slice(0, 16), status: 'yeni' })
    save(keys.appointments, list)
    setDone(true)
  }

  if (done) return <div className="card"><h1>Talebiniz alındı</h1><p>Hekim panelinde görüntülenecek. Yeni talep için sayfayı yenileyin.</p><Link to="/hekim"><button className="ghost">Hekim Paneline Bak</button></Link></div>

  return (
    <div>
      <h1>Diş Randevusu / İletişim</h1>
      <div className="card">
        <label>Bölüm: <select value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">Seçin (genel diş)</option>
          <option value="restoratif">Restoratif (Dolgu)</option>
          <option value="endodonti">Endodonti (Kanal)</option>
          <option value="periodontoloji">Periodontoloji (Diş Eti)</option>
          <option value="pedodonti">Pedodonti (Çocuk)</option>
        </select></label><br /><br />
        <input placeholder="Ad Soyad" value={name} onChange={(e) => setName(e.target.value)} /><br /><br />
        <input placeholder="Telefon / E-posta" value={contact} onChange={(e) => setContact(e.target.value)} /><br /><br />
        <textarea placeholder="Diş şikayetiniz (örn: 16 nolu azı diş ağrısı)" rows="4" cols="40" value={complaint} onChange={(e) => setComplaint(e.target.value)} /><br /><br />
        <label><input type="checkbox" checked={kvkk} onChange={(e) => setKvkk(e.target.checked)} /> KVKK metnini okudum, verilerimin işlenmesini kabul ediyorum.</label><br /><br />
        <button onClick={submit}>Gönder</button>
        <p className="muted">Talebiniz hekim paneline iletilir.</p>
        <p><Link to="/e-randevu"><button className="ghost">← Bölüm Seçimine Dön</button></Link></p>
      </div>
    </div>
  )
}

export function Login() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()
  const doLogin = async () => {
    setBusy(true)
    setErr('')
    const r = await login(email, pass)
    setBusy(false)
    if (r.error) return setErr(r.error)
    const u = r.user
    if (u.role === 'admin') nav('/admin')
    else if (u.role === 'hekim') nav('/hekim')
    else nav('/hastam')
  }
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <img src="/ktu-logo.png" alt="KTÜ" className="ktu-logo-lg" />
        <h1>TeleDentist Giriş</h1>
        <p className="muted">KTÜ Diş Hekimliği Fakültesi | Hasta, hekim ve yönetici girişi</p>
        <input placeholder="e-posta" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /><br /><br />
        <input placeholder="şifre" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" /><br /><br />
        {err && <p className="auth-err">{err}</p>}
        <button onClick={doLogin} disabled={busy} style={{ width: '100%' }}>{busy ? 'Giriş yapılıyor...' : 'Giriş Yap'}</button>
        <p className="muted">Hesabınız yoksa hekiminize veya klinik yönetimine başvurun. Kayıtlar yalnızca hekim/admin tarafından açılır.</p>
      </div>
    </div>
  )
}

export function Dashboard() {
  const pats = allUsers().filter((u) => u.role === 'hasta')
  return (
    <div>
      <h1>Panelim</h1>
      <div className="grid">
        {pats.map((p) => {
          const r = suggestRecall({ lastVisit: p.lastVisit, treatmentType: p.treatmentType, plaqueIndex: p.plaqueIndex, anxietyScore: p.anxietyScore })
          return (
            <div className="card" key={p.id}>
              <h3>{p.name}</h3>
              <p className="muted">Plak: {p.plaqueIndex} | Anksiyete: {p.anxietyScore}</p>
              <p><span className="badge">AI recall: {r.nextVisit} ({r.months} ay)</span></p>
              <p className="muted">{r.reason}</p>
              <Link to={`/hekim/hasta/${p.id}`}><button className="ghost">Detay</button></Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
