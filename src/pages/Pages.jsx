import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { demoUsers } from '../data/mock.js'
import { Reveal } from '../components/Reveal.jsx'
import { load, save, keys, setSession } from '../services/store.js'
import { suggestRecall } from '../ai/recall.js'

export function Home() {
  const { t } = useTranslation()
  return (
    <div>
      <div className="hero">
        <h1>{t('home_title')}</h1>
        <p>{t('home_desc')} Kapsam yalnızca diş hekimliği hastalarıdır.</p>
        <div className="hero-actions">
          <Link to="/randevu"><span className="btn btn-primary">{t('home_cta1')}</span></Link>
          <Link to="/teledentistry"><span className="btn btn-ghost">{t('home_cta2')}</span></Link>
          <Link to="/hekim"><span className="btn btn-teal">Hekim Portalı</span></Link>
        </div>
        <div className="stat-row">
          <div className="stat"><b>32</b>FDI diş takibi</div>
          <div className="stat"><b>3/6/12</b>AI recall önerisi</div>
          <div className="stat"><b>TR/EN</b>Çift dil</div>
        </div>
      </div>
      <h2 className="section-title">Diş Hekimliğine Özel Modüller</h2>
      <div className="grid">
        <div className="card feature"><span className="feature-icon">T</span><div><h3>Tarama / Triyaj</h3><p className="muted">Diş şikayetine özel ilk değerlendirme ve yönlendirme.</p><Link to="/randevu"><button>Randevu Al</button></Link></div></div>
        <div className="card feature"><span className="feature-icon">H</span><div><h3>Hekim Portalı</h3><p className="muted">Diş hastası yönetimi, röntgen, diş bazlı değerlendirme.</p><Link to="/hekim"><button className="ghost">Hekim Girişi</button></Link></div></div>
        <div className="card feature"><span className="feature-icon">D</span><div><h3>Hasta Paneli</h3><p className="muted">Diş haritası, röntgenim, hekim notu, AI bilgilendirme.</p><Link to="/hastam"><button className="ghost">Dişlerim</button></Link></div></div>
      </div>
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

  if (done) return <div className="card"><h1>Talebiniz alındı</h1><p>Hekim panelinde görüntülenecek (demo kayıt). Yeni talep için sayfayı yenileyin.</p><Link to="/hekim"><button className="ghost">Hekim Paneline Bak</button></Link></div>

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
        <p className="muted">Kayıt tarayıcıda saklanır (demo). Backend bağlanınca gerçek takvime geçecek.</p>
        <p><Link to="/e-randevu"><button className="ghost">← Bölüm Seçimine Dön</button></Link></p>
      </div>
    </div>
  )
}

export function Login() {
  const [email, setEmail] = useState('hasta@demo')
  const nav = useNavigate()
  const login = () => {
    const u = demoUsers.find((x) => x.email === email.trim())
    if (!u) return alert('Demo hesap bulunamadı. Örn: hasta@demo')
    setSession({ ...u, loginAt: new Date().toISOString() })
    if (u.role === 'hekim') nav('/hekim')
    else if (u.role === 'ebeveyn') nav('/hastam')
    else nav('/hastam')
  }
  return (
    <div>
      <h1>Hasta / Ebeveyn / Hekim Girişi (Demo)</h1>
      <div className="card">
        <p>Demo: hasta@demo / ebeveyn@demo / hekim@demo / ayse@demo</p>
        <input placeholder="e-posta" value={email} onChange={(e) => setEmail(e.target.value)} /><br /><br />
        <button onClick={login}>Giriş Yap</button>
      </div>
    </div>
  )
}

export function Dashboard() {
  const pats = demoUsers.filter((u) => u.role === 'hasta')
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
