import { Link } from 'react-router-dom'
import { DEPARTMENTS } from '../data/departments.js'

function ToothIcon({ color }) {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C7 2 4 6 4 10c0 3 2 4 3 7 .6 1.8 1 5 2.2 5 1.4 0 .8-4 2.8-4s1.4 4 2.8 4c1.2 0 1.6-3.2 2.2-5 1-3 3-4 3-7 0-4-3-8-8-8z" fill={color} />
    </svg>
  )
}

export function ERandevu() {
  return (
    <div>
      <div className="faculty-bar">
        <img src="/ktu-logo.png" alt="KTÜ" className="ktu-logo" />
        <div>
          <strong>KARADENİZ TEKNİK ÜNİVERSİTESİ</strong>
          <div className="muted">Diş Hekimliği Fakültesi | DHF E-Randevu (Demo)</div>
        </div>
      </div>

      <div className="erandevu-hero">
        <div>
          <h1>E-RANDEVULARA GİRİŞ</h1>
          <p>Tedavi randevularınızı kolayca oluşturmak için <strong>E-Randevu</strong> sistemimizi kullanabilirsiniz.</p>
          <p className="muted">Kapsam: yalnızca diş hekimliği bölümleri.</p>
        </div>
        <div className="trust-badge">
          <b>HIZLI<br />KOLAY<br />GÜVENİLİR</b>
        </div>
      </div>

      <div className="dept-grid">
        {DEPARTMENTS.map((d) => (
          <div className="dept-card" key={d.id}>
            <div className="dept-visual" style={{ borderTopColor: d.color }}>
              <ToothIcon color={d.color} />
            </div>
            <h3>{d.title}<br />{d.sub}</h3>
            <p className="muted">{d.desc}</p>
            <Link to={`/randevu?dept=${d.id}`}><button>Randevu Al</button></Link>
          </div>
        ))}
      </div>

      <div className="card toolbar">
        <span className="badge">Bilgi</span>
        <span>Randevu saatinden en az 15 dakika önce klinikte hazır bulunun.</span>
        <Link to="/randevu"><button className="ghost">E-RANDEVU SİSTEMİNE GİRİŞ İÇİN TIKLAYINIZ</button></Link>
      </div>
    </div>
  )
}
