import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { STATUS_TR } from '../data/teeth.js'
import { ToothChart, ToothVisual } from '../components/ToothChart.jsx'
import { toothEducation, recallForTooth } from '../ai/toothAi.js'
import { suggestRecall } from '../ai/recall.js'
import { load, save, keys, getSession } from '../services/store.js'
import { listPatients, getPatient, getTeeth, saveTooth, lastRecords, createProfile, getChildren, insertTriage, insertHygiene, insertAnxiety, listDoctors, listReferrals, referPatient } from '../services/db.js'
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
      const dataUrl = reader.result
      const cur = load(keys.xrays, {})
      cur[xrayKey(pid, tooth)] = dataUrl
      save(keys.xrays, cur)
      setImg(dataUrl)
    }
    reader.readAsDataURL(f)
  }
  return (
    <div>
      {img ? <img src={img} alt="röntgen" className="xray" /> : <p className="muted">Yüklü röntgen yok. Dosya seçip yükleyin.</p>}
      <br />
      <input type="file" accept="image/*" onChange={onFile} />
    </div>
  )
}

// --- Hekim paneli: sekmeli yapı ---
const TABS = [
  { id: 'hastalar', label: 'Hastalar' },
  { id: 'triyaj', label: 'Triyaj' },
  { id: 'randevu', label: 'Randevular' },
  { id: 'foto', label: 'Fotoğraflar' },
  { id: 'yenikayit', label: 'Yeni Kayıt' }
]

