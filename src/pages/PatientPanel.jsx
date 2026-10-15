// Hasta / Ebeveyn paneli — sade, anlaşılır, modüllü
// Her bölüm tek iş yapar, boş durumlar ve hatalar kullanıcıya gösterilir.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSession } from '../services/store.js'
import { ToothChart, ToothVisual } from '../components/ToothChart.jsx'
import { toothEducation, recallForTooth } from '../ai/toothAi.js'
import { suggestRecall } from '../ai/recall.js'
import {
  getPatient, getTeeth, updatePatient, getChildren, listAppointments,
  listPhotos, signedPhotoUrl, listHygiene, listAnxiety, anamnesisApi
} from '../services/db.js'
import { STATUS_TR } from '../data/teeth.js'
import {
  Tooth, Calendar, FileText, Save, Phone, User, MapPin, Heart, Bell,
  Camera, Clipboard, Drop, Sparkle, Video, ChevronRight, Alert, CheckCircle, Clock
} from '../components/Icons.jsx'
import { reminderInfo } from './Portal.jsx'

const EMPTY = {}

/* --- Küçük yardımcılar --- */
function Card({ icon: Icon, title, desc, children, action }) {
  return (
    <div className="card patient-card">
      <div className="card-head">
        <h3><Icon size={18} /> {title}</h3>
        {action}
      </div>
      {desc && <p className="muted">{desc}</p>}
      {children}
    </div>
  )
}

function Empty({ text }) {
  return <p className="muted empty-state">{text}</p>
}

/* --- Diş özeti --- */
function toothSummary(teeth) {
  const out = {}
  Object.values(teeth || {}).forEach((t) => {
    const s = t?.status || 'saglam'
    out[s] = (out[s] || 0) + 1
  })
  return out
}

