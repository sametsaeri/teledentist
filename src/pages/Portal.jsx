import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { STATUS_TR } from '../data/teeth.js'
import { ToothChart, ToothVisual } from '../components/ToothChart.jsx'
import { toothEducation, recallForTooth } from '../ai/toothAi.js'
import { suggestRecall } from '../ai/recall.js'
import { load, save, keys, getSession } from '../services/store.js'
import { createUserByDoctor } from '../services/auth.js'
import {
  listPatients, getPatient, getTeeth, saveTooth, lastRecords, updatePatient, getChildren,
  insertTriage, insertHygiene, insertAnxiety, listDoctors, listReferrals, referPatient,
  listAppointments, approveAppointment, completeAppointment, listRequests, approveRequest
} from '../services/db.js'
import { triageScore } from '../services/clinical.js'

function xrayKey(pid, tooth) { return `${pid}_${tooth}` }

function XrayBox({ pid, tooth }) {
  const all = load(keys.xrays, {})
  const [img, setImg] = useState(all[xrayKey(pid, tooth)] || null)
  const onFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const cur = load(keys.xrays, {})
      cur[xrayKey(pid, tooth)] = reader.result
      save(keys.xrays, cur)
      setImg(reader.result)
    }
    reader.readAsDataURL(f)
  }
  return (
    <div>
      {img ? <img src={img} alt="röntgen" className="xray" /> : <p className="muted">Bu dişe ait yüklü röntgen yok.</p>}
      <input type="file" accept="image/*" onChange={onFile} />
    </div>
  )
}

const TABS = [
  { id: 'ozet', label: '📊 Genel Bakış' },
  { id: 'hastalar', label: '🧑‍🦷 Hastalar' },
  { id: 'yeni', label: '➕ Yeni Hasta' },
  { id: 'takvim', label: '📆 Takvim' },
  { id: 'randevu', label: '📥 Randevu Talepleri' },
  { id: 'triyaj', label: '🩺 Triyaj & Sevk' },
  { id: 'foto', label: '📷 Fotoğraflar' },
  { id: 'istek', label: '📝 Kayıt İstekleri' }
]

const BRANCHES = ['genel', 'restoratif', 'endodonti', 'periodontoloji', 'pedodonti', 'ortodonti', 'protez', 'ağız-cerrahi']
const BRANCH_TR = { genel: 'Genel Diş', restoratif: 'Restoratif', endodonti: 'Endodonti', periodontoloji: 'Periodontoloji', pedodonti: 'Pedodonti', ortodonti: 'Ortodonti', protez: 'Protez', 'ağız-cerrahi': 'Ağız ve Çene Cerrahisi' }

const emptyForm = () => ({
  name: '', email: '', pass: '', role: 'hasta', tc_no: '', birth_date: '', gender: '',
  phone: '', address: '', city: '', district: '', blood: '', insurance: '', school: '',
  occupation: '', near_name: '', near_phone: '', near_relation: '', childEmail: '',
  reminder_days: 5, branch: 'genel'
})

