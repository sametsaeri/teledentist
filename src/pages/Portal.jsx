import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { demoUsers, demoTeeth, demoReports, STATUS_TR } from '../data/mock.js'
import { ToothChart, ToothVisual } from '../components/ToothChart.jsx'
import { toothEducation, recallForTooth } from '../ai/toothAi.js'
import { suggestRecall } from '../ai/recall.js'
import { load, save, keys, getSession } from '../services/store.js'

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
      {img ? <img src={img} alt="röntgen" className="xray" /> : <p className="muted">Yüklü röntgen yok (demo). Dosya seçip önizleyin.</p>}
      <br />
      <input type="file" accept="image/*" onChange={onFile} />
    </div>
  )
}

// --- Hekim: hasta listesi + arama + randevu talepleri + triyaj kuyruğu ---
export function DoctorList() {
  const [q, setQ] = useState('')
  const [photoNote, setPhotoNote] = useState({})
  const patients = demoUsers.filter((u) => u.role === 'hasta' && u.name.toLowerCase().includes(q.toLowerCase()))
  const appts = load(keys.appointments, [])
  const triage = load(keys.triage, []).slice().sort((a, b) => b.score - a.score)
  const photos = load(keys.photos, [])
  const savePhotoNote = (photoId) => {
    const cur = load(keys.photoNotes, {})
    cur[photoId] = photoNote[photoId] || ''
    save(keys.photoNotes, cur)
    alert('Fotoğraf yorumu kaydedildi.')
  }
  return (
    <div>
      <h1>Hekim Portalı</h1>
      <div className="card toolbar">
        <input placeholder="Diş hastası ara..." value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="badge">{patients.length} diş hastası</span>
        <Link to="/anksiyete"><button className="ghost">Anksiyete Formu</button></Link>
        <Link to="/hijyen"><button className="ghost">Hijyen Formu</button></Link>
      </div>
      {patients.map((p) => (
        <div className="card" key={p.id}>
          <strong>{p.name}</strong> <span className="muted">({p.email})</span>
          <br /><br />
          <Link to={`/hekim/hasta/${p.id}`}><button>Hastayı Aç</button></Link>{' '}
          <Link to={`/rapor/${p.id}`}><button className="ghost">Rapor / Onam</button></Link>
        </div>
      ))}
      <div className="card">
        <h3>Triyaj Kuyruğu ({triage.length})</h3>
        {triage.length === 0 && <p className="muted">Triyaj kaydı yok. Hasta /triyaj adresinden doldurur.</p>}
        {triage.map((t) => <p key={t.id}><span className="badge">{t.score} - {t.level}</span> <strong>{t.patientId}</strong> diş {t.tooth}, ağrı {t.pain} <span className="muted">[{t.date}]</span></p>)}
      </div>
      <div className="card">
        <h3>Gelen Diş Randevu Talepleri ({appts.length})</h3>
        {appts.length === 0 && <p className="muted">Talep yok. Randevu formundan oluşturun.</p>}
        {appts.map((a) => <p key={a.id}><strong>{a.name}</strong> ({a.contact}): {a.complaint} <span className="muted">[{a.date}]</span></p>)}
      </div>
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
    </div>
  )
}

// --- Hekim: hasta detayı ---
export function DoctorPatient() {
  const { id } = useParams()
  const patient = demoUsers.find((u) => u.id === id)
  const savedNotes = load(keys.teethNotes, {})
  const base = demoTeeth[id] || {}
  const [selected, setSelected] = useState(16)
  const [note, setNote] = useState('')
  const [teeth, setTeeth] = useState(base)
  const reports = demoReports.filter((r) => r.patientId === id)

  if (!patient) return <p>Hasta bulunamadı.</p>
  const override = savedNotes[`${id}_${selected}`]
  const sel = teeth[selected] || { status: 'saglam', treatment: '-', date: '-', doctorNote: 'Kayıt yok.' }
  const shownNote = override || sel.doctorNote

  const saveNote = () => {
    const cur = load(keys.teethNotes, {})
    cur[`${id}_${selected}`] = note || shownNote
    save(keys.teethNotes, cur)
    setTeeth((prev) => ({ ...prev, [selected]: { ...sel, doctorNote: note || shownNote, date: new Date().toISOString().slice(0, 10) } }))
    setNote('')
    alert(`${selected} nolu dişe değerlendirme kaydedildi.`)
  }

  const recall = suggestRecall({ lastVisit: patient.lastVisit, treatmentType: patient.treatmentType, plaqueIndex: patient.plaqueIndex, anxietyScore: patient.anxietyScore })

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
        <p className="muted"><strong>AI önerisi (taslak):</strong> {toothEducation(selected, sel.status)} ({recallForTooth(sel.status)})</p>
        <h4>Röntgen (yükle / görüntüle)</h4>
        <XrayBox pid={id} tooth={selected} />
        <h4>Yeni değerlendirme yaz</h4>
        <textarea rows="3" cols="50" value={note} onChange={(e) => setNote(e.target.value)} placeholder={`${selected} nolu diş için değerlendirme...`} />
        <br /><br />
        <button onClick={saveNote}>Değerlendirmeyi Kaydet</button>
      </div>
      <div className="card">
        <h3>Tedavi Geçmişi / Raporlar</h3>
        {reports.map((r) => <p key={r.id}><strong>{r.title}</strong> ({r.date}): {r.note}</p>)}
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
  const childIds = session?.children || ['h1']
  const [pid, setPid] = useState(isParent ? childIds[0] : (session?.id || 'h1'))
  const teeth = demoTeeth[pid] || {}
  const patient = demoUsers.find((u) => u.id === pid)
  const [selected, setSelected] = useState(16)
  const savedNotes = load(keys.teethNotes, {})
  const sel = teeth[selected] || { status: 'saglam', doctorNote: 'Sağlam.' }
  const shownNote = savedNotes[`${pid}_${selected}`] || sel.doctorNote
  const allX = load(keys.xrays, {})
  const ximg = allX[`${pid}_${selected}`]

  return (
    <div>
      <h1>Hasta Paneli</h1>
      {isParent && (
        <div className="card toolbar">
          <span>Çocuk seç:</span>
          {childIds.map((c) => <button key={c} className={pid === c ? '' : 'ghost'} onClick={() => setPid(c)}>{c}</button>)}
        </div>
      )}
      <p className="muted">{patient?.name || pid} olarak görüntülüyorsunuz. Dişinize tıklayın.</p>
      <div className="card">
        <ToothChart teeth={teeth} selected={selected} onSelect={setSelected} />
      </div>
      <div className="card">
        <ToothVisual no={selected} status={sel.status} />
        <p><strong>Hekim değerlendirmesi:</strong> {shownNote}</p>
        <p className="muted"><strong>Dişim hakkında bilgi (AI destekli):</strong> {toothEducation(selected, sel.status)}</p>
        <p><strong>Röntgenim:</strong></p>
        {ximg ? <img src={ximg} alt="röntgen" className="xray" /> : <span className="muted">Bu dişe ait yüklü röntgen yok.</span>}
        <p className="muted"><strong>Sonraki kontrol:</strong> {recallForTooth(sel.status)}</p>
      </div>
    </div>
  )
}