export function DoctorList() {
  const [tab, setTab] = useState('hastalar')
  const [q, setQ] = useState('')
  const [photoNote, setPhotoNote] = useState({})
  const [all, setAll] = useState([])
  const [form, setForm] = useState({ uid: '', role: 'hasta', email: '', name: '', childId: '' })
  const [msg, setMsg] = useState('')
  const [doctors, setDoctors] = useState([])
  const [refs, setRefs] = useState([])
  const [refTo, setRefTo] = useState({})
  const [refMsg, setRefMsg] = useState('')
  useEffect(() => { listPatients().then(setAll); listDoctors().then(setDoctors); listReferrals().then(setRefs) }, [])
  const patients = all.filter((u) => (u.role === 'hasta' || u.role === 'ebeveyn') && (u.name || '').toLowerCase().includes(q.toLowerCase()))
  const appts = load(keys.appointments, [])
  const triage = load(keys.triage, []).slice().sort((a, b) => b.score - a.score)
  const photos = load(keys.photos, [])
  const savePhotoNote = (photoId) => {
    const cur = load(keys.photoNotes, {})
    cur[photoId] = photoNote[photoId] || ''
    save(keys.photoNotes, cur)
    alert('Fotoğraf yorumu kaydedildi.')
  }
  const saveProfile = async () => {
    const r = await createProfile({ ...form, createdBy: getSession()?.id })
    setMsg(r.error || 'Profil kaydedildi.')
    if (!r.error) { listPatients().then(setAll); setForm({ uid: '', role: 'hasta', email: '', name: '', childId: '' }) }
  }
  return (
    <div>
      <h1>Hekim Portalı</h1>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'tab active' : 'tab'} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === 'triyaj' && triage.length > 0 && <span className="tab-count">{triage.length}</span>}
            {t.id === 'randevu' && appts.length > 0 && <span className="tab-count">{appts.length}</span>}
            {t.id === 'foto' && photos.length > 0 && <span className="tab-count">{photos.length}</span>}
          </button>
        ))}
      </div>

      {tab === 'hastalar' && (
        <div>
          <div className="card toolbar">
            <input placeholder="Diş hastası ara..." value={q} onChange={(e) => setQ(e.target.value)} />
            <span className="badge">{patients.length} hasta</span>
          </div>
          {patients.length === 0 && <div className="card"><p className="muted">Kayıtlı hasta yok. Yeni Kayıt sekmesinden ekleyin.</p></div>}
          {patients.map((p) => (
            <div className="card" key={p.id}>
              <strong>{p.name}</strong> <span className="muted">({p.email})</span>
              <br /><br />
              <Link to={`/hekim/hasta/${p.id}`}><button>Hastayı Aç</button></Link>{' '}
              <Link to={`/rapor/${p.id}`}><button className="ghost">Rapor / Onam</button></Link>
            </div>
          ))}
        </div>
      )}

      {tab === 'triyaj' && (
        <div>
          <div className="card">
            <h3>Triyaj Kuyruğu ({triage.length})</h3>
            {triage.length === 0 && <p className="muted">Triyaj kaydı yok.</p>}
            {triage.map((t) => (
              <div key={t.id} style={{ margin: '8px 0' }}>
                <p><span className="badge">{t.score} - {t.level}</span> <strong>{t.patientId}</strong> diş {t.tooth}, ağrı {t.pain} <span className="muted">[{t.date}]</span></p>
                <div className="toolbar">
                  <select value={refTo[t.id] || ''} onChange={(e) => setRefTo((s) => ({ ...s, [t.id]: e.target.value }))}>
                    <option value="">Doktor seç (sevke göre branş önerilir)...</option>
                    {doctors.map((d) => <option key={d.id} value={d.id}>{d.name} {d.branch ? `(${d.branch})` : ''}</option>)}
                  </select>
                  <button className="ghost" onClick={async () => {
                    const doc = doctors.find((d) => d.id === (refTo[t.id] || ''))
                    if (!doc) return alert('Önce doktor seçin.')
                    const r = await referPatient({ patientId: t.patientId, toDoctor: doc.id, branch: doc.branch || 'genel', note: `${t.tooth} nolu diş, ağrı ${t.pain}`, fromDoctor: getSession()?.id })
                    setRefMsg(r.error || `${t.patientId} → ${doc.name} hekimine sevk edildi.`)
                    listReferrals().then(setRefs)
                  }}>Sevk Et</button>
                </div>
              </div>
            ))}
            {refMsg && <p className="muted">{refMsg}</p>}
          </div>
          <div className="card">
            <h3>Sevkler ({refs.length})</h3>
            {refs.length === 0 && <p className="muted">Sevk yok.</p>}
            {refs.map((r) => <p key={r.id}><strong>{r.patient_id}</strong> → {doctors.find((d) => d.id === r.to_doctor)?.name || r.to_doctor} <span className="muted">({r.branch}, {r.status})</span></p>)}
          </div>
        </div>
      )}

      {tab === 'randevu' && (
        <div className="card">
          <h3>Gelen Diş Randevu Talepleri ({appts.length})</h3>
          {appts.length === 0 && <p className="muted">Talep yok.</p>}
          {appts.map((a) => <p key={a.id}><strong>{a.name}</strong> ({a.contact}): {a.complaint} <span className="muted">[{a.date}]</span></p>)}
        </div>
      )}

      {tab === 'foto' && (
        <div className="card">
          <h3>Fotoğrafla Ön Değerlendirme Bekleyenler ({photos.length})</h3>
          {photos.length === 0 && <p className="muted">Fotoğraf yok.</p>}
          {photos.map((p) => (
            <div key={p.id} style={{ margin: '10px 0' }}>
              <img src={p.img} alt="ağız" className="xray" />
              <p className="muted">{p.patientId} - {p.date}</p>
              <input placeholder="Hekim yorumu yaz" value={photoNote[p.id] || ''} onChange={(e) => setPhotoNote((s) => ({ ...s, [p.id]: e.target.value }))} style={{ width: '60%' }} />{' '}
              <button onClick={() => savePhotoNote(p.id)}>Yorumu Kaydet</button>
            </div>
          ))}
        </div>
      )}

      {tab === 'yenikayit' && (
        <div className="card">
          <h3>Yeni Hasta / Ebeveyn Kaydı</h3>
          <p className="muted">Önce Authentication ekranında hesabı açın, UID'yi buraya yapıştırın.</p>
          <div className="toolbar">
            <input placeholder="Auth UID" value={form.uid} onChange={(e) => setForm({ ...form, uid: e.target.value })} style={{ width: 280 }} />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="hasta">Hasta</option>
              <option value="ebeveyn">Ebeveyn</option>
            </select>
            <input placeholder="e-posta" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input placeholder="Ad Soyad" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input placeholder="Çocuk UID (ebeveyn ise)" value={form.childId} onChange={(e) => setForm({ ...form, childId: e.target.value })} />
            <button onClick={saveProfile}>Profili Kaydet</button>
          </div>
          {msg && <p className="muted">{msg}</p>}
        </div>
      )}
    </div>
  )
}

