import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { STATUS_TR } from '../data/teeth.js'
import { load, save, keys, getSession } from '../services/store.js'
import { triageScore, anxietyLevel, hygieneTip } from '../services/clinical.js'
import { suggestRecall } from '../ai/recall.js'
import { toothEducation } from '../ai/toothAi.js'
import {
  getPatient, getTeeth, listPhotos, insertPhoto, setPhotoNote, uploadImage, signedPhotoUrl,
  insertTriage, insertHygiene, insertAnxiety, listHygiene
} from '../services/db.js'

function pid() { return getSession()?.id || '' }

// 1. Triyaj anketi
export function Triage() {
  const [pain, setPain] = useState(5)
  const [swelling, setSwelling] = useState(false)
  const [trauma, setTrauma] = useState(false)
  const [bleeding, setBleeding] = useState(false)
  const [fever, setFever] = useState(false)
  const [tooth, setTooth] = useState('16')
  const [done, setDone] = useState(null)
  const submit = async () => {
    const r = triageScore({ pain, swelling, trauma, bleeding, fever })
    const rec = { id: Date.now(), patientId: pid(), tooth, pain, swelling, trauma, bleeding, fever, ...r, date: new Date().toISOString().slice(0, 16) }
    const list = load(keys.triage, [])
    list.push(rec)
    save(keys.triage, list)
    // Hekimin görebilmesi için sunucuya da yaz
    await insertTriage(pid(), { tooth: String(tooth), pain: Number(pain), swelling, trauma, bleeding, fever, score: r.score, level: r.level })
    setDone(r)
  }
  return (
    <div>
      <h1>Diş Triyaj Anketi</h1>
      <div className="card">
        <label>İlgili diş (FDI): <input value={tooth} onChange={(e) => setTooth(e.target.value)} style={{ width: 70 }} /></label><br /><br />
        <label>Ağrı (0-10): <input type="range" min="0" max="10" value={pain} onChange={(e) => setPain(e.target.value)} /> <b>{pain}</b></label><br />
        <label><input type="checkbox" checked={swelling} onChange={(e) => setSwelling(e.target.checked)} /> Şişlik var</label><br />
        <label><input type="checkbox" checked={trauma} onChange={(e) => setTrauma(e.target.checked)} /> Travma / darbe</label><br />
        <label><input type="checkbox" checked={bleeding} onChange={(e) => setBleeding(e.target.checked)} /> Kanama</label><br />
        <label><input type="checkbox" checked={fever} onChange={(e) => setFever(e.target.checked)} /> Ateş</label><br /><br />
        <button onClick={submit}>Skoru Hesapla ve Kaydet</button>
        {done && <p><span className="badge">{done.level} (skor {done.score})</span></p>}
      </div>
    </div>
  )
}

// 2. Plak ve hijyen takibi
export function Hygiene() {
  const [plaque, setPlaque] = useState(1.5)
  const [brush, setBrush] = useState(2)
  const [done, setDone] = useState(false)
  const [history, setHistory] = useState([])
  const reload = () => { listHygiene(pid()).then(setHistory) }
  useEffect(reload, [])
  const submit = async () => {
    const list = load(keys.hygiene, [])
    list.push({ id: Date.now(), patientId: pid(), plaque: Number(plaque), brush: Number(brush), date: new Date().toISOString().slice(0, 10) })
    save(keys.hygiene, list)
    await insertHygiene(pid(), { plaque: Number(plaque), brush: Number(brush) })
    setDone(true)
    reload()
  }
  return (
    <div>
      <h1>Plak ve Hijyen Takibi</h1>
      <div className="card">
        <label>Plak indeksi (0-3): <input type="number" step="0.1" min="0" max="3" value={plaque} onChange={(e) => setPlaque(e.target.value)} /></label><br /><br />
        <label>Günde fırçalama: <input type="number" min="0" max="5" value={brush} onChange={(e) => setBrush(e.target.value)} /></label><br /><br />
        <button onClick={submit}>Kaydet</button>
        {done && <p className="muted">{hygieneTip(Number(plaque), Number(brush))}</p>}
      </div>
      <div className="card">
        <h3>Geçmişim</h3>
        {history.length === 0 && <p className="muted">Kayıt yok.</p>}
        {history.map((h) => (
          <div key={h.id} style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '6px 0' }}>
            <span className="muted">{h.date}</span>
            <div style={{ flex: 1, background: '#e2e8f0', borderRadius: 6, height: 12 }}>
              <div style={{ width: `${(h.plaque / 3) * 100}%`, background: h.plaque >= 2 ? '#dc2626' : '#0284c7', height: 12, borderRadius: 6 }} />
            </div>
            <b>{h.plaque}</b>
          </div>
        ))}
      </div>
    </div>
  )
}

// 3. Dental anksiyete ölçeği (MDAS kısa)
const ANX_Q = ['Diş randevusu yarın olsa nasıl hissedersiniz?', 'Bekleme salonunda nasıl hissedersiniz?', 'Diş temizliği sırasında?', 'Dolgu için iğne olurken?', 'Diş çekimi düşününce?']
export function Anxiety() {
  const [ans, setAns] = useState([3, 3, 3, 3, 3])
  const [done, setDone] = useState(null)
  const submit = async () => {
    const total = ans.reduce((a, b) => a + Number(b), 0)
    const list = load(keys.anxiety, [])
    list.push({ id: Date.now(), patientId: pid(), total, date: new Date().toISOString().slice(0, 10) })
    save(keys.anxiety, list)
    await insertAnxiety(pid(), total)
    setDone(total)
  }
  return (
    <div>
      <h1>Dental Anksiyete Ölçeği</h1>
      <div className="card">
        {ANX_Q.map((q, i) => (
          <p key={i}>{q}<br />
            {[1, 2, 3, 4, 5].map((v) => (
              <label key={v} style={{ marginRight: 8 }}><input type="radio" checked={Number(ans[i]) === v} onChange={() => setAns((a) => a.map((x, j) => (j === i ? v : x)))} />{v}</label>
            ))}
          </p>
        ))}
        <button onClick={submit}>Kaydet</button>
        {done && <p><span className="badge">{done} puan - {anxietyLevel(done)}</span></p>}
      </div>
    </div>
  )
}

