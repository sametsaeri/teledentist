import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DEPARTMENTS } from '../data/departments.js'
import { listDoctors } from '../services/db.js'
import { Tooth as ToothIcon } from '../components/Icons.jsx'

const BRANCH_TR = {
  genel: 'Genel Diş', restoratif: 'Restoratif', endodonti: 'Endodonti',
  periodontoloji: 'Periodontoloji', pedodonti: 'Pedodonti', ortodonti: 'Ortodonti',
  protez: 'Protez', 'ağız-cerrahi': 'Ağız ve Çene Cerrahisi'
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
              <ToothIcon size={34} color={d.color} />
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
          <p>Adres: KTÜ Kampüsü, 61061 Ortahisar / Trabzon</p>
          <a href="https://www.ktu.edu.tr/dents" target="_blank" rel="noreferrer">
            <button className="ghost">Fakülte iletişim ve adres bilgisi</button>
          </a>
        </div>
        <div className="card">
          <h3>Hekimlerimiz ({doctors.length})</h3>
          {doctors.length === 0 && (
            <p className="muted">
              Henüz hekim kaydı eklenmemiş. Hekimler süper admin tarafından tanımlanır.
            </p>
          )}
          {doctors.map((d) => (
            <p key={d.id}>
              <strong>Dt. {d.name}</strong>{' '}
              {d.branch && d.branch !== 'genel' ? <span className="muted">({BRANCH_TR[d.branch] || d.branch})</span> : null}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
