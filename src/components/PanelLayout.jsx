import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { currentUser, logout } from '../services/auth.js'
import { listNotifications, listAppointments, listRequests } from '../services/db.js'
import {
  Logo, Shield, Stethoscope, Users, Clipboard, Drop, Sparkle, Camera, Video, Chat,
  Clock, User, LogOut, Globe, Bell, ChevronDown, Alert, Settings, Chart,
  Package, Flask, Tag, Receipt, FileText, Calendar
} from './Icons.jsx'

// Hekim menüsü gruplara ayrılır; her grup açılır-kapanır listelenir.
// 'count' alanı panelin canlı verisinden gelen rozet sayısıdır.
const MENU_GROUPS = {
  hekim: [
    {
      label: 'Genel', Icon: Chart, items: [
        ['/hekim', Stethoscope, 'Genel Bakış'],
        ['/hekim?tab=gunluk', Clock, 'Günlük Akış']
      ]
    },
    {
      label: 'Klinik', Icon: Stethoscope, items: [
        ['/hekim?tab=hastalar', Users, 'Hastalarım'],
        ['/hekim?tab=gunluk-not', Clipboard, 'Klinik Günlük']
      ]
    },
    {
      label: 'Planlama', Icon: Calendar, items: [
        ['/hekim?tab=randevu', Clipboard, 'Randevu Talepleri', 'randevu'],
        ['/hekim?tab=takvim', Clock, 'Takvim']
      ]
    },
    {
      label: 'Değerlendirme', Icon: Sparkle, items: [
        ['/hekim?tab=triyaj', Sparkle, 'Triyaj ve Sevk'],
        ['/hekim?tab=foto', Camera, 'Hasta Fotoğrafları']
      ]
    },
    {
      label: 'İşletme', Icon: Package, items: [
        ['/hekim?tab=envanter', Package, 'Malzeme Envanteri'],
        ['/hekim?tab=laboratuvar', Flask, 'Laboratuvar']
      ]
    },
    {
      label: 'Finans', Icon: Receipt, items: [
        ['/hekim?tab=fiyat', Tag, 'Fiyatlandırma'],
        ['/hekim?tab=hesap', Receipt, 'Hesap ve Bakiye']
      ]
    },
    {
      label: 'Kayıtlar', Icon: FileText, items: [
        ['/hekim?tab=istek', FileText, 'Kayıt İstekleri', 'istek']
      ]
    },
    {
      label: 'İletişim', Icon: Chat, items: [
        ['/video', Video, 'Online Görüşme'],
        ['/hatirlatma', Bell, 'Hatırlatmalar'],
        ['/konsultasyon', Chat, 'Konsültasyon']
      ]
    },
    {
      label: 'Hesap', Icon: Settings, items: [
        ['/hesap', Settings, 'Hesap Ayarları']
      ]
    }
  ]
}

const MENUS = {
  admin: [
    ['/admin/panel', Shield, 'Süper Admin'],
    ['/hekim', Stethoscope, 'Hekim Paneli'],
    ['/hastam', User, 'Hasta Paneli'],
    ['/hatirlatma', Clock, 'Hatırlatmalar'],
    ['/konsultasyon', Chat, 'Konsültasyon'],
    ['/hesap', Settings, 'Hesap Ayarları']
  ],
  hekim: [],
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
  const groups = MENU_GROUPS[u?.role] || null
  const flat = MENUS[u?.role] || MENUS.hasta
  const out = async () => { await logout(); nav('/') }
  const isStaff = u?.role === 'hekim' || u?.role === 'admin'

  // Canlı rozet sayıları (randevu talebi, kayıt isteği)
  const [counts, setCounts] = useState({ randevu: 0, istek: 0 })
  useEffect(() => {
    if (u?.role !== 'hekim') return
    let alive = true
    const load = () => Promise.all([listAppointments(), listRequests()]).then(([ap, rq]) => {
      if (!alive) return
      setCounts({ randevu: (ap || []).filter((a) => a.status === 'yeni').length, istek: (rq || []).length })
    })
    load()
    const t = setInterval(load, 60000)
    return () => { alive = false; clearInterval(t) }
  }, [u?.role])

  // Açık olan gruplar: etkin sayfanın grubu her zaman açık, seçenek hatırlanır
  const isActive = (to) => {
    const [base, search] = to.split('?')
    const wantTab = search ? new URLSearchParams(search).get('tab') : 'ozet'
    const gotTab = new URLSearchParams(loc.search).get('tab') || 'ozet'
    return loc.pathname === base && wantTab === gotTab
  }
  const activeGroup = groups?.find((g) => g.items.some((i) => isActive(i[0])))?.label || null

  const [open, setOpen] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('td_menu_open') || 'null')
      return s && typeof s === 'object' ? s : {}
    } catch { return {} }
  })
  // Etkin sayfanın grubu her zaman açık kalır; diğerleri kullanıcının tercihine bağlı
  const isOpen = (label) => (label === activeGroup ? true : open[label] === true)
  const toggle = (label) => {
    const next = { ...open, [label]: !isOpen(label) }
    setOpen(next)
    try { localStorage.setItem('td_menu_open', JSON.stringify(next)) } catch { /* yoksay */ }
  }

  return (
    <div className="panel">
      <aside className="panel-side">
        <div className="panel-brand">
          <Logo size={26} />
          <span>TeleDentist</span>
        </div>
        <span className={`role-badge ${u?.role}`}>{ROLE_TR[u?.role]}</span>
        <nav className="panel-menu">
          {groups
            ? groups.map((g) => {
                const openNow = isOpen(g.label)
                return (
                  <div className={`menu-group ${openNow ? 'open' : ''}`} key={g.label}>
                    <button className="menu-group-head" onClick={() => toggle(g.label)} aria-expanded={openNow}>
                      <g.Icon size={15} />
                      <span>{g.label}</span>
                      <ChevronDown size={15} className="caret" />
                    </button>
                    <div className="menu-group-body" hidden={!openNow}>
                      {g.items.map(([to, Icon, label, countKey]) => (
                        <Link key={to} to={to} className={isActive(to) ? 'active' : ''}>
                          <Icon size={16} /> {label}
                          {countKey && counts[countKey] > 0 && (
                            <span className="menu-count">{counts[countKey]}</span>
                          )}
                        </Link>
                      ))}
                    </div>
                  </div>
                )
              })
            : flat.map(([to, Icon, label]) => (
                <Link key={to} to={to} className={isActive(to) ? 'active' : ''}>
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