// --- Hekim: hasta detayı ---
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
  useEffect(() => {
    getPatient(id).then((p) => setPatient(p || null))
    getTeeth(id).then(setTeeth)
    lastRecords(id).then(setRec)
  }, [id])
  useEffect(() => { setStatus(sel.status); setTreatment(sel.treatment === '-' ? '' : sel.treatment) }, [selected])

  if (!patient) return <p>Yükleniyor...</p>
  const sel = teeth[selected] || { status: 'saglam', treatment: '-', date: '-', doctorNote: 'Kayıt yok.' }
  const shownNote = sel.doctorNote

  const saveNote = async () => {
    await saveTooth(id, selected, { status, treatment: treatment || '-', doctorNote: note || shownNote })
    setTeeth((prev) => ({ ...prev, [selected]: { status, treatment: treatment || '-', doctorNote: note || shownNote, date: new Date().toISOString().slice(0, 10) } }))
    setNote('')
    alert(`${selected} nolu dişe değerlendirme kaydedildi.`)
  }

  const saveMeasure = async () => {
    const ts = triageScore({ pain: Number(mPain), swelling: false, trauma: false, bleeding: false, fever: false })
    const r1 = await insertTriage(id, { tooth: String(selected), pain: Number(mPain), swelling: false, trauma: false, bleeding: false, fever: false, score: ts.score, level: ts.level })
    const r2 = await insertHygiene(id, { plaque: Number(mPlaque), brush: 2, date: new Date().toISOString().slice(0, 10) })
    const r3 = await insertAnxiety(id, Number(mAnx))
    const err = r1.error || r2.error || r3.error
    setMMsg(err || 'Ölçümler kaydedildi.')
    lastRecords(id).then(setRec)
  }

  const recall = suggestRecall({ lastVisit: patient.lastVisit || new Date().toISOString().slice(0, 10), treatmentType: patient.treatmentType || 'kontrol', plaqueIndex: Number(patient.plaqueIndex || 1), anxietyScore: Number(patient.anxietyScore || 3) })

  return (
    <div>
      <Link to="/hekim">← Hastalar</Link>
      <h1>{patient.name}</h1>
      <p className="muted">Son muayene: {patient.lastVisit} | Plak: {patient.plaqueIndex} | Anksiyete: {patient.anxietyScore} | AI recall: {recall.nextVisit} ({recall.reason})</p>
      <div className="card">
        <h3>Diş Haritası (FDI)</h3>
        <ToothChart teeth={teeth} selected={selected} onSelect={setSelected} />
      </div>
      <div className="card">
        <ToothVisual no={selected} status={sel.status} />
        <p><strong>Durum:</strong> {STATUS_TR[sel.status]} | <strong>Tedavi:</strong> {sel.treatment} | <strong>Tarih:</strong> {sel.date}</p>
        <p><strong>Mevcut hekim notu:</strong> {shownNote}</p>
        <p className="muted"><strong>AI önerisi:</strong> {toothEducation(selected, sel.status)} ({recallForTooth(sel.status)})</p>
        <h4>Diş tanımı (hekim doldurur)</h4>
        <div className="toolbar">
          <label>Durum: <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(STATUS_TR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></label>
          <input placeholder="Tedavi (örn: Kompozit dolgu)" value={treatment} onChange={(e) => setTreatment(e.target.value)} />
        </div><br />
        <h4>Röntgen (yükle / görüntüle)</h4>
        <XrayBox pid={id} tooth={selected} />
        <h4>Değerlendirme notu</h4>
        <textarea rows="3" cols="50" value={note} onChange={(e) => setNote(e.target.value)} placeholder={`${selected} nolu diş için değerlendirme...`} />
        <br /><br />
        <button onClick={saveNote}>Diş Kaydını Kaydet</button>
      </div>
      <div className="card">
        <h3>Hasta Ölçümleri (hekim girer)</h3>
        <p className="muted">Son: Triyaj {rec.triage} | Hijyen {rec.hygiene} | Anksiyete {rec.anxiety}</p>
        <div className="toolbar">
          <label>Ağrı (0-10): <input type="number" min="0" max="10" value={mPain} onChange={(e) => setMPain(e.target.value)} style={{ width: 70 }} /></label>
          <label>Plak (0-3): <input type="number" step="0.1" min="0" max="3" value={mPlaque} onChange={(e) => setMPlaque(e.target.value)} style={{ width: 70 }} /></label>
          <label>Anksiyete (5-25): <input type="number" min="5" max="25" value={mAnx} onChange={(e) => setMAnx(e.target.value)} style={{ width: 70 }} /></label>
          <button onClick={saveMeasure}>Ölçümleri Kaydet</button>
        </div>
        {mMsg && <p className="muted">{mMsg}</p>}
      </div>
      <div className="card">
        <h3>Tedavi Geçmişi</h3>
        <p className="muted">Diş bazlı kayıtlar yukarıdaki haritada tutulur.</p>
        <Link to={`/rapor/${id}`}><button className="ghost">Yazdırılabilir Rapor / Onam</button></Link>
      </div>
      <div className="card">
        <h3>Triyaj / Hijyen / Anksiyete (bu hastaya ait)</h3>
        <p className="muted">Triyaj: {(load(keys.triage, []).filter((t) => t.patientId === id).slice(-1)[0]?.level) || 'kayıt yok'}</p>
        <p className="muted">Hijyen: {(load(keys.hygiene, []).filter((h) => h.patientId === id).slice(-1)[0]?.plaque ?? 'kayıt yok') + ' plak'}</p>
        <p className="muted">Anksiyete: {(load(keys.anxiety, []).filter((a) => a.patientId === id).slice(-1)[0]?.total ?? 'kayıt yok') + ' puan'}</p>
        <div className="toolbar">
          <Link to="/triyaj"><button className="ghost">Triyaj Formu</button></Link>
          <Link to="/hijyen"><button className="ghost">Hijyen Formu</button></Link>
          <Link to="/anksiyete"><button className="ghost">Anksiyete Formu</button></Link>
          <Link to="/on-degerlendirme"><button className="ghost">Foto Yükle</button></Link>
        </div>
      </div>
    </div>
  )
}

