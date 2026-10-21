import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { STATUS_TR } from '../data/teeth.js'
import { ToothChart, ToothVisual } from '../components/ToothChart.jsx'
import { toothEducation, recallForTooth } from '../ai/toothAi.js'
import { suggestRecall } from '../ai/recall.js'
import { load, save, keys, getSession } from '../services/store.js'
import { createUserByDoctor } from '../services/auth.js'
import {
  listPatients, getPatient, getTeeth, saveTooth, lastRecords, updatePatient,
  insertTriage, insertHygiene, insertAnxiety, listDoctors, listReferrals, referPatient,
  listAppointments, approveAppointment, completeAppointment, listRequests, decideRequest,
  repairAccount,
  loadImage, setAppointmentOnline, listPhotos, listTriage, setPhotoNote, signedPhotoUrl,
  plansApi, notesApi, getSetupStatus, anamnesisApi
} from '../services/db.js'
import { triageScore } from '../services/clinical.js'
import {
  Chart, Users, Calendar, Send, Clipboard, Camera, FileText, Plus, Check,
  CheckCircle, Clock, Stethoscope, User, Save, X, Alert, Tooth, Lock, Phone, Bell,
  ChevronLeft, ChevronRight, Video, Notebook, TrendingUp, Shield
} from '../components/Icons.jsx'
import { DisEditor } from '../components/Tooth3DEditor.jsx'
import { DisGelecekSimulatoru } from '../components/DisGelecek.jsx'
import { AnamnezForm } from '../components/AnamnezForm.jsx'
import { DosyaArsivi } from '../components/DosyaArsivi.jsx'
import { bildirimOlustur } from '../services/bildirim.js'
import { kabulMesaji } from '../services/onGorusme.js'
import {
  DailyFlow, TedaviSureleri, ClinicJournal, ClinicStats, DemoSeeder, DoctorSchedule
} from './DoctorModules.jsx'

function xrayKey(pid, tooth) { return `${pid}_${tooth}` }

// Sonraki kontrol tarihi (son muayeneden 3 ay sonra) ve kalan gün.
// Hatırlatma, kalan gün <= hastanın seçtiği hatırlatma günü olduğunda tetiklenir.
export function reminderInfo(p) {
  const days = Number(p.reminder_days ?? p.reminderDays ?? 5)
  const lv = p.last_visit || p.lastVisit
  if (!lv) return { left: days, days, date: null, missing: true }
  const v = new Date(lv)
  v.setMonth(v.getMonth() + 3)
  const left = Math.ceil((v - new Date()) / 86400000)
  return { left, days, date: v.toISOString().slice(0, 10), missing: false }
}

/**
 * Seçili dişin röntgeni — büyük önizleme.
 * Kalıcı arşiv, belge yükleme ve tüm dosyaların listesi
 * aşağıdaki DosyaArsivi bileşenindedir.
 */
function XrayOnizleme({ pid, tooth }) {
  const [img, setImg] = useState(null)
  useEffect(() => {
    let iptal = false
    // Yalnız bu dişin EN YENİ röntgeni gösterilir
    loadImage('xrays', pid, `tooth${tooth}`).then((u) => { if (!iptal) setImg(u) })
    return () => { iptal = true }
  }, [pid, tooth])

  return (
    <div className="rontgen-onizleme">
      {img
        ? <img src={img} alt={`${tooth} nolu diş röntgeni`} className="xray" />
        : <p className="muted">Bu dişe ait röntgen yok. Aşağıdan yükleyebilirsiniz.</p>}
    </div>
  )
}

const TABS = [
  { id: 'ozet', label: 'Genel Bakış', Icon: Chart, desc: 'Klinik performans özeti ve modüllere hızlı erişim.' },
  { id: 'gunluk', label: 'Günlük Akış', Icon: Clock, desc: 'Bugünün randevuları, saat sırasıyla.' },
  { id: 'hastalar', label: 'Hastalarım', Icon: Users, desc: 'Tüm hastalar; arama, sıralama ve hatırlatma takibi.' },
  { id: 'gunluk-not', label: 'Klinik Günlük', Icon: Notebook, desc: 'Tarihli klinik notları, rapor ve konsültasyon kayıtları.' },
  { id: 'randevu', label: 'Randevu Talepleri', Icon: Send, desc: 'Gelen talepleri onaylayın, çakışma kontrolü otomatiktir.' },
  { id: 'takvim', label: 'Takvim', Icon: Calendar, desc: 'Onaylı randevuların aylık görünümü.' },
  { id: 'triyaj', label: 'Triyaj ve Sevk', Icon: Clipboard, desc: 'Hasta triyaj kayıtları ve hekimler arası sevk.' },
  { id: 'foto', label: 'Hasta Fotoğrafları', Icon: Camera, desc: 'Hastanın gönderdiği fotoğrafları değerlendirin ve yorumlayın.' },
  { id: 'sure', label: 'Tedavi Süreleri', Icon: Clock, desc: 'İşlem süreleri, seans sayısı ve kontrol aralıkları.' },
  { id: 'istek', label: 'Kayıt İstekleri', Icon: FileText, desc: 'Hasta kayıt taleplerini onaylayın.' }
]

// Menüyü konulara göre gruplandır
const GROUPS = [
  { label: 'Genel', items: ['ozet', 'gunluk'] },
  { label: 'Klinik', items: ['hastalar', 'gunluk-not'] },
  { label: 'Planlama', items: ['randevu', 'takvim'] },
  { label: 'Değerlendirme', items: ['triyaj', 'foto'] },
  { label: 'Planlama', items: ['sure'] },
  { label: 'Kayıtlar', items: ['istek'] }
]

