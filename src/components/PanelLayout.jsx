import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { currentUser, logout } from '../services/auth.js'
import { listNotifications } from '../services/db.js'
import {
  Logo, Shield, Stethoscope, Users, Clipboard, Drop, Sparkle, Camera, Video, Chat,
  Clock, User, LogOut, Globe, Bell, ChevronDown, Alert, Settings
} from './Icons.jsx'

const MENUS = {
  admin: [
    ['/admin/panel', Shield, 'Süper Admin'],
    ['/hekim', Stethoscope, 'Hekim Paneli'],
    ['/hastam', User, 'Hasta Paneli'],
    ['/hatirlatma', Clock, 'Hatırlatmalar'],
    ['/konsultasyon', Chat, 'Konsültasyon'],
    ['/hesap', Settings, 'Hesap Ayarları']
  ],
  hekim: [
    ['/hekim', Stethoscope, 'Hekim Paneli'],
    ['/hastam', User, 'Hasta Paneli'],
    ['/triyaj', Clipboard, 'Triyaj'],
    ['/hijyen', Drop, 'Hijyen'],
    ['/anksiyete', Sparkle, 'Anksiyete'],
    ['/on-degerlendirme', Camera, 'Foto Değerlendirme'],
    ['/video', Video, 'Online Görüşme'],
    ['/konsultasyon', Chat, 'Konsültasyon'],
    ['/hatirlatma', Clock, 'Hatırlatmalar'],
    ['/hesap', Settings, 'Hesap Ayarları']
  ],
  hasta: [
    ['/hastam', Clipboard, 'Dişlerim'],
    ['/triyaj', Clipboard, 'Triyaj'],
    ['/hijyen', Drop, 'Hijyen'],
    ['/anksiyete', Sparkle, 'Anksiyete'],
    ['/on-degerlendirme', Camera, 'Foto'],
    ['/video', Video, 'Online Görüşme'],
    ['/hesap', Settings, 'Hesap Ayarları'],
    ['/egitim', Sparkle, 'Eğitim'],
    ['/kampanya', Sparkle, 'Kampanya'],
    ['/memnuniyet', Sparkle, 'Memnuniyet']
  ]
}
MENUS.ebeveyn = MENUS.hasta

const ROLE_TR = { hekim: 'Hekim', hasta: 'Hasta', ebeveyn: 'Ebeveyn', admin: 'Süper Admin' }

function BellBox() {
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
        <Bell size={18} />
        {items.length > 0 && <span className="bell-count">{items.length}</span>}
      </button>
      {open && (
        <div className="bell-menu">
          <h4>Bildirimler ({items.length})</h4>
          {items.length === 0 && <p className="muted">Şu an acil bildirim yok.</p>}
          {items.map((n) => (
            <div key={n.id} className={`bell-item ${n.type}`}>
              <b><Alert size={12} /> {n.days === 0 ? 'BUGÜN' : `${n.days} gün kaldı`}</b>
              <strong>{n.title}</strong>
              <p>{n.text}</p>
              {n.patientId && <Link to={`/hekim/hasta/${n.patientId}`} onClick={() => setOpen(false)}>Hastayı aç →</Link>}
            </div>
          ))}
          <p className="muted">Hatırlatmalar, hastanın seçtiği gün sayısı kadar önceden üretilir.</p>
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
          <Logo size={26} />
          <span>TeleDentist</span>
        </div>
        <span className={`role-badge ${u?.role}`}>{ROLE_TR[u?.role]}</span>
        <nav className="panel-menu">
          {menu.map(([to, Icon, label]) => (
            <Link key={to} to={to} className={loc.pathname === to ? 'active' : ''}>
              <Icon size={17} /> {label}
            </Link>
          ))}
        </nav>
        <div className="panel-foot">
          <span className="panel-user"><User size={15} /> {u?.name}</span>
          <button className="ghost" onClick={out}><LogOut size={15} /> Çıkış</button>
          <Link to="/"><Globe size={15} /> Siteye Dön</Link>
        </div>
      </aside>

      <div className="panel-main">
        <header className="panel-top">
          <span className="muted">{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <span className="spacer" />
          {isStaff && <BellBox />}
        </header>
        <main>{children}</main>
        <footer className="footer">
          <div>© Karadeniz Teknik Üniversitesi © Diş Hekimliği Öğrencisi Resul Yel - Hakları Saklıdır</div>
        </footer>
      </div>
    </div>
  )
}