// --- Hasta / Ebeveyn paneli ---
export function PatientPanel() {
  const session = getSession()
  const isParent = session?.role === 'ebeveyn'
  const [children, setChildren] = useState([])
  const [pid, setPid] = useState(isParent ? null : session?.id)
  const [patient, setPatient] = useState(null)
  const [teeth, setTeeth] = useState({})
  const [selected, setSelected] = useState(16)
  useEffect(() => {
    if (isParent && session?.id) getChildren(session.id).then((c) => { setChildren(c); if (c.length && !pid) setPid(c[0].id) })
  }, [])
  useEffect(() => {
    if (!pid) return
    getPatient(pid).then((p) => setPatient(p || null))
    getTeeth(pid).then(setTeeth)
  }, [pid])
  const sel = teeth[selected] || { status: 'saglam', doctorNote: 'Kayıt yok.' }
  const allX = load(keys.xrays, {})
  const ximg = allX[`${pid}_${selected}`]

  return (
    <div>
      <h1>Hasta Paneli</h1>
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
        <p className="muted"><strong>Dişim hakkında bilgi (AI destekli):</strong> {toothEducation(selected, sel.status)}</p>
        <p><strong>Röntgenim:</strong></p>
        {ximg ? <img src={ximg} alt="röntgen" className="xray" /> : <span className="muted">Bu dişe ait yüklü röntgen yok.</span>}
        <p className="muted"><strong>Sonraki kontrol:</strong> {recallForTooth(sel.status)}</p>
      </div>
    </div>
  )
}
