import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { currentUser, logout } from '../services/auth.js'
import { listNotifications, listAppointments, listRequests } from '../services/db.js'
import { BakimBanti } from './BakimPaneli.jsx'
import { BildirimZil } from './BildirimMerkezi.jsx'
import { okunmamisSayisi } from '../services/bildirim.js'
import {
  Logo, Shield, Stethoscope, Users, Clipboard, Sparkle, Camera, Video, Chat,
  Clock, User, LogOut, Globe, Bell, ChevronDown, Alert, Settings, Chart,
  FileText, Calendar, Box
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
      label: 'Hastalar', Icon: Users, items: [
        ['/hekim?tab=hastalar', Users, 'Hastalarım'],
        ['/hekim?tab=gunluk-not', Clipboard, 'Klinik Günlük']
      ]
    },
    {
      label: 'Randevu', Icon: Calendar, items: [
        ['/hekim?tab=yaklasan', Calendar, 'Yaklaşan Randevular'],
        ['/hekim?tab=takvim', Clock, 'Takvim'],
        ['/hekim?tab=randevu', Clipboard, 'Randevu Talepleri', 'randevu']
      ]
    },
    {
      label: 'Değerlendirme', Icon: Sparkle, items: [
        ['/hekim?tab=triyaj', Sparkle, 'Triyaj ve Sevk'],
        ['/hekim/rontgen-arşivi', Box, 'Röntgen Arşivi']
      ]
    },
    {
      label: 'Tedavi', Icon: Calendar, items: [
        ['/hekim?tab=sure', Clock, 'Tedavi Süreleri']
      ]
    },
    {
      label: 'İletişim', Icon: Chat, items: [
        ['/bildirimler', Bell, 'Bildirimler', 'bildirim'],
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
    ['/bildirimler', Bell, 'Bildirimler'],
    ['/hatirlatma', Clock, 'Hatırlatmalar'],
    ['/konsultasyon', Chat, 'Konsültasyon'],
    ['/hesap', Settings, 'Hesap Ayarları']
  ],
  hekim: [],
  sekreter: [
    ['/sekreter', Calendar, 'Sekreter Paneli'],
    ['/hatirlatma', Clock, 'Hatırlatmalar'],
    ['/hesap', Settings, 'Hesap Ayarları']
  ],
  teknisyen: [
    ['/sekreter', Stethoscope, 'Teknisyen Paneli'],
    ['/hesap', Settings, 'Hesap Ayarları']
  ],
  // Hasta paneli: veri toplayan form yoktur. Hekime ulaşmanın iki yolu
// randevu almak ve görüşme başlatmaktır; klinik veriler hekim doldurur.
  hasta: [
    ['/hastam', Clipboard, 'Dişlerim'],
    ['/randevu', Calendar, 'Randevu Al'],
    ['/video', Video, 'Hekimimle Görüş'],
    ['/bildirimler', Bell, 'Bildirimler'],
    ['/hesap', Settings, 'Hesap Ayarları']
  ]
}
MENUS.ebeveyn = MENUS.hasta

const ROLE_TR = { hekim: 'Hekim', hasta: 'Hasta', ebeveyn: 'Ebeveyn', admin: 'Süper Admin', sekreter: 'Sekreter', teknisyen: 'Diş Teknisyeni' }

/**
 * Yaklaşan randevu / kontrol hatırlatmaları.
 *
 * AYRI tutulmasının nedeni: bunlar olay bildirimi DEĞİL, tarihten
 * hesaplanan hatırlatmadır. Gerçek olay bildirimleri (kayıt talebi,
 * yeni görsel, sevk) BildirimZil tarafından gösterilir. İkisi tek
 * rozet altında toplanınca "kaç bildirimim var" sorusu cevaplanamıyordu.
 */
function HatirlatmaZili() {
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    let alive = true
    const load = () => listNotifications().then((r) => alive && setItems(r.items || []))
    load()
    const t = setInterval(load, 60000)
    return () => { alive = false; clearInterval(t) }
  }, [])
  if (items.length === 0) return null
  return (
    <div className="bell-wrap">
      <button className="bell" onClick={() => setOpen(!open)} aria-label="Yaklaşan randevu ve kontrol uyarıları">
        <Clock size={18} />
        <span className="bell-count">{items.length}</span>
      </button>
      {open && (
        <div className="bell-menu">
          <h4>Yaklaşanlar ({items.length})</h4>
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
  const isStaff = ['hekim', 'admin', 'sekreter', 'teknisyen'].includes(u?.role)

  // Canlı rozet sayıları (randevu talebi, kayıt isteği, okunmamış bildirim)
  const [counts, setCounts] = useState({ randevu: 0, istek: 0, bildirim: 0 })
  useEffect(() => {
    if (u?.role !== 'hekim') return
    let alive = true
    const load = () => Promise.all([listAppointments(), listRequests(), okunmamisSayisi()]).then(([ap, rq, bi]) => {
      if (!alive) return
      setCounts({
        randevu: (ap || []).filter((a) => a.status === 'yeni').length,
        istek: (rq || []).length,
        bildirim: bi || 0
      })
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
  // Aynı anda yalnızca BİR grup açık kalır; etkin sayfanın grubu asla kapalı değil
  const isOpen = (label) => (label === activeGroup ? true : open[label] === true)
  const toggle = (label) => {
    const next = { [label]: !isOpen(label) }
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
          {/* Gerçek olay bildirimleri + ayrı hatırlatma zili */}
          <BildirimZil />
          {isStaff && <HatirlatmaZili />}
        </header>
        {/* Bakımdayız açıklaması — veri yazma durur, görüntüleme sürer */}
        <BakimBanti />
        <main>{children}</main>
        <footer className="footer">
          <div>© Karadeniz Teknik Üniversitesi © Diş Hekimliği Öğrencisi Resul Yel - Hakları Saklıdır</div>
        </footer>
      </div>
    </div>
  )
}