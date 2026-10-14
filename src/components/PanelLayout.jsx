import { Link, useLocation, useNavigate } from 'react-router-dom'
import { currentUser, logout } from '../services/auth.js'

const MENUS = {
  hekim: [
    ['/hekim', 'Hastalar'],
    ['/triyaj', 'Triyaj Formu'],
    ['/hijyen', 'Hijyen'],
    ['/anksiyete', 'Anksiyete'],
    ['/on-degerlendirme', 'Foto'],
    ['/konsultasyon', 'Konsültasyon'],
    ['/hatirlatma', 'Hatırlatma'],
    ['/video', 'Video']
  ],
  hasta: [
    ['/hastam', 'Dişlerim'],
    ['/triyaj', 'Triyaj'],
    ['/hijyen', 'Hijyen'],
    ['/anksiyete', 'Anksiyete'],
    ['/on-degerlendirme', 'Foto'],
    ['/video', 'Video'],
    ['/egitim', 'Eğitim'],
    ['/kampanya', 'Kampanya'],
    ['/memnuniyet', 'Memnuniyet']
  ],
  ebeveyn: [
    ['/hastam', 'Dişlerim'],
    ['/triyaj', 'Triyaj'],
    ['/hijyen', 'Hijyen'],
    ['/anksiyete', 'Anksiyete'],
    ['/on-degerlendirme', 'Foto'],
    ['/video', 'Video'],
    ['/egitim', 'Eğitim'],
    ['/kampanya', 'Kampanya'],
    ['/memnuniyet', 'Memnuniyet']
  ],
  admin: [
    ['/admin', 'Admin'],
    ['/hekim', 'Hekim Paneli'],
    ['/konsultasyon', 'Konsültasyon']
  ]
}

const ROLE_TR = { hekim: 'Hekim', hasta: 'Hasta', ebeveyn: 'Ebeveyn', admin: 'Admin' }

export function PanelLayout({ children }) {
  const loc = useLocation()
  const nav = useNavigate()
  const u = currentUser()
  const menu = MENUS[u?.role] || MENUS.hasta
  const out = async () => { await logout(); nav('/') }
  return (
    <div className="panel">
      <aside className="panel-side">
        <div className="panel-brand"><span className="brand-mark">TD</span> TeleDentist <span className={`role-badge ${u?.role}`}>{ROLE_TR[u?.role]}</span></div>
        <nav className="panel-menu">
          {menu.map(([to, label]) => (
            <Link key={to} to={to} className={loc.pathname === to ? 'active' : ''}>{label}</Link>
          ))}
        </nav>
        <div className="panel-foot">
          <span className="muted">{u?.name}</span>
          <button className="ghost" onClick={out}>Çıkış</button>
          <Link to="/">Siteye Dön</Link>
        </div>
      </aside>
      <div className="panel-main">
        <main>{children}</main>
        <footer className="footer">
          <div>© Karadeniz Teknik Üniversitesi © Diş Hekimliği Öğrencisi Resul Yel - Hakları Saklıdır</div>
        </footer>
      </div>
    </div>
  )
}