function Modal({ title, sub, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {sub && <p className="muted">{sub}</p>}
          </div>
          <button className="ghost" onClick={onClose} aria-label="Kapat"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function NewPatientForm({ onDone, onClose }) {
  const [form, setForm] = useState(emptyForm())
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [anamnezTamam, setAnamnezTamam] = useState(false)
  const [anamnezKayitId, setAnamnezKayitId] = useState(null)

  const save = async () => {
    setBusy(true); setMsg('')
    const extra = {
      tc_no: form.tc_no, gender: form.gender, phone: form.phone, address: form.address,
      city: form.city, district: form.district, blood: form.blood, insurance: form.insurance,
      school: form.school, occupation: form.occupation, near_name: form.near_name,
      near_phone: form.near_phone, near_relation: form.near_relation,
      reminder_days: Number(form.reminder_days)
    }
    Object.keys(extra).forEach((k) => { if (!extra[k]) delete extra[k] })
    if (form.birth_date) {
      extra.birth_date = form.birth_date
      extra.last_visit = new Date().toISOString().slice(0, 10)
    }
    const r = await createUserByDoctor({
      name: form.name, email: form.email, pass: form.pass, role: form.role,
      childEmail: form.childEmail, username: form.username, extra
    })
    setBusy(false)
    if (r.error) return setMsg(r.error)
    // Anamnez kaydını gerçek uid'e taşı (temp_email → uid)
    if (anamnezKayitId && r.uid) {
      await anamnesisApi.update(anamnezKayitId, { patient_id: r.uid })
    }
    setMsg(`${form.name} hesabı açıldı.`)
    onDone({ name: form.name, email: form.email, pass: form.pass, uid: r.uid })
  }

  return (
    <>
      <h4 className="modal-sub"><Lock size={15} /> Giriş Bilgileri</h4>
      <div className="grid form-grid">
        <label>Ad Soyad *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>E-posta (giriş için) *<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Geçici şifre *<input value={form.pass} onChange={(e) => setForm({ ...form, pass: e.target.value })} /></label>
        <label>Kullanıcı adı (giriş için)<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="örn: mehmet.yilmaz" /></label>
        <label>Rol
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="hasta">Hasta</option>
            <option value="ebeveyn">Ebeveyn</option>
          </select>
        </label>
        {form.role === 'ebeveyn' && (
          <label>Çocuğun e-postası<input value={form.childEmail} onChange={(e) => setForm({ ...form, childEmail: e.target.value })} /></label>
        )}
      </div>

      <h4 className="modal-sub"><User size={15} /> Kimlik Bilgileri</h4>
      <div className="grid form-grid">
        <label>TC Kimlik No<input value={form.tc_no} maxLength={11} onChange={(e) => setForm({ ...form, tc_no: e.target.value })} /></label>
        <label>Doğum Tarihi<input type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} /></label>
        <label>Cinsiyet
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="">Seç</option><option value="Kadın">Kadın</option><option value="Erkek">Erkek</option>
          </select>
        </label>
        <label>Kan Grubu
          <select value={form.blood} onChange={(e) => setForm({ ...form, blood: e.target.value })}>
            <option value="">Seç</option>{['A0','A Rh+','A Rh-','B0','B Rh+','B Rh-','AB0','AB Rh+','AB Rh-','O0','O Rh+','O Rh-'].map((b) => <option key={b}>{b}</option>)}
          </select>
        </label>
      </div>

      <h4 className="modal-sub"><Phone size={15} /> İletişim ve Adres</h4>
      <div className="grid form-grid">
        <label>Telefon<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label>Adres<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        <label>İl<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
        <label>İlçe<input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></label>
      </div>

      <h4 className="modal-sub"><Users size={15} /> Yakın ve Sosyal Bilgiler</h4>
      <div className="grid form-grid">
        <label>Yakın Adı<input value={form.near_name} onChange={(e) => setForm({ ...form, near_name: e.target.value })} /></label>
        <label>Yakın Telefonu<input value={form.near_phone} onChange={(e) => setForm({ ...form, near_phone: e.target.value })} /></label>
        <label>Yakınlık Derecesi<input value={form.near_relation} onChange={(e) => setForm({ ...form, near_relation: e.target.value })} /></label>
        <label>Okul<input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} /></label>
        <label>Meslek<input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} /></label>
        <label>Sağlık Sigortası<input value={form.insurance} onChange={(e) => setForm({ ...form, insurance: e.target.value })} /></label>
        <label>Hatırlatma (gün önce)
          <select value={form.reminder_days} onChange={(e) => setForm({ ...form, reminder_days: e.target.value })}>
            {[1, 2, 3, 5, 7, 10, 14].map((d) => <option key={d} value={d}>{d} gün</option>)}
          </select>
        </label>
      </div>

      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>Vazgeç</button>
        <button onClick={save} disabled={busy || !anamnezTamam}>
          {busy ? 'Kaydediliyor...' : anamnezTamam ? <><Check size={15} /> Hesabı Oluştur</> : <><Alert size={15} /> Önce anamnezi tamamlayın</>}
        </button>
      </div>

      {/* Anamnez formu — hesap oluşturma butonu aktif olmadan önce doldurulmalı */}
      {!anamnezTamam && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <h4 className="modal-sub"><Alert size={15} /> Anamnez (Sağlık Geçmişi)</h4>
          <p className="muted">Hastanın sistemik hastalıkları, alerjileri, kullandığı ilaçlar ve gebelik durumu.</p>
          <AnamnezForm
            pid={`temp_${form.email}`}
            mesajGoster={setMsg}
            onTamam={(satir) => { setAnamnezTamam(true); if (satir?.id) setAnamnezKayitId(satir.id) }}
          />
        </div>
      )}
    </>
  )
}

const BRANCHES = ['genel', 'restoratif', 'endodonti', 'periodontoloji', 'pedodonti', 'ortodonti', 'protez', 'ağız-cerrahi']
const BRANCH_TR = { genel: 'Genel Diş', restoratif: 'Restoratif', endodonti: 'Endodonti', periodontoloji: 'Periodontoloji', pedodonti: 'Pedodonti', ortodonti: 'Ortodonti', protez: 'Protez', 'ağız-cerrahi': 'Ağız ve Çene Cerrahisi' }

const emptyForm = () => ({
  name: '', email: '', pass: '', role: 'hasta', tc_no: '', birth_date: '', gender: '',
  phone: '', address: '', city: '', district: '', blood: '', insurance: '', school: '',
  occupation: '', near_name: '', near_phone: '', near_relation: '', childEmail: '',
  reminder_days: 5, branch: 'genel', username: ''
})

