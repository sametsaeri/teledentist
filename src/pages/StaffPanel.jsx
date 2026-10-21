// Sekreter ve Diş Teknisyeni paneli
//   Sekreter : randevu yönetimi, ön bilgilendirme, iletişim
//   Teknisyen: hasta adına yüz yüze form doldurma, doktora ön bilgi
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSession } from '../services/store.js'
import {
  listAppointments, listPatients, approveAppointment, completeAppointment,
  insertAppointment, setAppointmentOnline, intakeApi, prepApi, insertTriage
} from '../services/db.js'
import {
  Calendar, Users, Clock, Check, Phone, Clipboard, Plus, X,
  Stethoscope, CheckCircle, Save, Bell
} from '../components/Icons.jsx'

const BRANCHES = ['genel-dis', 'restoratif', 'endodonti', 'periodonti', 'pedodonti', 'ortodonti', 'protez', 'agiz-cerrahi']
const BRANCH_TR = {
  'genel-dis': 'Genel Diş', restoratif: 'Restoratif', endodonti: 'Endodonti',
  periodonti: 'Periodontoloji', pedodonti: 'Pedodonti', ortodonti: 'Ortodonti',
  protez: 'Protez', 'agiz-cerrahi': 'Ağız ve Çene Cerrahisi'
}
const METHOD_TR = { 'yuz-yuze': 'Yüz yüze', telefon: 'Telefon', 'hasta-girdisi': 'Hasta girdisi' }

const ROLE_LABEL = { sekreter: 'Sekreter', teknisyen: 'Diş Teknisyeni', hekim: 'Hekim', admin: 'Süper Admin' }

function Card({ icon: Icon, title, desc, children }) {
  return (
    <div className="card patient-card">
      <div className="card-head"><h3><Icon size={18} /> {title}</h3></div>
      {desc && <p className="muted">{desc}</p>}
      {children}
    </div>
  )
}

