import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { currentUser, logout } from '../services/auth.js'
import { listNotifications } from '../services/db.js'

const MENUS = {
  admin: [
    ['/admin/panel', '🛡️ Süper Admin'],
    ['/hekim', '👨‍⚕️ Hekim Paneli'],
    ['/hatirlatma', '⏰ Hatırlatmalar'],
    ['/konsultasyon', '💬 Konsültasyon']
  ],
  hekim: [
    ['/hekim', '🧑‍⚕️ Hekim Paneli'],
    ['/triyaj', '🩺 Triyaj'],
    ['/hijyen', '🪥 Hijyen'],
    ['/anksiyete', '😌 Anksiyete'],
    ['/on-degerlendirme', '📷 Foto Değerlendirme'],
    ['/video', '📹 Online Görüşme'],
    ['/konsultasyon', '💬 Konsültasyon'],
    ['/hatirlatma', '⏰ Hatırlatmalar']
  ],
  hasta: [
    ['/hastam', '🦷 Dişlerim'],
    ['/triyaj', '🩺 Triyaj'],
    ['/hijyen', '🪥 Hijyen'],
    ['/anksiyete', '😌 Anksiyete'],
    ['/on-degerlendirme', '📷 Foto'],
    ['/video', '📹 Online Görüşme'],
    ['/egitim', '🎓 Eğitim'],
    ['/kampanya', '🎉 Kampanya'],
    ['/memnuniyet', '⭐ Memnuniyet']
  ]
}
MENUS.ebeveyn = MENUS.hasta

const ROLE_TR = { hekim: 'Hekim', hasta: 'Hasta', ebeveyn: 'Ebeveyn', admin: 'Süper Admin' }

// Sağ üstteki bildirim zili
function Bell() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let alive = true
    const load = () => listNotifications().then((r) => alive && setItems(r.items || []))
    load()
    const t = setInterval(load, 60000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  return (
    <div className="bell-wrap">
      <button className="bell" onClick={() => setOpen(!open)} aria-label="Bildirimler">
        🔔 <span className="bell-count">{items.length}</span>
      </button>
      {open && (
        <div className="bell-menu">
          <h4>Bildirimler ({items.length})</h4>
          {items.length === 0 && <p className="muted">Şu an acil bildirim yok.</p>}
          {items.map((n) => (
            <div key={n.id} className={`bell-item ${n.type}`}>
              <b>{n.days === 0 ? '🔴 BUGÜN' : `⏳ ${n.days} gün`}</b>
              <strong>{n.title}</strong>
              <p>{n.text}</p>
              {n.patientId && <Link to={`/hekim/hasta/${n.patientId}`} onClick={() => setOpen(false)}>Hastayı aç →</Link>}
            </div>
          ))}
          <p className="muted">Bildirimler hastanın hatırlatma gününe göre otomatik üretilir.</p>
        </div>
      )}
    </div>
  )
}

export function PanelLayout({ children }) {
  const loc = useLocation()
  const nav = useNavigate()
  const u = currentUser()
  const menu = MENUS[u?.role] || MENUS.hasta
  const out = async () => { await logout(); nav('/') }
  const isStaff = u?.role === 'hekim' || u?.role === 'admin'
  return (
    <div className="panel">
      <aside className="panel-side">
        <div className="panel-brand">
          <span className="brand-mark">🦷</span>
          <span>TeleDentist</span>
          <span className={`role-badge ${u?.role}`}>{ROLE_TR[u?.role]}</span>
        </div>
        <nav className="panel-menu">
          {menu.map(([to, label]) => (
            <Link key={to} to={to} className={loc.pathname === to ? 'active' : ''}>{label}</Link>
          ))}
        </nav>
        <div className="panel-foot">
          <span className="panel-user">👤 {u?.name}</span>
          <button className="ghost" onClick={out}>🚪 Çıkış</button>
          <Link to="/">🌐 Siteye Dön</Link>
        </div>
      </aside>

      <div className="panel-main">
        <header className="panel-top">
          <span className="muted">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <span className="spacer" />
          {isStaff && <Bell />}
        </header>
        <main>{children}</main>
        <footer className="footer">
          <div>© Karadeniz Teknik Üniversitesi © Diş Hekimliği Öğrencisi Resul Yel - Hakları Saklıdır</div>
        </footer>
      </div>
    </div>
  )
}