/* ================================================================== */
export function PatientPanel() {
  const session = getSession()
  const isParent = session?.role === 'ebeveyn'

  const [children, setChildren] = useState([])
  const [pid, setPid] = useState(isParent ? null : session?.id)
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)
  const [teeth, setTeeth] = useState({})
  const [selected, setSelected] = useState(16)
  const [appts, setAppts] = useState([])
  const [photos, setPhotos] = useState([])
  const [anamnesis, setAnamnesis] = useState([])
  const [hygiene, setHygiene] = useState([])
  const [anxiety, setAnxiety] = useState([])
  const [info, setInfo] = useState({})
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isParent && session?.id) {
      getChildren(session.id).then((c) => {
        setChildren(c)
        if (c.length && !pid) setPid(c[0].id)
        if (!c.length) setLoading(false)
      })
    }
  }, [])

  useEffect(() => {
    if (!pid) return
    setLoading(true)
    Promise.all([getPatient(pid), getTeeth(pid)]).then(([p, t]) => {
      setPatient(p || null)
      setInfo(p || {})
      setTeeth(t || {})
      setLoading(false)
    })
  }, [pid])

  useEffect(() => { listAppointments().then(setAppts) }, [])

  useEffect(() => {
    if (!pid) return
    listPhotos(pid).then(async (rows) => {
      const withUrls = await Promise.all(rows.map(async (r) => ({ ...r, url: r.path ? await signedPhotoUrl(r.path) : r.img || null })))
      setPhotos(withUrls)
    })
    anamnesisApi.list({ where: { patient_id: pid } }).then(setAnamnesis)
    listHygiene(pid).then(setHygiene)
    listAnxiety(pid).then(setAnxiety)
  }, [pid])

  const sel = teeth[selected] || { status: 'saglam', doctorNote: 'Kayıt yok.' }
  const summary = useMemo(() => toothSummary(teeth), [teeth])
  const recall = useMemo(() => suggestRecall({
    lastVisit: patient?.last_visit || new Date().toISOString().slice(0, 10),
    treatmentType: patient?.treatment_type || 'kontrol',
    plaqueIndex: Number(patient?.plaque_index ?? 1),
    anxietyScore: Number(patient?.anxiety_score ?? 3)
  }), [patient])

  // Randevalar: önce patient_id, yoksa ad ile eşleştir
  const myAppts = useMemo(() => {
    if (!patient) return []
    const nm = (patient.name || '').toLowerCase()
    return appts.filter((a) =>
      (a.patient_id && a.patient_id === patient.id) ||
      (!a.patient_id && (a.name || '').toLowerCase() === nm) ||
      (a.contact && patient.phone && String(a.contact).includes(String(patient.phone).slice(-7)))
    )
  }, [appts, patient])

  const nextAppt = myAppts.filter((a) => a.status !== 'tamamlandı' && a.appt_date)
    .sort((a, b) => String(a.appt_date).localeCompare(String(b.appt_date)))[0]

  const saveInfo = async () => {
    setSaving(true); setMsg('')
    const patch = {
      phone: info.phone, address: info.address, city: info.city, district: info.district,
      blood: info.blood, birth_date: info.birth_date, gender: info.gender,
      insurance: info.insurance, school: info.school, occupation: info.occupation,
      near_name: info.near_name, near_phone: info.near_phone, near_relation: info.near_relation
    }
    Object.keys(patch).forEach((k) => { if (patch[k] === undefined) delete patch[k] })
    const r = await updatePatient(pid, patch)
    setMsg(r.error || 'Bilgileriniz kaydedildi.')
    setSaving(false)
    if (!r.error) getPatient(pid).then(setPatient)
  }

  /* ---------------- Yükleniyor ---------------- */
  if (loading) {
    return (
      <div>
        <div className="panel-hero"><h1><Tooth size={22} /> Hasta Paneli</h1></div>
        <div className="card"><p className="muted">Bilgileriniz yükleniyor, lütfen bekleyin...</p></div>
      </div>
    )
  }

  /* ---------------- Ebeveyn: çocuk yok ---------------- */
  if (isParent && children.length === 0) {
    return (
      <div>
        <div className="panel-hero"><h1><Tooth size={22} /> Hasta Paneli</h1></div>
        <div className="card">
          <h3><Alert size={18} /> Bağlı çocuk kaydı yok</h3>
          <p className="muted">
            Ebeveyn hesabınıza bağlı bir çocuk profili henüz eklenmemiş.
            Bu paneli kullanabilmek için hekiminizin hesabınızı çocuk profilinize bağlaması gerekir.
            Sorunuz varsa klinikten yardım isteyin.
          </p>
          <Link to="/hesap"><button className="ghost">Hesap Ayarlarım</button></Link>
        </div>
      </div>
    )
  }

  /* ---------------- Hasta bulunamadı ---------------- */
  if (!patient) {
    return (
      <div>
        <div className="panel-hero"><h1><Tooth size={22} /> Hasta Paneli</h1></div>
        <div className="card">
          <h3><Alert size={18} /> Profil bilgisi alınamadı</h3>
          <p className="muted">Hesabınıza ait profil kaydı bulunamadı. Lütfen klinik yönetimine başvurun.</p>
        </div>
      </div>
    )
  }

  const ri = reminderInfo(patient)
  const critical = anamnesis.filter((a) => a.critical)

  return (
    <div>
      {/* ---------- Üst başlık ---------- */}
      <div className="panel-hero">
        <div>
          <h1><Tooth size={22} /> Merhaba, {patient.name}</h1>
          <p className="muted">Diş sağlığınızla ilgili tüm bilgileriniz burada.</p>
        </div>
        <span className="spacer" />
        <Link to="/video"><button className="btn-new"><Video size={16} /> Hekimimle Görüş</button></Link>
      </div>

      {/* ---------- Ebeveyn: çocuk seçimi ---------- */}
      {isParent && (
        <div className="card toolbar">
          <span><User size={15} /> Hangi çocuğunuz?</span>
          {children.map((c) => (
            <button key={c.id} className={pid === c.id ? '' : 'ghost'} onClick={() => setPid(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* ---------- Özet kutuları ---------- */}
      <div className="kpi-row">
        <div className="kpi">
          <b>{nextAppt ? String(nextAppt.appt_date).slice(5) : '—'}</b>
          <span>Sonraki Randevu</span>
        </div>
        <div className={`kpi ${ri.left <= 0 ? 'warn' : ''}`}>
          <b>{ri.date ? String(ri.date).slice(5) : '—'}</b>
          <span>Önerilen Kontrol</span>
        </div>
        <div className="kpi"><b>{myAppts.length}</b><span>Toplam Randevu</span></div>
        <div className="kpi"><b>{photos.length}</b><span>Gönderdiğim Fotoğraf</span></div>
      </div>

      {/* ---------- Uyarılar ---------- */}
      {critical.length > 0 && (
        <div className="card warn-card">
          <h3><Alert size={18} /> Dikkat: Bilmeniz Gerekenler</h3>
          {critical.map((c) => (
            <p key={c.id}><b>{c.title}</b> {c.detail}</p>
          ))}
          <p className="muted">Bu bilgiler hekiminiz tarafından işaretlendi. Tedavi öncesi mutlaka bildirin.</p>
        </div>
      )}

      {/* ---------- Dişlerim ---------- */}
      <Card icon={Tooth} title="Dişlerim" desc="Dişinize tıklayarak durumunu ve hekiminizin notunu görün.">
        <div className="tooth-summary">
          {Object.entries(summary).map(([s, n]) => (
            <span className="badge" key={s}>{STATUS_TR[s] || s}: {n}</span>
          ))}
          {Object.keys(summary).length === 0 && <span className="muted">Henüz diş kaydı yok.</span>}
        </div>
        <div style={{ marginTop: 12 }}>
          <ToothChart teeth={teeth} selected={selected} onSelect={setSelected} />
        </div>

        <div className="tooth-detail">
          <ToothVisual no={selected} status={sel.status} />
          <div>
            <p><strong>{selected} nolu diş</strong> — <span className="badge">{STATUS_TR[sel.status] || sel.status}</span></p>
            <p><strong>Hekim notu:</strong> {sel.doctorNote}</p>
            <p className="muted"><strong>Bu diş hakkında:</strong> {toothEducation(selected, sel.status)}</p>
            <p className="muted"><Clock size={13} /> Önerilen kontrol aralığı: {recallForTooth(sel.status)}</p>
          </div>
        </div>
      </Card>

      {/* ---------- Randevularım ---------- */}
      <Card
        icon={Calendar} title="Randevularım" desc="Randevu isteğiniz hekiminiz tarafından onaylanır."
        action={<Link to="/randevu"><button className="ghost tiny"><Calendar size={13} /> Randevu İste</button></Link>}
      >
        {myAppts.length === 0 && <Empty text="Henüz randevu kaydınız yok. " />}
        {myAppts.map((a) => (
          <div className="appt-row" key={a.id}>
            <div>
              <strong>{a.appt_date || 'Tarih bekleniyor'}</strong>
              {a.appt_time ? ` · ${a.appt_time}` : ''}
              <span className="badge">{STATUS_APPT[a.status] || a.status}</span>
              {a.is_online && <span className="badge online">Online görüşme</span>}
              <p className="muted">{a.complaint}</p>
            </div>
          </div>
        ))}
      </Card>

      {/* ---------- Fotoğraflarım ---------- */}
      <Card
        icon={Camera} title="Fotoğraflarım" desc="Gönderdiğiniz fotoğraflar ve hekiminizin yorumu."
        action={<Link to="/on-degerlendirme"><button className="ghost tiny"><Camera size={13} /> Fotoğraf Gönder</button></Link>}
      >
        {photos.length === 0 && <Empty text="Henüz fotoğraf göndermediniz." />}
        {photos.map((p) => (
          <div className="photo-row" key={p.id}>
            {p.url ? <img src={p.url} alt="ağız" className="xray" /> : <p className="muted">Görüntü yüklenemedi.</p>}
            <div>
              <p className="muted">{String(p.created_at || '').slice(0, 10)}</p>
              <p><strong>Hekim yorumu:</strong> {p.note || 'Henüz değerlendirilmedi.'}</p>
              <span className="badge">{p.status === 'degerlendirildi' ? 'Değerlendirildi' : 'Hekim bekleniyor'}</span>
            </div>
          </div>
        ))}
      </Card>

      {/* ---------- Benim kayıtlarım ---------- */}
      <Card icon={Clipboard} title="Benim Kayıtlarım" desc="Test sonuçlarınız ve hekiminizin önerileri.">
        <div className="record-grid">
          <div className="record-box">
            <b><Alert size={15} /> Ağrı / Triyaj</b>
            {(() => {
              const last = triageLast(anamnesis)
              return last ? <p>{last.level} · skor {last.score}</p> : <p className="muted">Kayıt yok</p>
            })()}
          </div>
          <div className="record-box">
            <b><Drop size={15} /> Diş Taşı (plak)</b>
            {hygiene[0] ? <p>{hygiene[0].plaque} / 3</p> : <p className="muted">Kayıt yok</p>}
          </div>
          <div className="record-box">
            <b><Sparkle size={15} /> Diş Kaygısı</b>
            {anxiety[0] ? <p>{anxiety[0].total} / 25</p> : <p className="muted">Kayıt yok</p>}
          </div>
          <div className="record-box">
            <b><Heart size={15} /> Son Kontrol</b>
            <p>{patient.last_visit || 'Kayıt yok'}</p>
          </div>
        </div>
        <div className="record-actions">
          <Link to="/triyaj"><button className="ghost"><Alert size={15} /> Ağrı Anketi</button></Link>
          <Link to="/hijyen"><button className="ghost"><Drop size={15} /> Hijyen Takibi</button></Link>
          <Link to="/anksiyete"><button className="ghost"><Sparkle size={15} /> Kaygı Testi</button></Link>
        </div>
      </Card>

      {/* ---------- Bilgilerim ---------- */}
      <Card icon={User} title="Bilgilerim" desc="İletişim ve kişisel bilgilerinizi güncelleyebilirsiniz.">
        <div className="grid form-grid">
          <label>Telefon<input value={info.phone || ''} onChange={(e) => setInfo({ ...info, phone: e.target.value })} /></label>
          <label>Doğum Tarihi<input type="date" value={info.birth_date || ''} onChange={(e) => setInfo({ ...info, birth_date: e.target.value })} /></label>
          <label>Cinsiyet
            <select value={info.gender || ''} onChange={(e) => setInfo({ ...info, gender: e.target.value })}>
              <option value="">Seçin</option><option value="Kadın">Kadın</option><option value="Erkek">Erkek</option>
            </select>
          </label>
          <label>Kan Grubu<input value={info.blood || ''} onChange={(e) => setInfo({ ...info, blood: e.target.value })} placeholder="örn: A Rh+" /></label>
          <label>Sağlık Sigortası<input value={info.insurance || ''} onChange={(e) => setInfo({ ...info, insurance: e.target.value })} /></label>
          <label>Okul / Kurum<input value={info.school || ''} onChange={(e) => setInfo({ ...info, school: e.target.value })} /></label>
          <label>Meslek<input value={info.occupation || ''} onChange={(e) => setInfo({ ...info, occupation: e.target.value })} /></label>
          <label>Şehir<input value={info.city || ''} onChange={(e) => setInfo({ ...info, city: e.target.value })} /></label>
          <label>İlçe<input value={info.district || ''} onChange={(e) => setInfo({ ...info, district: e.target.value })} /></label>
          <label style={{ gridColumn: '1 / -1' }}>Adres<input value={info.address || ''} onChange={(e) => setInfo({ ...info, address: e.target.value })} /></label>
        </div>

        <h4 className="modal-sub"><Phone size={15} /> Acil Durumda Aranacak Kişi</h4>
        <div className="grid form-grid">
          <label>Yakın Adı<input value={info.near_name || ''} onChange={(e) => setInfo({ ...info, near_name: e.target.value })} /></label>
          <label>Yakın Telefonu<input value={info.near_phone || ''} onChange={(e) => setInfo({ ...info, near_phone: e.target.value })} /></label>
          <label>Yakınlık
            <select value={info.near_relation || ''} onChange={(e) => setInfo({ ...info, near_relation: e.target.value })}>
              <option value="">Seçin</option>
              {['Anne', 'Baba', 'Eş', 'Kardeş', 'Akraba', 'Veli'].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        </div>

        <button onClick={saveInfo} disabled={saving}>
          <Save size={15} /> {saving ? 'Kaydediliyor...' : 'Bilgilerimi Kaydet'}
        </button>
        {msg && <p className="muted">{msg}</p>}
      </Card>

      {/* ---------- Hatırlatma ---------- */}
      <Card icon={Bell} title="Kontrol Hatırlatması" desc={`Kontrol öneriniz ${recall.nextVisit} (${recall.months} ay).`}>
        <p className="reminder-line">
          {ri.date
            ? <>Önerilen kontrol tarihi: <b>{ri.date}</b> ({ri.left >= 0 ? `${ri.left} gün kaldı` : `${Math.abs(ri.left)} gün geçti`})</>
            : <>Henüz kontrol tarihiniz belirlenmedi.</>}
        </p>
        <p className="muted">
          Randevunuzdan önce hekiminize haber verilir. Size klinikten ön bilgilendirme yapılacaktır.
        </p>
      </Card>

      {/* ---------- Yardım ---------- */}
      <Card icon={FileText} title="Yardım ve Bilgilendirme">
        <div className="help-links">
          <Link to="/on-degerlendirme"><ChevronRight size={15} /> Fotoğraf gönder</Link>
          <Link to="/video"><ChevronRight size={15} /> Hekimimle online görüş</Link>
          <Link to="/randevu"><ChevronRight size={15} /> Yeni randevu iste</Link>
          <Link to="/memnuniyet"><ChevronRight size={15} /> Görüşlerimi paylaş</Link>
          <Link to="/hesap"><ChevronRight size={15} /> Şifremi değiştir</Link>
        </div>
      </Card>
    </div>
  )
}

const STATUS_APPT = {
  'yeni': 'Bekliyor', 'onaylı': 'Onaylandı', 'tamamlandı': 'Tamamlandı', 'iptal': 'İptal'
}

function triageLast(rows) {
  if (!rows?.length) return null
  const t = [...rows].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0]
  return t
}
