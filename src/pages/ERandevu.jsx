import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEPARTMENTS } from '../data/departments.js'
import { listDoctors } from '../services/db.js'

function ToothIcon({ color }) {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C7 2 4 6 4 10c0 3 2 4 3 7 .6 1.8 1 5 2.2 5 1.4 0 .8-4 2.8-4s1.4 4 2.8 4c1.2 0 1.6-3.2 2.2-5 1-3 3-4 3-7 0-4-3-8-8-8z" fill={color} />
    </svg>
  )
}

export function ERandevu() {
  const [doctors, setDoctors] = useState([])
  useEffect(() => { listDoctors().then(setDoctors) }, [])
  return (
    <div>
      <div className="faculty-bar">
        <img src="/ktu-logo.png" alt="KTÜ" className="ktu-logo" />
        <div>
          <strong>KARADENİZ TEKNİK ÜNİVERSİTESİ</strong>
          <div className="muted">Diş Hekimliği Fakültesi | DHF E-Randevu</div>
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

      <div className="grid">
        <div className="card">
          <h3>Klinik Bilgileri</h3>
          <p className="muted">KTÜ Diş Hekimliği Fakültesi Kliniği</p>
          <p>Hafta içi 08:30 - 17:30 | Randevulu hasta kabulü</p>
          <p className="muted">Adres ve telefon bilgisini klinik yönetiminden alıp buraya yazacağız.</p>
        </div>
        <div className="card">
          <h3>Hekimlerimiz ({doctors.length})</h3>
          {doctors.length === 0 && <p className="muted">Hekim listesi yakında burada.</p>}
          {doctors.map((d) => <p key={d.id}><strong>{d.name}</strong> {d.branch && d.branch !== 'genel' ? <span className="muted">({d.branch})</span> : null}</p>)}
        </div>
      </div>
    </div>
  )
}