// 4. Fotoğrafla ön değerlendirme
export function PhotoReview() {
  const me = getSession()
  const [list, setList] = useState([])
  const [img, setImg] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = () => { listPhotos(pid()).then(setList) }
  useEffect(reload, [])

  // Kayıt satırındaki dosya için imzalı bağlantı üret
  useEffect(() => {
    let alive = true
    ;(async () => {
      const rows = await listPhotos(pid())
      const withUrls = await Promise.all(rows.map(async (r) => ({
        ...r,
        url: r.path ? await signedPhotoUrl(r.path) : r.img || null
      })))
      if (alive) setList(withUrls)
    })()
    return () => { alive = false }
  }, [])

  const onFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setMsg(''); setBusy(true)
    const r = new FileReader()
    r.onload = async () => {
      const dataUrl = r.result
      setImg(dataUrl)
      const up = await uploadImage('photos', pid(), 'foto', dataUrl)
      if (up.error) {
        setBusy(false)
        return setMsg('Yükleme yapılamadı: ' + up.error)
      }
      const ins = await insertPhoto({ patientId: pid(), path: up.path, createdBy: me?.id })
      setBusy(false)
      if (ins.error) return setMsg(ins.error)
      setMsg('Fotoğrafınız hekiminize iletildi.')
      e.target.value = ''
      reload()
    }
    r.readAsDataURL(f)
  }

  return (
    <div>
      <h1>Fotoğrafla Ön Değerlendirme</h1>
      <div className="card">
        <p className="muted">Ağız içi fotoğraf yükleyin, hekiminiz yorumunu yazar.</p>
        <input type="file" accept="image/*" capture="environment" onChange={onFile} disabled={busy} />
        {busy && <p className="muted">Yükleniyor...</p>}
        {img && <div><br /><img src={img} alt="ağız" className="xray" /></div>}
        {msg && <p className="muted">{msg}</p>}
      </div>
      {list.length === 0 && <div className="card"><p className="muted">Henüz fotoğraf yüklemediniz.</p></div>}
      {list.map((p) => (
        <div className="card" key={p.id}>
          {p.url
            ? <img src={p.url} alt="ağız" className="xray" />
            : <p className="muted">Görüntü yüklenemedi.</p>}
          <p className="muted">
            {p.created_at ? String(p.created_at).slice(0, 16) : p.date} ·{' '}
            <span className="badge">{p.status === 'degerlendirildi' ? 'Değerlendirildi' : 'Hekim bekleniyor'}</span>
          </p>
          <p><strong>Hekim yorumu:</strong> {p.note || 'Henüz yorum yok.'}</p>
        </div>
      ))}
    </div>
  )
}

// 5. PDF rapor ve onam (yazdırma)
export function Report({ patientId }) {
  const [p, setP] = useState(null)
  const [teeth, setTeeth] = useState({})
  useEffect(() => {
    getPatient(patientId).then((x) => setP(x || null))
    getTeeth(patientId).then(setTeeth)
  }, [patientId])
  if (!p) return <p>Yükleniyor...</p>
  const recall = suggestRecall({ lastVisit: p.last_visit || p.lastVisit || new Date().toISOString().slice(0, 10), treatmentType: p.treatment_type || p.treatmentType || 'kontrol', plaqueIndex: Number(p.plaque_index ?? p.plaqueIndex ?? 1), anxietyScore: Number(p.anxiety_score ?? p.anxietyScore ?? 3) })
  const anx = load(keys.anxiety, []).filter((a) => a.patientId === p.id).slice(-1)[0]
  return (
    <div>
      <div className="card">
        <img src="/ktu-logo.png" alt="KTÜ" className="ktu-logo-lg" />
        <h1>Diş Hekimliği Hasta Raporu</h1>
        <p><strong>Hasta:</strong> {p.name} | <strong>Son muayene:</strong> {p.last_visit || p.lastVisit || '-'}</p>
        <p><strong>Plak:</strong> {p.plaque_index ?? p.plaqueIndex ?? '-'} | <strong>Anksiyete:</strong> {anx ? `${anx.total} puan` : (p.anxiety_score ?? p.anxietyScore ?? '-')}</p>
        <p><strong>AI recall:</strong> {recall.nextVisit} ({recall.reason})</p>
        <h3>Diş Durumu</h3>
        {Object.keys(teeth).length === 0 && <p className="muted">Kayıtlı diş tedavisi yok.</p>}
        {Object.entries(teeth).map(([no, t]) => (
          <p key={no}><strong>{no}</strong> ({STATUS_TR[t.status]}): {t.doctorNote} <span className="muted">[{toothEducation(no, t.status)}]</span></p>
        ))}
        <h3>Ebeveyn / Hasta Onamı</h3>
        <p className="muted">Verilerimin diş hekimliği tedavisi ve TÜBİTAK araştırma kapsamında işlenmesini kabul ediyorum. İmza: .................... Tarih: ............</p>
        <button onClick={() => window.print()}>Yazdır / PDF Kaydet</button>{' '}
        <Link to={`/hekim/hasta/${p.id}`}><button className="ghost">Hekim Görünümü</button></Link>
      </div>
    </div>
  )
}