export function StaffPanel() {
  const me = getSession()
  const isTech = me?.role === 'teknisyen'
  const [appts, setAppts] = useState([])
  const [patients, setPatients] = useState([])
  const [intake, setIntake] = useState([])
  const [prep, setPrep] = useState([])
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')

  // Yeni randevu formu
  const [form, setForm] = useState({ name: '', contact: '', dept: 'genel-dis', complaint: '', apptDate: '', online: false })

  // Hasta adına form (teknisyen)
  const [ic, setIc] = useState({ patient_id: '', method: 'yuz-yuze', pain: 0, complaint: '', note: '' })

  // Ön bilgilendirme
  const [prepText, setPrepText] = useState('')
  const [prepPatient, setPrepPatient] = useState('')

  const reload = () => {
    listAppointments().then(setAppts)
    listPatients().then(setPatients)
    intakeApi.list().then(setIntake)
    prepApi.list().then(setPrep)
  }
  useEffect(() => { reload() }, [])

  const today = new Date().toISOString().slice(0, 10)
  const pending = appts.filter((a) => a.status === 'yeni')
  const upcoming = appts.filter((a) => a.status === 'onaylı' && a.appt_date && a.appt_date >= today)
    .sort((a, b) => String(a.appt_date).localeCompare(String(b.appt_date)))
  const todays = upcoming.filter((a) => a.appt_date === today)

  const ql = q.toLowerCase()
  const found = useMemo(() => patients.filter((p) =>
    !ql || (p.name || '').toLowerCase().includes(ql) || (p.phone || '').includes(ql) || (p.tc_no || '').includes(ql)
  ), [patients, ql])

  const addAppt = async () => {
    setMsg('')
    if (!form.name.trim()) return setMsg('Hasta adı zorunlu.')
    if (!form.contact.trim()) return setMsg('Telefon zorunlu.')
    const r = await insertAppointment({
      name: form.name, contact: form.contact, dept: form.dept,
      complaint: form.complaint || 'Genel muayene talebi', apptDate: form.apptDate, online: form.online
    })
    setMsg(r.error || 'Randevu talebi oluşturuldu.')
    setForm({ name: '', contact: '', dept: 'genel-dis', complaint: '', apptDate: '', online: false })
    reload()
  }

  const approve = async (a) => {
    if (!a.appt_date) return setMsg('Önce randevu tarihi seçin.')
    const clash = appts.some((x) => x.id !== a.id && x.appt_date === a.appt_date && x.status === 'onaylı')
    if (clash) return setMsg(`${a.appt_date} için zaten onaylı bir randevu var.`)
    const r = await approveAppointment(a.id, null, a.appt_date)
    setMsg(r.error || 'Randevu onaylandı.')
    reload()
  }

  const saveIntake = async () => {
    setMsg('')
    const p = patients.find((x) => x.id === ic.patient_id)
    if (!p) return setMsg('Hasta seçin.')
    if (!ic.complaint.trim()) return setMsg('Şikayet/ana yakınma yazın.')
    const r = await intakeApi.insert({
      patient_id: p.id, patient_name: p.name, recorded_by: me?.id || null,
      method: ic.method, pain: Number(ic.pain), complaint: ic.complaint, note: ic.note
    })
    if (r.error) return setMsg(r.error)
    // Doktorun triyaj kuyruğuna da düşsün
    await insertTriage(p.id, { tooth: '-', pain: Number(ic.pain), score: Number(ic.pain) * 4, level: Number(ic.pain) >= 7 ? 'acil' : Number(ic.pain) >= 4 ? 'orta' : 'hafif' })
    setMsg(`${p.name} için form kaydedildi ve doktorun kuyruğuna eklendi.`)
    setIc({ patient_id: '', method: 'yuz-yuze', pain: 0, complaint: '', note: '' })
    reload()
  }

  const addPrep = async () => {
    setMsg('')
    if (!prepPatient) return setMsg('Hasta seçin.')
    if (!prepText.trim()) return setMsg('Ön bilgilendirme metni yazın.')
    const p = patients.find((x) => x.id === prepPatient)
    if (!p) return setMsg('Hasta bulunamadı, listeyi yenileyin.')
    const r = await prepApi.insert({ patient_id: p.id, patient_name: p.name, author_id: me?.id || null, text: prepText })
    setMsg(r.error || 'Ön bilgilendirme kaydedildi.')
    setPrepText('')
    reload()
  }

  const togglePrep = async (row) => {
    await prepApi.update(row.id, { done: !row.done })
    reload()
  }

  return (
    <div>
      <div className="panel-hero">
        <div>
          <h1><Stethoscope size={22} /> {ROLE_LABEL[me?.role] || 'Personel'} Paneli</h1>
          <p className="muted">
            {isTech
              ? 'Dijital kullanmayan hastalar için yüz yüze form doldurur, doktoru bilgilendirirsiniz.'
              : 'Randevu, ön bilgilendirme ve hasta iletişimi yönetimi.'}
          </p>
        </div>
      </div>

      <div className="kpi-row">
        <div className={`kpi ${pending.length ? 'warn' : ''}`}><b>{pending.length}</b><span>Bekleyen Talep</span></div>
        <div className="kpi"><b>{todays.length}</b><span>Bugünün Randevusu</span></div>
        <div className="kpi"><b>{upcoming.length}</b><span>Yaklaşan Randevu</span></div>
        <div className="kpi"><b>{intake.length}</b><span>Doldurulan Form</span></div>
        <div className="kpi"><b>{prep.filter((p) => !p.done).length}</b><span>Açık Ön Bilgi</span></div>
      </div>

      {/* ---------- Randevu oluştur ---------- */}
      <Card icon={Calendar} title="Yeni Randevu Talebi" desc="Hasta adına randevu talebi oluşturun; hekim onaylar.">
        <div className="grid form-grid">
          <label>Hasta Adı *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Telefon *<input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="05…" /></label>
          <label>Bölüm
            <select value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })}>
              {BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_TR[b]}</option>)}
            </select>
          </label>
          <label>Tarih<input type="date" value={form.apptDate} onChange={(e) => setForm({ ...form, apptDate: e.target.value })} /></label>
          <label style={{ gridColumn: '1 / -1' }}>Şikayet
            <input value={form.complaint} onChange={(e) => setForm({ ...form, complaint: e.target.value })} placeholder="örn. Sağ alt arka dişte ağrı" />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            <input type="checkbox" checked={form.online} onChange={(e) => setForm({ ...form, online: e.target.checked })} />
            {' '}Online (görüntülü) görüşme istiyor
          </label>
        </div>
        <button onClick={addAppt}><Plus size={15} /> Randevu Talebi Oluştur</button>
      </Card>

      {/* ---------- Bekleyen talepler ---------- */}
      <Card icon={Clock} title={`Bekleyen Randevu Talepleri (${pending.length})`} desc="Tarih verip onaylayın.">
        {pending.length === 0 && <p className="muted">Bekleyen talep yok.</p>}
        {pending.map((a) => (
          <div className="appt-row" key={a.id}>
            <div>
              <strong>{a.name}</strong> <span className="muted">({a.contact})</span>
              <span className="badge">{BRANCH_TR[a.dept] || a.dept}</span>
              {a.is_online && <span className="badge online">Online</span>}
              <p className="muted">{a.complaint}</p>
            </div>
            <div className="toolbar">
              <input type="date" onChange={(e) => setAppts((prev) => prev.map((x) => (x.id === a.id ? { ...x, appt_date: e.target.value } : x)))} />
              <button className="ghost" onClick={() => setAppointmentOnline(a.id, !a.is_online)}>
                {a.is_online ? 'Online ✓' : 'Online yap'}
              </button>
              <button onClick={() => approve(a)}><Check size={15} /> Onayla</button>
            </div>
          </div>
        ))}
      </Card>

      {/* ---------- Bugün ---------- */}
      <Card icon={Calendar} title={`Bugün (${today})`} desc="Günün randevu akışı.">
        {todays.length === 0 && <p className="muted">Bugün randevu yok.</p>}
        {todays.map((a) => (
          <div className="appt-row" key={a.id}>
            <div>
              <span className="time-chip">{a.appt_time || '—'}</span>
              <strong>{a.name}</strong> <span className="muted">({a.contact})</span>
              <p className="muted">{a.complaint}</p>
            </div>
            <div className="toolbar">
              <button className="ghost" onClick={async () => { const r = await completeAppointment(a.id); setMsg(r.error || 'Tamamlandı.'); reload() }}>
                <Check size={15} /> Tamamlandı
              </button>
            </div>
          </div>
        ))}
      </Card>

      {/* ---------- Hasta adına form ---------- */}
      <Card
        icon={Clipboard} title="Hasta Adına Form Doldur"
        desc="Dijital kullanmayan hastaların triyaj/şikayet bilgisini yüz yüze alıp sisteme girin."
      >
        <div className="grid form-grid">
          <label>Hasta
            <select value={ic.patient_id} onChange={(e) => setIc({ ...ic, patient_id: e.target.value })}>
              <option value="">— seçin —</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>Nasıl alındı
            <select value={ic.method} onChange={(e) => setIc({ ...ic, method: e.target.value })}>
              <option value="yuz-yuze">Yüz yüze</option>
              <option value="telefon">Telefon</option>
              <option value="hasta-girdisi">Hastanın verdiği bilgi</option>
            </select>
          </label>
          <label>Ağrı (0-10)<input type="number" min="0" max="10" value={ic.pain} onChange={(e) => setIc({ ...ic, pain: e.target.value })} /></label>
          <label style={{ gridColumn: '1 / -1' }}>Şikayet / Ana Yakınma *
            <input value={ic.complaint} onChange={(e) => setIc({ ...ic, complaint: e.target.value })} />
          </label>
          <label style={{ gridColumn: '1 / -1' }}>Not
            <textarea rows="2" value={ic.note} onChange={(e) => setIc({ ...ic, note: e.target.value })} />
          </label>
        </div>
        <button onClick={saveIntake}><Save size={15} /> Formu Kaydet</button>
        <p className="muted">Kaydedilen kayıt doktorun triyaj kuyruğuna otomatik düşer.</p>
      </Card>

      {/* ---------- Ön bilgilendirme ---------- */}
      <Card icon={Bell} title="Ön Bilgilendirme" desc="Randevu öncesi hastaya iletilecek bilgileri hazırlayın.">
        <div className="grid form-grid">
          <label>Hasta
            <select value={prepPatient} onChange={(e) => setPrepPatient(e.target.value)}>
              <option value="">— seçin —</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label style={{ gridColumn: '1 / -1' }}>Bilgilendirme
            <input value={prepText} onChange={(e) => setPrepText(e.target.value)} placeholder="örn. Tedavi öncesi yemek yemeyiniz." />
          </label>
        </div>
        <button onClick={addPrep}><Plus size={15} /> Bilgilendirme Ekle</button>

        {prep.length === 0 && <p className="muted">Henüz bilgilendirme kaydı yok.</p>}
        {prep.map((p) => (
          <div className={`appt-row ${p.done ? 'done-row' : ''}`} key={p.id}>
            <div>
              <strong>{p.patient_name || '—'}</strong>
              <p className="muted">{p.text}</p>
            </div>
            <span className="row-actions">
              <button className="ghost tiny" onClick={() => togglePrep(p)}>
                <Check size={13} /> {p.done ? 'Geri al' : 'İletildi'}
              </button>
              <button className="ghost tiny danger" onClick={async () => { await prepApi.remove(p.id); reload() }}>
                <X size={13} /> Sil
              </button>
            </span>
          </div>
        ))}
      </Card>

      {/* ---------- Hastalar ---------- */}
      <Card icon={Users} title={`Hastalar (${patients.length})`} desc="İletişim ve temel bilgiler.">
        <div className="toolbar">
          <input placeholder="Ad, telefon veya TC ile ara..." value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 240 }} />
          <span className="badge">{found.length} sonuç</span>
        </div>
        {found.length === 0 && <p className="muted">Kayıt bulunamadı.</p>}
        {found.map((p) => (
          <div className="appt-row" key={p.id}>
            <div>
              <strong>{p.name}</strong> <span className="muted">({p.role})</span>
              <p className="muted">
                <Phone size={13} /> {p.phone || 'telefon yok'}
                {p.tc_no ? ` · TC ${p.tc_no}` : ''}{p.city ? ` · ${p.city}` : ''}
              </p>
            </div>
            <span className="row-actions">
              <a href={p.phone ? `tel:${p.phone}` : undefined}><button className="ghost tiny"><Phone size={13} /> Ara</button></a>
            </span>
          </div>
        ))}
      </Card>

      {/* ---------- Kayıtlar ---------- */}
      <Card icon={Clipboard} title={`Doldurulan Formlar (${intake.length})`} desc="Yüz yüze alınan hasta kayıtları.">
        {intake.length === 0 && <p className="muted">Henüz form doldurulmadı.</p>}
        {intake.map((r) => (
          <div className="appt-row" key={r.id}>
            <div>
              <span className="badge">{METHOD_TR[r.method] || r.method}</span>
              <strong>{r.patient_name || '—'}</strong>
              <p className="muted">Ağrı {r.pain}/10 · {String(r.created_at || '').slice(0, 10)}</p>
              <p>{r.complaint}</p>
              {r.note && <p className="muted">{r.note}</p>}
            </div>
          </div>
        ))}
      </Card>

      {msg && <div className="card"><p className="auth-ok"><CheckCircle size={15} /> {msg}</p></div>}
    </div>
  )
}