export function DoctorList() {
  const [tab, setTab] = useState('ozet')
  const [q, setQ] = useState('')
  const [all, setAll] = useState([])
  const [doctors, setDoctors] = useState([])
  const [refs, setRefs] = useState([])
  const [requests, setRequests] = useState([])
  const [appts, setAppts] = useState([])
  const [refTo, setRefTo] = useState({})
  const [msg, setMsg] = useState('')
  const [refMsg, setRefMsg] = useState('')
  const [form, setForm] = useState(emptyForm())
  const [approveDate, setApproveDate] = useState({})
  const me = getSession()

  const reload = () => {
    listPatients().then(setAll)
    listDoctors().then(setDoctors)
    listReferrals().then(setRefs)
    listRequests().then(setRequests)
    listAppointments().then(setAppts)
  }
  useEffect(reload, [])

  const patients = all.filter((u) => (u.role === 'hasta' || u.role === 'ebeveyn') && (u.name || '').toLowerCase().includes(q.toLowerCase()))
  const triage = load(keys.triage, []).slice().sort((a, b) => b.score - a.score)
  const photos = load(keys.photos, [])
  const photoNote = load(keys.photoNotes, {})
  const pending = appts.filter((a) => a.status === 'yeni')
  const approved = appts.filter((a) => a.status === 'onaylı' && a.appt_date)

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
      childEmail: form.childEmail, extra
    })
    if (r.error) return setMsg(r.error)
    setMsg(`✅ ${form.name} hesabı açıldı. Giriş: ${form.email} / ${form.pass}`)
    setForm(emptyForm())
    reload()
  }

  const savePhotoNote = (photoId) => {
    const cur = load(keys.photoNotes, {})
    cur[photoId] = cur[photoId] || ''
    save(keys.photoNotes, cur)
  }

  return (
    <div>
      <h1>🧑‍⚕️ Hekim Paneli</h1>
      <p className="muted">Hoş geldiniz {me?.name}</p>

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'randevu' && pending.length > 0 && <span className="tab-count">{pending.length}</span>}
            {t.id === 'istek' && requests.length > 0 && <span className="tab-count">{requests.length}</span>}
            {t.id === 'foto' && photos.length > 0 && <span className="tab-count">{photos.length}</span>}
          </button>
        ))}
      </div>

      {/* ---------------- GENEL BAKIŞ ---------------- */}
      {tab === 'ozet' && (
        <div>
          <div className="kpi-row">
            <div className="kpi"><b>{patients.length}</b><span>Kayıtlı Hasta</span></div>
            <div className="kpi"><b>{doctors.length}</b><span>Hekim</span></div>
            <div className="kpi warn"><b>{pending.length}</b><span>Bekleyen Randevu Talebi</span></div>
            <div className="kpi"><b>{approved.length}</b><span>Onaylı Randevu</span></div>
            <div className="kpi"><b>{triage.length}</b><span>Triyaj Kaydı</span></div>
          </div>
          <div className="card">
            <h3>⏰ Yaklaşan Hatırlatmalar</h3>
            <ReminderList patients={all} />
          </div>
        </div>
      )}

      {/* ---------------- HASTALAR ---------------- */}
      {tab === 'hastalar' && (
        <div>
          <div className="card toolbar">
            <input placeholder="🔍 Ad, TC, telefon ile ara..." value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }} />
            <span className="badge">{patients.length} hasta</span>
          </div>
          {patients.length === 0 && <div className="card"><p className="muted">Kayıtlı hasta yok. "Yeni Hasta" sekmesinden ekleyin.</p></div>}
          {patients.map((p) => (
            <div className="card patient-row" key={p.id}>
              <div>
                <strong>🦷 {p.name}</strong> <span className="muted">({p.email})</span>
                <p className="muted">
                  {p.tc_no ? `TC: ${p.tc_no} · ` : ''}{p.gender || ''} {p.birth_date ? `· ${p.birth_date}` : ''}{p.phone ? ` · ${p.phone}` : ''}
                </p>
              </div>
              <div className="toolbar">
                <Link to={`/hekim/hasta/${p.id}`}><button>Hastayı Aç</button></Link>
                <Link to={`/rapor/${p.id}`}><button className="ghost">📄 Rapor</button></Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- YENİ HASTA ---------------- */}
      {tab === 'yeni' && (
        <div className="card">
          <h3>➕ Yeni Hasta / Ebeveyn Kaydı</h3>
          <p className="muted">Hesap otomatik açılır. Hasta, verdiğiniz e-posta ve şifreyle giriş yapar.</p>
          <div className="grid form-grid">
            <label>Ad Soyad *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>E-posta (giriş) *<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Geçici şifre *<input value={form.pass} onChange={(e) => setForm({ ...form, pass: e.target.value })} /></label>
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
          <h4>Kimlik Bilgileri</h4>
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
            <label>Telefon<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label>Adres<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
            <label>İl<input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
            <label>İlçe<input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></label>
          </div>
          <h4>Sosyal ve Yakın Bilgileri</h4>
          <div className="grid form-grid">
            <label>Okul<input value={form.school} onChange={(e) => setForm({ ...form, school: e.target.value })} /></label>
            <label>Meslek<input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} /></label>
            <label>Sağlık Sigortası<input value={form.insurance} onChange={(e) => setForm({ ...form, insurance: e.target.value })} /></label>
            <label>Yakın Adı<input value={form.near_name} onChange={(e) => setForm({ ...form, near_name: e.target.value })} /></label>
            <label>Yakın Telefonu<input value={form.near_phone} onChange={(e) => setForm({ ...form, near_phone: e.target.value })} /></label>
            <label>Yakınlık Derecesi<input value={form.near_relation} onChange={(e) => setForm({ ...form, near_relation: e.target.value })} /></label>
            <label>Hatırlatma (gün önce)
              <select value={form.reminder_days} onChange={(e) => setForm({ ...form, reminder_days: e.target.value })}>
                {[1, 2, 3, 5, 7, 10, 14].map((d) => <option key={d} value={d}>{d} gün</option>)}
              </select>
            </label>
          </div>
          <button onClick={saveNewPatient}>Hesabı Oluştur</button>
          {msg && <p className="muted">{msg}</p>}
        </div>
      )}

      {/* ---------------- TAKVİM ---------------- */}
      {tab === 'takvim' && <CalendarView appts={approved} onComplete={async (id) => { await completeAppointment(id); reload() }} />}

      {/* ---------------- RANDEVU TALEPLERİ ---------------- */}
      {tab === 'randevu' && (
        <div className="card">
          <h3>📥 Gelen Randevu Talepleri ({pending.length})</h3>
          {pending.length === 0 && <p className="muted">Bekleyen talep yok.</p>}
          {pending.map((a) => (
            <div key={a.id} className="appt-row">
              <div>
                <strong>{a.name}</strong> <span className="muted">({a.contact})</span>
                <p className="muted">🦷 {a.complaint}</p>
                <span className="badge">{BRANCH_TR[a.dept] || a.dept}</span>
              </div>
              <div className="toolbar">
                <input type="date" value={approveDate[a.id] || ''} onChange={(e) => setApproveDate((s) => ({ ...s, [a.id]: e.target.value }))} />
                <button onClick={async () => {
                  if (!approveDate[a.id]) return alert('Tarih seçin.')
                  const r = await approveAppointment(a.id, me?.id, approveDate[a.id])
                  setMsg(r.error || 'Randevu onaylandı ve takvime eklendi.')
                  reload()
                }}>✅ Onayla</button>
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
            <h3>🩺 Triyaj Kuyruğu ({triage.length})</h3>
            {triage.length === 0 && <p className="muted">Triyaj kaydı yok.</p>}
            {triage.map((t) => (
              <div key={t.id} className="appt-row">
                <div>
                  <span className="badge">{t.score} - {t.level}</span>
                  <p><strong>{t.patientId}</strong> · diş {t.tooth} · ağrı {t.pain} <span className="muted">[{t.date}]</span></p>
                </div>
                <div className="toolbar">
                  <select value={refTo[t.id] || ''} onChange={(e) => setRefTo((s) => ({ ...s, [t.id]: e.target.value }))}>
                    <option value="">Sevk edilecek hekim...</option>
                    {doctors.filter((d) => d.id !== me?.id).map((d) => <option key={d.id} value={d.id}>Dt. {d.name} {d.branch ? `(${BRANCH_TR[d.branch] || d.branch})` : ''}</option>)}
                  </select>
                  <button className="ghost" onClick={async () => {
                    const doc = doctors.find((d) => d.id === (refTo[t.id] || ''))
                    if (!doc) return alert('Hekim seçin.')
                    const r = await referPatient({ patientId: t.patientId, toDoctor: doc.id, branch: doc.branch || 'genel', note: `${t.tooth} nolu diş, ağrı ${t.pain}`, fromDoctor: me?.id })
                    setRefMsg(r.error || `${t.patientId} → Dt. ${doc.name} hekimine sevk edildi.`)
                    reload()
                  }}>Sevk Et</button>
                </div>
              </div>
            ))}
            {refMsg && <p className="muted">{refMsg}</p>}
          </div>
          <div className="card">
            <h3>🔀 Sevk Kayıtları ({refs.length})</h3>
            {refs.length === 0 && <p className="muted">Sevk kaydı yok.</p>}
            {refs.map((r) => (
              <p key={r.id}><strong>{r.patient_id}</strong> → Dt. {doctors.find((d) => d.id === r.to_doctor)?.name || r.to_doctor} <span className="muted">({BRANCH_TR[r.branch] || r.branch} · {r.status})</span></p>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- FOTOĞRAFLAR ---------------- */}
      {tab === 'foto' && (
        <div className="card">
          <h3>📷 Fotoğrafla Ön Değerlendirme ({photos.length})</h3>
          {photos.length === 0 && <p className="muted">Fotoğraf yok.</p>}
          {photos.map((p) => (
            <div key={p.id} className="photo-row">
              <img src={p.img} alt="ağız" className="xray" />
              <div>
                <p className="muted">{p.patientId} - {p.date}</p>
                <p className="muted">💬 {photoNote[p.id] || 'Yorum yok'}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- KAYIT İSTEKLERİ ---------------- */}
      {tab === 'istek' && (
        <div className="card">
          <h3>📝 Gelen Kayıt İstekleri ({requests.length})</h3>
          {requests.length === 0 && <p className="muted">Bekleyen kayıt isteği yok.</p>}
          {requests.map((r) => (
            <div key={r.id} className="appt-row">
              <div>
                <strong>{r.name}</strong> <span className="muted">({r.email})</span>
                <span className="badge">{r.role}</span>
              </div>
              <button onClick={async () => {
                const res = await approveRequest(r, me?.id)
                setMsg(res.error || 'Kullanıcı onaylandı.')
                reload()
              }}>✅ Onayla</button>
            </div>
          ))}
          {msg && <p className="muted">{msg}</p>}
        </div>
      )}
    </div>
  )
}

function ReminderList({ patients }) {
  const items = useMemo(() => {
    const out = []
    patients.forEach((p) => {
      const days = Number(p.reminder_days ?? p.reminderDays ?? 5)
      const lv = p.last_visit || p.lastVisit
      if (!lv) return
      const v = new Date(lv); v.setMonth(v.getMonth() + 3)
      const left = Math.ceil((v - new Date()) / 86400000)
      if (left >= 0 && left <= days) out.push({ id: p.id, name: p.name, left, days, phone: p.phone, near: p.near_name, nearPhone: p.near_phone })
    })
    return out.sort((a, b) => a.left - b.left)
  }, [patients])
  if (items.length === 0) return <p className="muted">Şu an hatırlatma gerektiren hasta yok.</p>
  return items.map((i) => (
    <div key={i.id} className="reminder-row">
      <b className={i.left === 0 ? 'due-now' : ''}>{i.left === 0 ? '🔴 BUGÜN' : `⏳ ${i.left} gün kaldı`}</b>
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
        <button className="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>◀</button>
        <h3>{month.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</h3>
        <button className="ghost" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>▶</button>
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
                  <button className="ghost tiny" onClick={() => onComplete(a.id)}>✔ Bitti</button>
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

  useEffect(() => {
    getPatient(id).then((p) => { setPatient(p || null); setInfo(p || {}) })
    getTeeth(id).then(setTeeth)
    lastRecords(id).then(setRec)
    listDoctors().then(setDoctors)
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
      <Link to="/hekim">← Hastalar</Link>
      <h1>🦷 {patient.name}</h1>
      <p className="muted">
        {patient.tc_no ? `TC: ${patient.tc_no} · ` : ''}{patient.gender || ''} {patient.birth_date || ''} · {patient.phone || 'telefon yok'}
      </p>

      <div className="card">
        <h3>📋 Hasta Bilgileri</h3>
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
        <button onClick={saveInfo}>💾 Bilgileri Kaydet</button>
        {mMsg && <p className="muted">{mMsg}</p>}
      </div>

      <div className="card">
        <h3>🦷 Diş Haritası (FDI)</h3>
        <ToothChart teeth={teeth} selected={selected} onSelect={setSelected} />
      </div>

      <div className="card">
        <ToothVisual no={selected} status={sel.status} />
        <p><strong>Durum:</strong> {STATUS_TR[sel.status]} | <strong>Tedavi:</strong> {sel.treatment} | <strong>Tarih:</strong> {sel.date}</p>
        <p className="muted"><strong>AI bilgilendirme:</strong> {toothEducation(selected, sel.status)} ({recallForTooth(sel.status)})</p>
        <div className="toolbar">
          <label>Durum:
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(STATUS_TR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <input placeholder="Tedavi" value={treatment} onChange={(e) => setTreatment(e.target.value)} />
        </div><br />
        <h4>📷 Röntgen</h4>
        <XrayBox pid={id} tooth={selected} />
        <h4>📝 Değerlendirme Notu</h4>
        <textarea rows="3" cols="50" value={note} onChange={(e) => setNote(e.target.value)} placeholder={`${selected} nolu diş için not...`} />
        <br /><br />
        <button onClick={saveNote}>💾 Diş Kaydını Kaydet</button>
      </div>

      <div className="card">
        <h3>📏 Hasta Ölçümleri</h3>
        <p className="muted">Son: Triyaj {rec.triage} | Hijyen {rec.hygiene} | Anksiyete {rec.anxiety}</p>
        <div className="toolbar">
          <label>Ağrı (0-10)<input type="number" min="0" max="10" value={mPain} onChange={(e) => setMPain(e.target.value)} style={{ width: 70 }} /></label>
          <label>Plak (0-3)<input type="number" step="0.1" min="0" max="3" value={mPlaque} onChange={(e) => setMPlaque(e.target.value)} style={{ width: 70 }} /></label>
          <label>Anksiyete (5-25)<input type="number" min="5" max="25" value={mAnx} onChange={(e) => setMAnx(e.target.value)} style={{ width: 70 }} /></label>
          <button onClick={saveMeasure}>Kaydet</button>
        </div>
      </div>

      <div className="card">
        <h3>🔀 Başka Hekime Sevk</h3>
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
        <h3>📄 Rapor / Onam</h3>
        <p className="muted">AI kontrol önerisi: {recall.nextVisit} ({recall.months} ay)</p>
        <Link to={`/rapor/${id}`}><button>🖨️ Yazdırılabilir Rapor</button></Link>
      </div>
    </div>
  )
}

// ---------------- Danışan paneli ----------------
export function PatientPanel() {
  const session = getSession()
  const isParent = session?.role === 'ebeveyn'
  const [children, setChildren] = useState([])
  const [pid, setPid] = useState(isParent ? null : session?.id)
  const [patient, setPatient] = useState(null)
  const [teeth, setTeeth] = useState({})
  const [selected, setSelected] = useState(16)
  const [appts, setAppts] = useState([])
  const [info, setInfo] = useState({})
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (isParent && session?.id) getChildren(session.id).then((c) => { setChildren(c); if (c.length && !pid) setPid(c[0].id) })
  }, [])
  useEffect(() => {
    if (!pid) return
    getPatient(pid).then((p) => { setPatient(p || null); setInfo(p || {}) })
    getTeeth(pid).then(setTeeth)
  }, [pid])

  useEffect(() => {
    listAppointments().then(setAppts)
  }, [])

  const sel = teeth[selected] || { status: 'saglam', doctorNote: 'Kayıt yok.' }
  const ximg = load(keys.xrays, {})[`${pid}_${selected}`]
  const myAppts = appts.filter((a) => (a.name || '').toLowerCase() === (patient?.name || '').toLowerCase())

  const saveInfo = async () => {
    const r = await updatePatient(pid, { phone: info.phone, city: info.city, address: info.address, near_name: info.near_name, near_phone: info.near_phone })
    setMsg(r.error || 'Bilgileriniz güncellendi.')
  }

  return (
    <div>
      <h1>🦷 Dişlerim</h1>
      {isParent && (
        <div className="card toolbar">
          <span>Çocuk seç:</span>
          {children.length === 0 && <span className="muted">Kayıtlı çocuk yok.</span>}
          {children.map((c) => <button key={c.id} className={pid === c.id ? '' : 'ghost'} onClick={() => setPid(c.id)}>{c.name}</button>)}
        </div>
      )}
      <p className="muted">{patient?.name || 'Yükleniyor...'} — dişinize tıklayın.</p>

      <div className="card">
        <ToothChart teeth={teeth} selected={selected} onSelect={setSelected} />
      </div>

      <div className="card">
        <ToothVisual no={selected} status={sel.status} />
        <p><strong>Hekim değerlendirmesi:</strong> {sel.doctorNote}</p>
        <p className="muted"><strong>Dişim hakkında bilgi:</strong> {toothEducation(selected, sel.status)}</p>
        <p><strong>Röntgenim:</strong></p>
        {ximg ? <img src={ximg} alt="röntgen" className="xray" /> : <span className="muted">Bu dişe ait yüklü röntgen yok.</span>}
        <p className="muted"><strong>Sonraki kontrol:</strong> {recallForTooth(sel.status)}</p>
      </div>

      <div className="card">
        <h3>📆 Randevularım</h3>
        {myAppts.length === 0 && <p className="muted">Randevu kaydınız yok. <Link to="/randevu">Randevu oluşturun</Link>.</p>}
        {myAppts.map((a) => (
          <p key={a.id}>
            📅 {a.appt_date || 'tarih bekleniyor'} · {a.appt_time || ''} · <span className="badge">{a.status}</span>
            <span className="muted"> {a.complaint}</span>
          </p>
        ))}
      </div>

      <div className="card">
        <h3>📝 İletişim Bilgilerim</h3>
        <div className="grid form-grid">
          <label>Telefon<input value={info.phone || ''} onChange={(e) => setInfo({ ...info, phone: e.target.value })} /></label>
          <label>Şehir<input value={info.city || ''} onChange={(e) => setInfo({ ...info, city: e.target.value })} /></label>
          <label>Adres<input value={info.address || ''} onChange={(e) => setInfo({ ...info, address: e.target.value })} /></label>
          <label>Yakın<input value={info.near_name || ''} onChange={(e) => setInfo({ ...info, near_name: e.target.value })} /></label>
          <label>Yakın Telefon<input value={info.near_phone || ''} onChange={(e) => setInfo({ ...info, near_phone: e.target.value })} /></label>
        </div>
        <button onClick={saveInfo}>💾 Kaydet</button>
        {msg && <p className="muted">{msg}</p>}
      </div>
    </div>
  )
}