export function DoctorList() {
  const [loc, setLoc] = useSearchParams()
  // Sidebar'dan tıklandığında URL değişir; panel de buna göre sekmeyi değiştirmeli
  const urlTab = loc.get('tab') || 'ozet'
  const [tab, setTabState] = useState(urlTab)
  const setTab = (t) => {
    setTabState(t)
    const next = new URLSearchParams(loc)
    next.set('tab', t)
    setLoc(next, { replace: true })
  }
  useEffect(() => { setTabState(urlTab) }, [urlTab])
  const [q, setQ] = useState('')
  const [all, setAll] = useState([])
  const [doctors, setDoctors] = useState([])
  const [refs, setRefs] = useState([])
  const [requests, setRequests] = useState([])
  const [appts, setAppts] = useState([])
  const [refTo, setRefTo] = useState({})
  const [msg, setMsg] = useState('')
  const [istekHata, setIstekHata] = useState(false)
  const [refMsg, setRefMsg] = useState('')
  const [form, setForm] = useState(emptyForm())
  const [approveDate, setApproveDate] = useState({})
  const [showNew, setShowNew] = useState(false)
  // Onay sonrası verilen giriş bilgileri — hekim hastaya iletir
  const [verilen, setVerilen] = useState(null)
  // "Giriş yapamıyor" aracı
  const [onarim, setOnarim] = useState({ email: '', sifre: '' })
  const [onarimSonuc, setOnarimSonuc] = useState(null)
  const [triage, setTriage] = useState([])
  const [photos, setPhotos] = useState([])
  const [photoDraft, setPhotoDraft] = useState({})
  const [sortBy, setSortBy] = useState('ad')
  const [clinic, setClinic] = useState({ plans: [], notes: [] })
  const [setup, setSetup] = useState(null)
  const me = getSession()

  useEffect(() => { getSetupStatus().then(setSetup) }, [])

  const loadClinic = async () => {
    const [plans, notes] = await Promise.all([
      plansApi.list(), notesApi.list()
    ])
    setClinic({ plans, notes })
  }

  const reload = () => {
    listPatients().then(setAll)
    listDoctors().then(setDoctors)
    listReferrals().then(setRefs)
    listRequests().then(setRequests)
    listAppointments().then(setAppts)
    listTriage().then(setTriage)
    loadPhotos()
    loadClinic()
  }
  useEffect(() => { reload() }, [])

  // Fotoğraflar sunucudan; her biri için geçici imzalı bağlantı üretilir
  const loadPhotos = async () => {
    const rows = await listPhotos()
    const withUrls = await Promise.all(rows.map(async (r) => ({
      ...r,
      url: r.path ? await signedPhotoUrl(r.path) : r.img || null
    })))
    setPhotos(withUrls)
  }
  useEffect(() => { loadPhotos() }, [])

  // Ham UUID yerine okunabilir ad göster
  const pname = (pid) => {
    const u = all.find((x) => x.id === pid) || doctors.find((x) => x.id === pid)
    return u?.name || '—'
  }
  const pxray = (pid) => {
    const u = all.find((x) => x.id === pid)
    return u ? `${u.name} · ${u.phone || 'telefon yok'} · TC ${u.tc_no || '—'}` : 'Bilinmeyen hasta'
  }

  const ql = q.toLowerCase()
  const patients = all.filter((u) => {
    if (u.role !== 'hasta' && u.role !== 'ebeveyn') return false
    if (!ql) return true
    return (u.name || '').toLowerCase().includes(ql)
      || (u.tc_no || '').includes(ql)
      || (u.phone || '').includes(ql)
      || (u.email || '').toLowerCase().includes(ql)
  })
  const triageSorted = triage.slice().sort((a, b) => (b.score || 0) - (a.score || 0))
  const pending = appts.filter((a) => a.status === 'yeni')
  const approved = appts.filter((a) => a.status === 'onaylı' && a.appt_date)

  // Hasta listesi sıralaması
  const patientsSorted = patients.slice().sort((a, b) => {
    if (sortBy === 'tarih') return String(b.last_visit || '').localeCompare(String(a.last_visit || ''))
    if (sortBy === 'randevu') return String(a.reminder_days ?? 99) - String(b.reminder_days ?? 99)
    return (a.name || '').localeCompare(b.name || '', 'tr')
  })

  // Aynı hekime aynı güne ikinci randevu verilmesini engelle
  const hasConflict = (dateStr, selfId) =>
    appts.some((x) => x.id !== selfId && x.appt_date === dateStr
      && (x.status === 'onaylı' || x.status === 'yeni'))

  const saveNewPatient = async () => {
    setMsg('')
    const extra = {
      tc_no: form.tc_no, gender: form.gender, phone: form.phone, address: form.address,
      city: form.city, district: form.district, blood: form.blood, insurance: form.insurance,
      school: form.school, occupation: form.occupation, near_name: form.near_name,
      near_phone: form.near_phone, near_relation: form.near_relation,
      reminder_days: Number(form.reminder_days),
      ...(form.birth_date ? { birth_date: form.birth_date, last_visit: form.birth_date && new Date().toISOString().slice(0, 10) } : {})
    }
    Object.keys(extra).forEach((k) => { if (!extra[k]) delete extra[k] })
    const r = await createUserByDoctor({
      name: form.name, email: form.email, pass: form.pass, role: form.role,
      childEmail: form.childEmail, username: form.username, extra
    })
    if (r.error) return setMsg(r.error)
    setMsg(`${form.name} hesabı açıldı. Giriş: ${form.email} / ${form.pass}`)
    setForm(emptyForm())
    reload()
  }

  const savePhotoNote = (photoId) => {
    const cur = load(keys.photoNotes, {})
    cur[photoId] = cur[photoId] || ''
    save(keys.photoNotes, cur)
  }

  const activeTab = TABS.find((t) => t.id === tab) || TABS[0]

  return (
    <div>
      <div className="panel-hero">
        <div>
          <h1><activeTab.Icon size={22} /> {activeTab.label}</h1>
          <p className="muted">{activeTab.desc}</p>
        </div>
        <span className="spacer" />
        <button className="btn-new" onClick={() => setShowNew(true)}><Plus size={16} /> Yeni Hasta Ekle</button>
      </div>

      <div className="kpi-row">
        <button className="kpi kpi-btn" onClick={() => setTab('hastalar')}><b>{patients.length}</b><span>Kayıtlı Hasta</span></button>
        <button className="kpi kpi-btn" onClick={() => setTab('randevu')}><b className={pending.length ? 'alert-num' : ''}>{pending.length}</b><span>Bekleyen Randevu Talebi</span></button>
        <button className="kpi kpi-btn" onClick={() => setTab('takvim')}><b>{approved.length}</b><span>Onaylı Randevu</span></button>
        <button className="kpi kpi-btn" onClick={() => setTab('triyaj')}><b>{triage.length}</b><span>Triyaj Kaydı</span></button>
        <button className="kpi kpi-btn" onClick={() => setTab('istek')}><b className={requests.length ? 'alert-num' : ''}>{requests.length}</b><span>Kayıt İsteği</span></button>
      </div>

      {/* ---------------- GENEL BAKIŞ ---------------- */}
      {tab === 'ozet' && (
        <div>
          {setup?.data && !setup.data.ok && (
            <div className="card warn-card">
              <h3><Alert size={18} /> Veritabanı kurulumu eksik</h3>
              <p className="muted">
                Klinik modülleri veritabanı tablolarını kullanır. SQL henüz çalıştırılmadığı için
                modüller tarayıcınızda çalışır ama cihazlar arasında paylaşılmaz.
              </p>
              <p className="muted">
                Eksikler: {[...(setup.data.missing_tables || []), ...(setup.data.missing_functions || [])].join(', ') || '—'}
              </p>
              <p className="muted">Proje klasöründe terminal açıp <code>npm run db:push</code> yazın.</p>
            </div>
          )}
          <ClinicStats
            patients={patients}
            appts={appts}
            plans={clinic.plans}
            photos={photos}
          />
          <DemoSeeder onDone={loadClinic} />
          <div className="card">
            <h3><Bell size={18} /> Yaklaşan Hatırlatmalar</h3>
            <ReminderList patients={all} />
          </div>
        </div>
      )}

      {/* ---------------- GÜNLÜK AKIŞ ---------------- */}
      {tab === 'gunluk' && (
        <DailyFlow
          appts={appts}
          patients={all}
          onComplete={async (id) => { const r = await completeAppointment(id); setMsg(r.error || 'Randevu tamamlandı.'); reload() }}
        />
      )}

      {/* ---------------- TEDAVİ SÜRELERİ (ücret yok) ---------------- */}
      {tab === 'sure' && <TedaviSureleri patients={all} plans={clinic.plans} />}

      {/* ---------------- KLINIK GÜNLÜK ---------------- */}
      {tab === 'gunluk-not' && <ClinicJournal patients={all} />}

      {/* ---------------- HASTALAR ---------------- */}
      {tab === 'hastalar' && (
        <div>
          <div className="card toolbar">
            <input placeholder="Ad, TC veya telefon ile ara..." value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} />
            <span className="badge">{patients.length} hasta</span>
            <span className="spacer" />
            <label className="inline-label">Sırala:
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="ad">Ada göre</option>
                <option value="tarih">Son muayeneye göre</option>
                <option value="randevu">Hatırlatma gününe göre</option>
              </select>
            </label>
            <button onClick={() => setShowNew(true)}><Plus size={16} /> Yeni Hasta Ekle</button>
          </div>
          {patients.length === 0 && <div className="card"><p className="muted">Kayıtlı hasta yok. "Yeni Hasta Ekle" ile başlayın.</p></div>}
          {patientsSorted.map((p) => {
            const info = reminderInfo(p)
            return (
              <div className="card patient-row" key={p.id}>
                <div>
                  <strong>{p.name}</strong> <span className="muted">({p.email})</span>
                  <p className="muted">
                    {p.tc_no ? `TC: ${p.tc_no} · ` : ''}{p.gender || ''} {p.birth_date ? `· ${p.birth_date}` : ''}{p.phone ? ` · ${p.phone}` : ''}
                  </p>
                  <p className="muted">
                    <Clock size={13} /> Son muayene: {p.last_visit || '—'} ·{' '}
                    {info.left < 0
                      ? <span className="due-now">{Math.abs(info.left)} gün gecikti</span>
                      : info.left === 0
                        ? <span className="due-now"><Alert size={13} /> Kontrol bugün</span>
                        : <span><Bell size={13} /> {info.left} gün sonra hatırlatma</span>}
                  </p>
                </div>
                <div className="toolbar">
                  <Link to={`/hekim/hasta/${p.id}`}><button>Hastayı Aç</button></Link>
                  <Link to={`/rapor/${p.id}`}><button className="ghost"><FileText size={15} /> Rapor</button></Link>
                  <Link to={`/hekim/hasta/${p.id}#randevu`}>
                    <button className="ghost"><Calendar size={15} /> Randevu Ver</button>
                  </Link>
                  <Link to="/video"><button className="ghost"><Video size={15} /> Online Görüşme</button></Link>
                </div>
              </div>
            )
          })}
        </div>
      )}


      {showNew && (
        <Modal title="Yeni Hasta Kaydı" sub="Hesap otomatik açılır, UID gerekmez." onClose={() => setShowNew(false)}>
          <NewPatientForm onClose={() => setShowNew(false)} onDone={() => { reload() }} />
        </Modal>
      )}

      {/* ---------------- TAKVİM ---------------- */}
      {tab === 'takvim' && (
        <div>
          <div className="card">
            <h3><Calendar size={18} /> Randevu Takvimi</h3>
            <CalendarView appts={approved} onComplete={async (id) => { const r = await completeAppointment(id); setMsg(r.error || 'Randevu tamamlandı.'); reload() }} />
          </div>
          <DoctorSchedule />
        </div>
      )}

      {/* ---------------- RANDEVU TALEPLERİ ---------------- */}
      {tab === 'randevu' && (
        <div className="card">
          <h3><Send size={18} /> Gelen Randevu Talepleri ({pending.length})</h3>
          {pending.length === 0 && <p className="muted">Bekleyen talep yok.</p>}
          {pending.map((a) => (
            <div key={a.id} className="appt-row">
              <div>
                <strong>{a.name}</strong> <span className="muted">({a.contact})</span>
                <p className="muted"><Tooth size={13} /> {a.complaint}</p>
                <span className="badge">{BRANCH_TR[a.dept] || a.dept}</span>
                {a.is_online && <span className="badge online">Online</span>}
              </div>
              <div className="toolbar">
                <input type="date" value={approveDate[a.id] || ''} onChange={(e) => setApproveDate((s) => ({ ...s, [a.id]: e.target.value }))} />
                <button className="ghost" title="Online görüşme" onClick={async () => { await setAppointmentOnline(a.id, !a.is_online); reload() }}>
                  <Video size={15} /> {a.is_online ? 'Online ✓' : 'Online yap'}
                </button>
                <button onClick={async () => {
                  const d = approveDate[a.id]
                  if (!d) return setMsg('Önce randevu tarihi seçin.')
                  if (hasConflict(d, a.id)) return setMsg(`${d} tarihine zaten bir randevu var. Farklı bir gün seçin.`)
                  const r = await approveAppointment(a.id, me?.id, d)
                  setMsg(r.error || 'Randevu onaylandı ve takvime eklendi.')
                  reload()
                }}><Check size={15} /> Onayla</button>
              </div>
            </div>
          ))}
          {msg && <p className="muted">{msg}</p>}
        </div>
      )}

      {/* ---------------- TRİYAJ & SEVK ---------------- */}
      {tab === 'triyaj' && (
        <div>
          <div className="card">
            <h3><Stethoscope size={18} /> Triyaj Kuyruğu ({triageSorted.length})</h3>
            {triageSorted.length === 0 && <p className="muted">Triyaj kaydı yok.</p>}
            {triageSorted.map((t) => (
              <div key={t.id} className="appt-row">
                <div>
                  <span className="badge">{t.score} - {t.level}</span>
                  <p><strong>{pname(t.patient_id || t.patientId)}</strong> · diş {t.tooth} · ağrı {t.pain} <span className="muted">[{String(t.created_at || t.date || '').slice(0, 10)}]</span></p>
                </div>
                <div className="toolbar">
                  <select value={refTo[t.id] || ''} onChange={(e) => setRefTo((s) => ({ ...s, [t.id]: e.target.value }))}>
                    <option value="">Sevk edilecek hekim...</option>
                    {doctors.filter((d) => d.id !== me?.id).map((d) => <option key={d.id} value={d.id}>Dt. {d.name} {d.branch ? `(${BRANCH_TR[d.branch] || d.branch})` : ''}</option>)}
                  </select>
                  <button className="ghost" onClick={async () => {
                    const doc = doctors.find((d) => d.id === (refTo[t.id] || ''))
                    if (!doc) return setRefMsg('Önce sevk edilecek hekimi seçin.')
                    const r = await referPatient({ patientId: t.patient_id || t.patientId, toDoctor: doc.id, branch: doc.branch || 'genel', note: `${t.tooth} nolu diş, ağrı ${t.pain}`, fromDoctor: me?.id })
                    setRefMsg(r.error || `${pname(t.patient_id || t.patientId)} → Dt. ${doc.name} hekimine sevk edildi.`)
                    reload()
                  }}>Sevk Et</button>
                </div>
              </div>
            ))}
            {refMsg && <p className="muted">{refMsg}</p>}
          </div>
          <div className="card">
            <h3><Send size={18} /> Sevk Kayıtları ({refs.length})</h3>
            {refs.length === 0 && <p className="muted">Sevk kaydı yok.</p>}
            {refs.map((r) => (
              <p key={r.id}>
                <strong>{pname(r.patient_id)}</strong> → Dt. {doctors.find((d) => d.id === r.to_doctor)?.name || '—'}{' '}
                <span className="muted">({BRANCH_TR[r.branch] || r.branch} · {r.status})</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- FOTOĞRAFLAR ---------------- */}
      {tab === 'foto' && (
        <div className="card">
          <h3><Camera size={18} /> Fotoğrafla Ön Değerlendirme ({photos.length})</h3>
          {photos.length === 0 && <p className="muted">Hasta fotoğrafı yok.</p>}
          {photos.map((p) => (
            <div key={p.id} className="photo-row">
              {p.url ? <img src={p.url} alt="ağız" className="xray" /> : <p className="muted">Görüntü yüklenemedi.</p>}
              <div>
                <p className="muted">
                  <strong>{pname(p.patient_id || p.patientId)}</strong> · {String(p.created_at || p.date || '').slice(0, 16)} ·{' '}
                  <span className="badge">{p.status === 'degerlendirildi' ? 'Değerlendirildi' : 'Bekliyor'}</span>
                </p>
                <textarea
                  rows="2"
                  placeholder="Hekim yorumunuz..."
                  value={photoDraft[p.id] ?? p.note ?? ''}
                  onChange={(e) => setPhotoDraft((s) => ({ ...s, [p.id]: e.target.value }))}
                />
                <div className="toolbar">
                  <button onClick={async () => {
                    const r = await setPhotoNote(p.id, photoDraft[p.id] ?? p.note ?? '')
                    setMsg(r.error || 'Yorum kaydedildi ve hasta bilgilendirildi.')
                    reload()
                  }}><Check size={15} /> Yorumu Kaydet</button>
                  {p.patient_id ? (
                    <Link to={`/hekim/hasta/${p.patient_id}`}>
                      <button className="ghost">Hastayı Aç</button>
                    </Link>
                  ) : (
                    <span className="muted">Hasta bağlantısı yok</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {msg && <p className="muted">{msg}</p>}
        </div>
      )}

      {/* ---------------- KAYIT İSTEKLERİ ---------------- */}
      {tab === 'istek' && (
        <div className="card">
          <h3><Clipboard size={18} /> Gelen Kayıt İstekleri ({requests.length})</h3>
          <p className="muted">
            Hastaların <Link to="/kayit">kayıt isteği</Link> formundan gönderdiği başvurular burada listelenir.
            Onayladığınızda hesap açılır ve hasta kendi paneline girebilir.
          </p>

          {requests.length === 0 && (
            <div className="empty-state">
              <p className="muted">Şu anda bekleyen kayıt isteği yok.</p>
              <p className="muted">
                Hasta kaydı yalnızca talep üzerinden yapılır. Hastanın formu doldurması gerekir;
                adres: <b>/kayit</b>. Bu sayfayı yeni bir sekmede test edebilirsiniz.
              </p>
              <div className="kurulum-notu">
                <Alert size={15} />
                <p>
                  <b>Talep gelmiyorsa:</b> Supabase projenizde
                  <b> Authentication → Sign In / Providers → Email → "Allow new users to sign up"</b>
                  anahtarı kapalıdır. Hasta kaydı hiçbir yere yazılamaz.
                  <br />
                  Çözüm: anahtarı açın <b>veya</b> proje kökünde <code>npm run db:push</code> çalıştırın.
                </p>
              </div>
            </div>
          )}

          {/* Kurulum uyarısı: talep geliyor ama onaylanamıyorsa sebebi budur */}
          {istekHata && (
            <p className="auth-err"><Alert size={15} /> {msg}</p>
          )}

          {requests.map((r) => (
            <div className="istek-row" key={r.id}>
              <div className="istek-bilgi">
                <p>
                  <strong>{r.name}</strong>
                  <span className="badge">{r.role === 'ebeveyn' ? 'Ebeveyn' : 'Hasta'}</span>
                  {String(r.id).startsWith('y') && <span className="badge warn">tarayıcı kaydı</span>}
                </p>
                <p className="muted">
                  {r.email}
                  {r.username ? ` · kullanıcı adı: ${r.username}` : ''}
                  {r.phone ? ` · ${r.phone}` : ''}
                  {r.created_at ? ` · ${String(r.created_at).slice(0, 10)}` : ''}
                </p>
                {r.child_email && <p className="muted">Çocuk: {r.child_email}</p>}
                {r.note && <p className="muted">Not: {r.note}</p>}
                {r.kvkk_onay
                  ? (
                    <p className="kvkk-kanit">
                      <Shield size={12} /> KVKK rızası alındı · metin v{r.kvkk_surum || '1.0'}
                      {r.kvkk_zaman ? ` · ${String(r.kvkk_zaman).slice(0, 16).replace('T', ' ')}` : ''}
                    </p>
                  )
                  : <p className="muted">KVKK onayı kaydı bulunmuyor — talebi onaylamadan önce doğrulayın.</p>}
              </div>
              <div className="istek-eylem">
                <button onClick={async () => {
                  const res = await decideRequest(r, true, me?.id)
                  setIstekHata(!!res.error)
                  if (res.error) { setMsg(res.error); return }
                  // Hesap yeni oluşturulduysa giriş bilgisini hekime göster
                  if (res.geciciSifre) {
                    setVerilen({ name: r.name, email: res.email || r.email, username: res.username, sifre: res.geciciSifre })
                    setMsg(`${r.name} onaylandı. Aşağıdaki giriş bilgisini hastaya iletin.`)
                  } else {
                    setVerilen(null)
                    setMsg(`${r.name} onaylandı — hesabı açıldı. Hasta kendi şifresiyle girebilir.`)
                  }
                  // KABUL BİLDİRİMİ: hasta paneline girince ön değerlendirme
                  // formunu dolduracak. Hekimin adı mesajda yer alır.
                  bildirimOlustur({
                    tur: 'kabul',
                    title: `Başvurunuz onaylandı — ${me?.name || 'hekim'}`,
                    body: kabulMesaji(me?.name),
                    hekimId: me?.id || null,
                    hastaId: res.uid || null,
                    link: '/hastam'
                  })
                  reload()
                }}><Check size={15} /> Onayla</button>
                <button
                  className="ghost"
                  onClick={async () => {
                    const res = await decideRequest(r, false)
                    setIstekHata(!!res.error)
                    setMsg(res.error || `${r.name} talebi reddedildi.`)
                    reload()
                  }}
                ><X size={15} /> Reddet</button>
              </div>
            </div>
          ))}
          {msg && !istekHata && <p className="msg ok">{msg}</p>}

          {/* Onayda üretilen giriş bilgisi — hekim bunu hastaya iletir */}
          {verilen && (
            <div className="card edit-panel">
              <h4><Lock size={15} /> {verilen.name} — giriş bilgileri</h4>
              <p className="muted">
                Hesap yeni açıldığı için geçici şifre üretildi. Bu bilgileri hastaya iletin;
                hasta giriş yaptıktan sonra şifresini değiştirebilir.
              </p>
              <div className="grid form-grid">
                <label>Kullanıcı adı<input readOnly value={verilen.username || ''} /></label>
                <label>E-posta<input readOnly value={verilen.email || ''} /></label>
                <label>Geçici şifre<input readOnly value={verilen.sifre || ''} /></label>
              </div>
              <div className="toolbar">
                <button
                  className="ghost"
                  onClick={() => setVerilen(null)}
                >Kapat</button>
                <button
                  className="ghost"
                  onClick={() => {
                    const metin = `${verilen.name} için TeleDentist giriş bilgileriniz:\n` +
                      `Kullanıcı adı: ${verilen.username}\nE-posta: ${verilen.email}\n` +
                      `Geçici şifre: ${verilen.sifre}\nGiriş sonrası şifrenizi değiştirin.`
                    navigator.clipboard?.writeText(metin)
                  }}
                >Bilgileri Kopyala</button>
              </div>
            </div>
          )}

          {/* Giriş yapamayan hastalar için onarım aracı */}
          <div className="card edit-panel">
            <h4><User size={15} /> "Hesabı bulunamadı" sorunu mu var?</h4>
            <p className="muted">
              Hasta "Bu kullanıcı adı bulunamadı" veya şifre hatası alıyorsa e-postasını
              yazın; hesabı tek tuşla onarıp yeni giriş bilgisi üretin.
            </p>
            <div className="grid form-grid">
              <label>Hasta e-postası *
                <input
                  value={onarim.email}
                  onChange={(e) => setOnarim({ ...onarim, email: e.target.value })}
                  placeholder="hastakayit1@ornek.com"
                />
              </label>
              <label>Yeni şifre (boşsa otomatik üretilir)
                <input
                  value={onarim.sifre}
                  onChange={(e) => setOnarim({ ...onarim, sifre: e.target.value })}
                  placeholder="en az 6 karakter"
                />
              </label>
            </div>
            <button onClick={async () => {
              setOnarimSonuc(null)
              const res = await repairAccount(onarim.email, onarim.sifre, me?.id)
              if (res.error) { setOnarimSonuc({ hata: res.error }); return }
              setOnarimSonuc({
                ad: res.username, email: onarim.email, sifre: res.sifre, not: res.not
              })
              setOnarim({ email: '', sifre: '' })
              reload()
            }}><CheckCircle size={15} /> Hesabı Onar</button>
            {onarimSonuc?.hata && <p className="auth-err"><Alert size={15} /> {onarimSonuc.hata}</p>}
            {onarimSonuc && !onarimSonuc.hata && (
              <div className="msg ok">
                <p><b>{onarimSonuc.ad}</b> için giriş bilgileri hazır:</p>
                <p>Kullanıcı adı: <b>{onarimSonuc.ad}</b></p>
                <p>E-posta: <b>{onarimSonuc.email}</b></p>
                <p>Şifre: <b>{onarimSonuc.sifre}</b></p>
                <p className="muted">{onarimSonuc.not}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ReminderList({ patients }) {
  const items = useMemo(() => {
    const out = []
    patients.forEach((p) => {
      const { left, days, missing } = reminderInfo(p)
      if (missing) return
      if (left >= 0 && left <= days) out.push({ id: p.id, name: p.name, left, days, phone: p.phone, near: p.near_name, nearPhone: p.near_phone })
    })
    return out.sort((a, b) => a.left - b.left)
  }, [patients])
  if (items.length === 0) return <p className="muted">Şu an hatırlatma gerektiren hasta yok.</p>
  return items.map((i) => (
    <div key={i.id} className="reminder-row">
      <b className={i.left === 0 ? 'due-now' : ''}>{i.left === 0 ? <><Alert size={14} /> BUGÜN</> : <><Clock size={14} /> {i.left} gün kaldı</>}</b>
      <span>{i.name} · {i.days} gün önceden bildirim</span>
      <span className="muted">{i.phone || i.near || 'iletişim yok'}</span>
      <Link to={`/hekim/hasta/${i.id}`}><button className="ghost">Aç</button></Link>
    </div>
  ))
}

// Basit ay takvimi
function CalendarView({ appts, onComplete }) {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const byDate = useMemo(() => {
    const m = {}
    appts.forEach((a) => { const k = (a.appt_date || '').slice(0, 10); if (k) (m[k] = m[k] || []).push(a) })
    return m
  }, [appts])
  const days = []
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = (first.getDay() + 6) % 7
  const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  for (let i = 0; i < start; i++) days.push(null)
  for (let d = 1; d <= total; d++) days.push(d)
  const today = new Date().toISOString().slice(0, 10)
  return (
    <div className="card">
      <div className="cal-head">
        <button className="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Önceki ay"><ChevronLeft size={16} /></button>
        <h3>{month.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</h3>
        <button className="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Sonraki ay"><ChevronRight size={16} /></button>
      </div>
      <div className="cal-grid">
        {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => <div key={d} className="cal-head-cell">{d}</div>)}
        {days.map((d, i) => {
          if (!d) return <div key={i} className="cal-cell empty" />
          const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
          const list = byDate[key] || []
          return (
            <div key={i} className={`cal-cell ${key === today ? 'today' : ''}`}>
              <b>{d}</b>
              {list.map((a) => (
                <div key={a.id} className="cal-event">
                  <span>{a.appt_time || '09:00'} {a.name}</span>
                  <button className="ghost tiny" onClick={() => onComplete(a.id)}><Check size={12} /> Bitti</button>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------- Hekim: hasta detayı ----------------
export function DoctorPatient() {
  const { id } = useParams()
  const [patient, setPatient] = useState(null)
  const [teeth, setTeeth] = useState({})
  const [rec, setRec] = useState({ triage: '-', hygiene: '-', anxiety: '-' })
  const [selected, setSelected] = useState(16)
  const [note, setNote] = useState('')
  const [status, setStatus] = useState('saglam')
  const [treatment, setTreatment] = useState('')
  const [mPain, setMPain] = useState(0)
  const [mPlaque, setMPlaque] = useState(1)
  const [mAnx, setMAnx] = useState(5)
  const [mMsg, setMMsg] = useState('')
  const [doctors, setDoctors] = useState([])
  const [refDoc, setRefDoc] = useState('')
  const [info, setInfo] = useState({})
  const [onamMetni, setOnamMetni] = useState('')
  const [onamNotu, setOnamNotu] = useState('')
  const [onamKaydedildi, setOnamKaydedildi] = useState(false)

  useEffect(() => {
    getPatient(id).then((p) => { setPatient(p || null); setInfo(p || {}) })
    getTeeth(id).then(setTeeth)
    lastRecords(id).then(setRec)
    listDoctors().then(setDoctors)
  }, [id])

  useEffect(() => {
    const r = localStorage.getItem(`onam_raporu_${id}`)
    if (r) {
      try {
        const j = JSON.parse(r)
        setOnamMetni(j.metni || '')
        setOnamNotu(j.notu || '')
        setOnamKaydedildi(true)
      } catch {}
    }
  }, [id])

  const sel = teeth[selected] || { status: 'saglam', treatment: '-', date: '-', doctorNote: 'Kayıt yok.' }
  useEffect(() => { setStatus(sel.status); setTreatment(sel.treatment === '-' ? '' : sel.treatment) }, [selected, sel.status, sel.treatment])

  if (!patient) return <p>Yükleniyor...</p>

  const saveInfo = async () => {
    const patch = { ...info, reminder_days: Number(info.reminder_days ?? 5) }
    Object.keys(patch).forEach((k) => { if (patch[k] === '' || patch[k] === undefined) delete patch[k] })
    const r = await updatePatient(id, patch)
    setMMsg(r.error || 'Hasta bilgileri güncellendi.')
    getPatient(id).then(setPatient)
  }

  const saveNote = async () => {
    await saveTooth(id, selected, { status, treatment: treatment || '-', doctorNote: note || sel.doctorNote })
    getTeeth(id).then(setTeeth)
    setNote('')
    setMMsg(`${selected} nolu diş kaydedildi.`)
  }

  const saveMeasure = async () => {
    const ts = triageScore({ pain: Number(mPain), swelling: false, trauma: false, bleeding: false, fever: false })
    await insertTriage(id, { tooth: String(selected), pain: Number(mPain), score: ts.score, level: ts.level })
    await insertHygiene(id, { plaque: Number(mPlaque), brush: 2, date: new Date().toISOString().slice(0, 10) })
    await insertAnxiety(id, Number(mAnx))
    setMMsg('Ölçümler kaydedildi.')
    lastRecords(id).then(setRec)
  }

  const recall = suggestRecall({ lastVisit: patient.last_visit || patient.lastVisit || new Date().toISOString().slice(0, 10) })

  return (
    <div>
      <Link to="/hekim"><ChevronLeft size={14} /> Hastalar</Link>
      <h1><Tooth size={24} /> {patient.name}</h1>
      <p className="muted">
        {patient.tc_no ? `TC: ${patient.tc_no} · ` : ''}{patient.gender || ''} {patient.birth_date || ''} · {patient.phone || 'telefon yok'}
      </p>

      <div className="card">
        <h3><Clipboard size={18} /> Hasta Bilgileri</h3>
        <div className="grid form-grid">
          <label>Ad Soyad<input value={info.name || ''} onChange={(e) => setInfo({ ...info, name: e.target.value })} /></label>
          <label>TC<input value={info.tc_no || ''} onChange={(e) => setInfo({ ...info, tc_no: e.target.value })} /></label>
          <label>Doğum Tarihi<input type="date" value={info.birth_date || ''} onChange={(e) => setInfo({ ...info, birth_date: e.target.value })} /></label>
          <label>Telefon<input value={info.phone || ''} onChange={(e) => setInfo({ ...info, phone: e.target.value })} /></label>
          <label>Kan Grubu<input value={info.blood || ''} onChange={(e) => setInfo({ ...info, blood: e.target.value })} /></label>
          <label>Son Muayene<input type="date" value={info.last_visit || ''} onChange={(e) => setInfo({ ...info, last_visit: e.target.value })} /></label>
          <label>Adres<input value={info.address || ''} onChange={(e) => setInfo({ ...info, address: e.target.value })} /></label>
          <label>Şehir / İlçe<input value={info.city || ''} onChange={(e) => setInfo({ ...info, city: e.target.value })} /></label>
          <label>Yakın<input value={info.near_name || ''} onChange={(e) => setInfo({ ...info, near_name: e.target.value })} /></label>
          <label>Yakın Telefon<input value={info.near_phone || ''} onChange={(e) => setInfo({ ...info, near_phone: e.target.value })} /></label>
          <label>Hatırlatma (gün önce)
            <select value={info.reminder_days ?? 5} onChange={(e) => setInfo({ ...info, reminder_days: e.target.value })}>
              {[1, 2, 3, 5, 7, 10, 14].map((d) => <option key={d} value={d}>{d} gün</option>)}
            </select>
          </label>
        </div>
        <button onClick={saveInfo}><Save size={15} /> Bilgileri Kaydet</button>
        {mMsg && <p className="muted">{mMsg}</p>}
      </div>

      {/* ---------- Anamnez: hekim doldurur, hasta doldurmaz ---------- */}
      <div className="card">
        <h3><Clipboard size={18} /> Anamnez — Geçmiş Hastalık Öyküsü</h3>
        <p className="muted">
          Hastanın geçmiş hastalıkları, alerjileri ve kullandığı ilaçlar muayene sırasında
          hasta ile konuşularak buraya kaydedilir. Kritik işaretlenen durumlar tedavi
          planında dikkat gerektirir ve hastanın kendi paneline uyarı olarak düşer.
        </p>
        <AnamnezForm pid={id} mesajGoster={setMMsg} />
      </div>

      <div className="card">
        <h3><Tooth size={18} /> 3B Diş Haritası (FDI)</h3>
        <p className="muted">
          Modeli döndürün, dişin üzerine gelerek durumunu görün, tıklayarak seçin
          ve aşağıdaki editörden bilgi girin.
        </p>
        <ToothChart
          teeth={teeth}
          selected={selected}
          onSelect={setSelected}
        />
        <DisEditor
          pid={id}
          teeth={teeth}
          selected={selected}
          onSelect={setSelected}
          onKaydedildi={() => getTeeth(id).then(setTeeth)}
          mesajGoster={setMMsg}
        />
      </div>

      <div className="card">
        <h3><Camera size={18} /> Röntgen ve Görüntü</h3>
        <p className="muted">
          Seçili diş: <b>{selected} nolu</b>. Röntgen, tomografi ve belge yükleyip
          arşivleyebilirsiniz. Arşivleme silmek değildir — dosya depolamada kalır.
        </p>
        <XrayOnizleme pid={id} tooth={selected} />
        <DosyaArsivi pid={id} tooth={selected} tur="xray" baslik="Diş Görüntüleri ve Belgeler" />
      </div>

      <div className="card">
        <h3><Chart size={18} /> Hasta Ölçümleri</h3>
        <p className="muted">Son: Triyaj {rec.triage} | Hijyen {rec.hygiene} | Anksiyete {rec.anxiety}</p>
        <div className="toolbar">
          <label>Ağrı (0-10)<input type="number" min="0" max="10" value={mPain} onChange={(e) => setMPain(e.target.value)} style={{ width: 70 }} /></label>
          <label>Plak (0-3)<input type="number" step="0.1" min="0" max="3" value={mPlaque} onChange={(e) => setMPlaque(e.target.value)} style={{ width: 70 }} /></label>
          <label>Anksiyete (5-25)<input type="number" min="5" max="25" value={mAnx} onChange={(e) => setMAnx(e.target.value)} style={{ width: 70 }} /></label>
          <button onClick={saveMeasure}>Kaydet</button>
        </div>
      </div>

      <div className="card">
        <h3><Send size={18} /> Başka Hekime Sevk</h3>
        <p className="muted">İnceleme sonrası ilgili branş hekimine yönlendirin.</p>
        <div className="toolbar">
          <select value={refDoc} onChange={(e) => setRefDoc(e.target.value)}>
            <option value="">Hekim seç...</option>
            {doctors.map((d) => <option key={d.id} value={d.id}>Dt. {d.name} ({BRANCH_TR[d.branch] || d.branch})</option>)}
          </select>
          <button onClick={async () => {
            const doc = doctors.find((d) => d.id === refDoc)
            if (!doc) return alert('Hekim seçin.')
            const r = await referPatient({ patientId: id, toDoctor: doc.id, branch: doc.branch || 'genel', note: 'Muayene sonrası sevk', fromDoctor: getSession()?.id })
            setMMsg(r.error || `Dt. ${doc.name} hekimine sevk edildi.`)
          }}>Sevk Et</button>
        </div>
      </div>

      <div className="card">
        <h3><FileText size={18} /> Detaylı Onam Raporu</h3>
        <p className="muted">
          Hasta randevu görüşmesine geldiğinde hekim tarafından detaylı onam raporu doldurulur.
          Bu rapor hasta kaydına eklenir ve hasta işlemlerine başlamadan önce onay alınır.
        </p>
        <div className="grid form-grid">
          <label>Hasta Adı<input readOnly value={patient?.name || ''} /></label>
          <label>TC<input readOnly value={patient?.tc_no || ''} /></label>
          <label>Onay Tarihi<input type="date" defaultValue={new Date().toISOString().slice(0, 10)} readOnly /></label>
        </div>
        <label style={{ gridColumn: '1 / -1' }}>Onam Metni / Açıklama<textarea rows="3" value={onamMetni} onChange={(e) => setOnamMetni(e.target.value)} placeholder="Hastaya verilen onam bilgisi, işlem kapsamı ve riskler..." /></label>
        <label style={{ gridColumn: '1 / -1' }}>Hekim Notu<textarea rows="2" value={onamNotu} onChange={(e) => setOnamNotu(e.target.value)} placeholder="Ek notlar..." /></label>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => {
            const rapor = {
              hastaId: id,
              hastaAd: patient?.name,
              tc: patient?.tc_no,
              tarih: new Date().toISOString().slice(0, 10),
              metni: onamMetni,
              notu: onamNotu,
              hekimId: getSession()?.id
            }
            localStorage.setItem(`onam_raporu_${id}`, JSON.stringify(rapor))
            setOnamKaydedildi(true)
            setMMsg('Detaylı onam raporu kaydedildi.')
          }}><Save size={15} /> Onam Raporunu Kaydet</button>
          {onamKaydedildi && <span className="muted"> ✓ Kaydedildi</span>}
        </div>
        {mMsg && <p className="muted">{mMsg}</p>}
      </div>
      <div className="card">
        <h3><FileText size={18} /> Yazdırılabilir Rapor</h3>
        <p className="muted">AI kontrol önerisi: {recall.nextVisit} ({recall.months} ay)</p>
        <Link to={`/rapor/${id}`}><button><FileText size={15} /> Raporu Görüntüle</button></Link>
      </div>
    </div>
  )
}
