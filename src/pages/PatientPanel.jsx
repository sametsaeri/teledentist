// Hasta / Ebeveyn paneli — sade, anlaşılır, modüllü
// Her bölüm tek iş yapar, boş durumlar ve hatalar kullanıcıya gösterilir.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSession } from '../services/store.js'
import { HASTALIKLAR } from '../components/AnamnezForm.jsx'
import { OnGorusmeAnamnez } from '../components/OnGorusmeAnamnez.jsx'
import { onGorusmeTamamMi } from '../services/onGorusme.js'
import { listBildirimler, bildirimOlustur } from '../services/bildirim.js'
import { ToothChart, ToothVisual } from '../components/ToothChart.jsx'
import { disBilgisi } from '../data/disAdlari.js'
import { suggestRecall } from '../ai/recall.js'
import {
  getPatient, getTeeth, updatePatient, getChildren, listAppointments,
  listPhotos, listHygiene, listAnxiety, anamnesisApi, plansApi, signedPhotoUrl
} from '../services/db.js'
import { STATUS_TR } from '../data/teeth.js'
import {
  Tooth, Calendar, FileText, Save, Phone, User, Bell,
  Camera, Clipboard, Drop, Sparkle, Video, ChevronRight, Alert, CheckCircle, Clock, TrendingUp, Check, Refresh
} from '../components/Icons.jsx'
import { Shield } from '../components/Icons.jsx'
import { reminderInfo } from './Portal.jsx'
import { saglikPuani } from '../ai/saglikSkoru.js'
import {
  PuanKarti, GunlukListe, BakimRehberi, AcilRehber,
  GecmisZamanCizelgesi, RandevuHazirligi, RandevuGorusmeKarti, AnamnezOzet
} from './PatientExtras.jsx'

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

/**
 * Hekimin anamnez kaydından hastaya gösterilecek uyarıları üretir.
 * Hasta veri GİRMEZ; yalnızca hekimin işaretlediği kritik durumları görür.
 */
function anamnezUyarilari(kayitlar) {
  const liste = []
  ;(kayitlar || []).forEach((k) => {
    const sistemik = Array.isArray(k.sistemik) ? k.sistemik : []
    const kritik = sistemik
      .map((s) => HASTALIKLAR.find((h) => h.id === s))
      .filter((h) => h?.riskli)
    if (kritik.length) {
      liste.push({
        baslik: kritik.map((h) => h.ad).join(', '),
        detay: 'Bu durum diş tedavinizi etkileyebilir. Tedavi öncesi hekiminize bildirin.'
      })
    }
    if (k.alerjiler?.trim()) {
      liste.push({
        baslik: `Alerji: ${k.alerjiler}`,
        detay: 'Tedavi sırasında kullanılacak ilaçlarda bu alerjiye dikkat edilmelidir.'
      })
    }
    if (k.gebelik_durumu === 'Hamile') {
      liste.push({
        baslik: 'Gebelik',
        detay: 'Gebelik döneminde röntgen ve bazı tedaviler ertelenebilir; hekiminize danışın.'
      })
    }
  })
  return liste
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
  const [simDis, setSimDis] = useState(16)
  const [appts, setAppts] = useState([])
  const [photos, setPhotos] = useState([])
  const [anamnesis, setAnamnesis] = useState([])
  const [hygiene, setHygiene] = useState([])
  const [anxiety, setAnxiety] = useState([])
  const [plans, setPlans] = useState([])
  const [info, setInfo] = useState({})
  const [foto, setFoto] = useState(null)
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [onay, setOnay] = useState(false)
  const [onayVerildi, setOnayVerildi] = useState(false)
  const [acilDurum, setAcilDurum] = useState(false)
  const [undoBackup, setUndoBackup] = useState(null)
  const [showUndo, setShowUndo] = useState(false)
  // Ön değerlendirme asistanı
  const [ogAcik, setOgAcik] = useState(false)
  const [ogBasladi, setOgBasladi] = useState(false)
  const [ogHekim, setOgHekim] = useState('')

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
      setFoto(p?.foto || null)
      setAcilDurum(!!(p && p.acil_durum))
      setLoading(false)
    })
  }, [pid])

  useEffect(() => {
    if (!pid) return
    const kayit = localStorage.getItem(`tedavi_onay_${pid}`)
    if (kayit === '1') setOnayVerildi(true)
  }, [pid])

  useEffect(() => { listAppointments().then(setAppts) }, [])

  /**
   * TRIGGER: Hekim kayıt talebini ONAYLADIĞINDA bir "kabul" bildirimi düşer.
   * Hasta panele ilk girdiğinde bu bildirim okunmamışsa ön değerlendirme
   * formu otomatik açılır. Hekimin adı mesajdan alınır.
   *
   * ÖNEMLİ: Hekim onayı gelmeden bu akış başlamaz; hasta giriş yapabiliyorsa
   * zaten onaylanmıştır (profil satırı ancak onayda oluşur).
   */
  useEffect(() => {
    let iptal = false
    if (!pid) return
    listBildirimler({ sadeceOkunmamis: true, limit: 20 }).then((liste) => {
      if (iptal) return
      const kabul = liste.find((b) => b.kind === 'kabul')
      if (!kabul) return
      // Hekim adını başlıktan çıkar: "… — Dr. X"
      const eslesme = String(kabul.title || '').match(/—\s*(.+)$/)
      setOgHekim(eslesme ? eslesme[1].trim() : '')
      // Zaten doldurulmuşsa tekrar açma
      if (onGorusmeTamamMi(pid)) return
      setOgAcik(true)
      setOgBasladi(true)
    })
    return () => { iptal = true }
  }, [pid])

  useEffect(() => {
    if (!pid) return
    listPhotos(pid).then(async (rows) => {
      const withUrls = await Promise.all(rows.map(async (r) => ({ ...r, url: r.path ? await signedPhotoUrl(r.path) : r.img || null })))
      setPhotos(withUrls)
    })
    anamnesisApi.list({ where: { patient_id: pid } }).then(setAnamnesis)
    listHygiene(pid).then(setHygiene)
    listAnxiety(pid).then(setAnxiety)
    plansApi.list({ where: { patient_id: pid }, order: 'created_at', asc: false }).then(setPlans)
  }, [pid])

  const sel = teeth[selected] || { status: 'saglam', doctorNote: 'Kayıt yok.' }
  const summary = useMemo(() => toothSummary(teeth), [teeth])

  // Diş sağlığı puanı — tüm verilerden hesaplanır
  const puan = useMemo(() => saglikPuani({
    teeth,
    plaque: hygiene[0]?.plaque,
    anxiety: anxiety[0]?.total,
    lastVisit: patient?.last_visit,
    birthDate: patient?.birth_date,
    pendingPhotos: photos.filter((f) => f.status !== 'degerlendirildi')
  }), [teeth, hygiene, anxiety, patient, photos])

  const bakimVerisi = useMemo(() => ({
    teeth,
    plaque: hygiene[0]?.plaque,
    anxiety: anxiety[0]?.total,
    lastVisit: patient?.last_visit
  }), [teeth, hygiene, anxiety, patient])
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
    // Yedekle: geri alma (undo) için mevcut veriyi sakla
    setUndoBackup({ ...patient })
    setShowUndo(true)
    const patch = {
      phone: info.phone, address: info.address, city: info.city, district: info.district,
      blood: info.blood, birth_date: info.birth_date, gender: info.gender,
      insurance: info.insurance, school: info.school, occupation: info.occupation,
      near_name: info.near_name, near_phone: info.near_phone, near_relation: info.near_relation,
      acil_durum: acilDurum ? true : false
    }
    Object.keys(patch).forEach((k) => { if (patch[k] === undefined || patch[k] === '') delete patch[k] })
    const r = await updatePatient(pid, patch)
    setMsg(r.error || 'Bilgileriniz kaydedildi.')
    setSaving(false)
    if (!r.error) {
      getPatient(pid).then((p) => { setPatient(p || null); setInfo(p || {}) })
      setTimeout(() => setShowUndo(false), 10000)
    }
  }

  const geriAl = () => {
    if (!undoBackup) return
    setPatient(undoBackup)
    setInfo(undoBackup)
    setAcilDurum(!!undoBackup.acil_durum)
    setShowUndo(false)
    setMsg('İşlem geri alındı. Eski bilgiler Geri yüklendi.')
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
  const critical = anamnezUyarilari(anamnesis)

  return (
    <div>
      {/* ---------- Tedavi Onamı (en üste, hasta başlamadan önce onay alınır) ---------- */}
      {!onayVerildi && (
        <>
          <div className="panel-hero"><h1><Shield size={22} /> Tedavi Onamı</h1></div>
          <div className="card warn-card">
            <h3><Alert size={18} /> Tedavi Onamı Gerekli</h3>
            <p className="muted">
              Muayene ve tedavi işlemlerine başlamadan önce lütfen onayınızı verin.
              Onay vermeden diğer işlemler (3B dişler, randevu, fotoğraf, görüşme vb.) görünmez.
            </p>
            <div style={{ margin: '16px 0' }}>
              <label style={{ display: 'flex', alignItems: 'start', gap: 10, fontSize: '15px', lineHeight: '1.6' }}>
                <input
                  type="checkbox"
                  checked={onay}
                  onChange={(e) => setOnay(e.target.checked)}
                  style={{ marginTop: '4px' }}
                />
                Tedavi onamını veriyorum. Sağlık bilgilerimi diş hekimimle paylaşmayı ve muayene sürecine katılmayı kabul ediyorum.
              </label>
            </div>
            <button
              disabled={!onay}
              onClick={() => {
                setOnayVerildi(true)
                localStorage.setItem(`tedavi_onay_${pid}`, '1')
              }}
              className="btn-new"
            >
              <Check size={15} /> Onay Ver ve Devam Et
            </button>
          </div>
        </>
      )}
      {/* ---------- Üst başlık ---------- */}
      <div className="panel-hero">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {foto && (
            <img src={foto} alt="Profil fotoğrafı" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '2px solid var(--line)' }} />
          )}
          <div>
            <h1><Tooth size={22} /> Merhaba, {patient.name}</h1>
            <p className="muted">Diş sağlığınızla ilgili tüm bilgileriniz burada.</p>
          </div>
        </div>
        <span className="spacer" />
        <Link to="/video"><button className="btn-new"><Video size={16} /> Hekimimle Görüş</button></Link>
      </div>

      {/* ---------- Ön değerlendirme (hekim onayı sonrası açılır) ---------- */}
      {ogAcik && (
        <OnGorusmeAnamnez
          pid={pid}
          hekimAdi={ogHekim}
          zorunlu={false}
          onBitti={() => { setOgAcik(false); setOgBasladi(true) }}
          onKapat={() => setOgAcik(false)}
        />
      )}

      {/* Tamamlanmamış ön değerlendirme varsa çağrı kartı gösterilir */}
      {!ogAcik && !onGorusmeTamamMi(pid) && (
        <div className="card">
          <h3><Clipboard size={18} /> Ön Değerlendirme Formu</h3>
          <p className="muted">
            Hekiminiz muayene öncesinde sizinle konuşmak istiyor. Birkaç kısa soruya
            yanıt verdiğinizde hekiminiz randevu ve tedavi planını daha doğru hazırlar.
          </p>
          <p className="og-disclaimer">
            <Shield size={13} /> Bu bir ön değerlendirmedir; tanı koymaz ve reçete yazmaz.
            Nihai kararı ve tedavi planını diş hekiminiz verir.
          </p>
          <button onClick={() => setOgAcik(true)}>
            <Clipboard size={15} /> Ön Değerlendirmeyi Doldur
          </button>
        </div>
      )}

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
        <Link to="/randevu" className="kpi kpi-btn">
          <b>{nextAppt ? String(nextAppt.appt_date).slice(5) : '—'}</b>
          <span>{nextAppt ? 'Sonraki Randevu' : 'Randevu İste'}</span>
        </Link>
        <div className={`kpi ${ri.left <= 0 ? 'warn' : ''}`}>
          <b>{ri.date ? String(ri.date).slice(5) : '—'}</b>
          <span>Önerilen Kontrol</span>
        </div>
        <div className="kpi"><b>{myAppts.length}</b><span>Toplam Randevu</span></div>
      </div>

      {/* ---------- Uyarılar (hekim anamnezinden) ---------- */}
      {critical.length > 0 && (
        <div className="card warn-card">
          <h3><Alert size={18} /> Dikkat: Bilmeniz Gerekenler</h3>
          {critical.map((c, i) => (
            <p key={i}><b>{c.baslik}</b> {c.detay}</p>
          ))}
          <p className="muted">Bu bilgiler hekiminiz tarafından kaydedildi. Tedavi öncesi mutlaka bildirin.</p>
        </div>
      )}

      {/* ---------- Diş sağlığı puanı ---------- */}
      <Card
        icon={Sparkle}
        title="Diş Sağlığı Puanım"
        desc="Diş durumunuz, ağız hijyeniniz, kaygı düzeyiniz ve kontrol düzeninizden hesaplanır."
      >
        <PuanKarti puan={puan} />
      </Card>

      {/* ---------- Günlük ağız bakımı ---------- */}
      <Card
        icon={CheckCircle}
        title="Bugünkü Ağız Bakımım"
        desc="Dört basit adım. İşaretleriniz her gün sıfırlanır."
      >
        <GunlukListe pid={pid} />
      </Card>

      {/* ---------- 3B dişlerim ---------- */}
      <Card
        icon={Tooth}
        title="Dişlerim — 3B Görünüm"
        desc="Dişlerinizi döndürerek inceleyin, üzerine gelerek o dişin durumunu ve bilgisini görün."
      >
        <div className="tooth-summary">
          {Object.entries(summary).map(([s, n]) => (
            <span className="badge" key={s}>{STATUS_TR[s] || s}: {n}</span>
          ))}
          {Object.keys(summary).length === 0 && <span className="muted">Henüz diş kaydı yok.</span>}
        </div>

        <ToothChart
          teeth={teeth}
          selected={selected}
          onSelect={setSelected}
        />

        {/* Seçili dişin ayrıntısı — dokunmatik cihazlar için de erişilebilir */}
        <div className="tooth-detail">
          <ToothVisual no={selected} status={sel?.status || 'saglam'} />
        </div>
      </Card>

      {/* ---------- Diş rehberi ---------- */}
      <Card icon={Sparkle} title="Dişlerim Hakkında" desc="Dişlerinizin görevleri ve günlük bakımı.">
        <div className="dis-rehber">
          {['kesici', 'kanin', 'kucukAzi', 'buyukAzi'].map((t) => {
            const b = disBilgisi(t === 'kesici' ? 11 : t === 'kanin' ? 13 : t === 'kucukAzi' ? 14 : 16)
            return (
              <div className="dis-rehber-kart" key={t}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0b3d5f', minWidth: 48, textAlign: 'center' }}>
                  {b.no}
                </div>
                <div>
                  <b>{b.tip.ad}</b>
                  <p className="muted">{b.tip.egitim}</p>
                  <p className="muted"><Clock size={12} /> {b.tip.bakim}</p>
                </div>
              </div>
            )
          })}
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

      {/* Fotoğraf gönderme kısmı kaldırıldı — sadece hekim vesikalık/fotoğraf ekleyebilir */}
      {/* ---------- Tedavi Planım ---------- */}
      {plans.length > 0 && (
        <Card
          icon={Clipboard}
          title="Tedavi Planım"
          desc="Hekiminizin oluşturduğu tedavi planı; yapılan işlemler ve durumları."
        >
          <TedaviOzet planlar={plans} />
        </Card>
      )}

      {/* ---------- Anamnez (hekim doldurur, hasta okur) ---------- */}
      {anamnesis.length > 0 && (
        <Card
          icon={Clipboard}
          title="Sağlık Geçmişim (Anamnez)"
          desc="Bu bilgiler muayeneniz sırasında hekiminiz tarafından dolduruldu."
        >
          <AnamnezOzet kayitlar={anamnesis} />
        </Card>
      )}

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
            <b><Clock size={15} /> Son Kontrol</b>
            <p>{patient.last_visit || 'Kayıt yok'}</p>
          </div>
        </div>
        <div className="record-actions">
          <Link to="/video"><button className="ghost"><Video size={16} /> Hekimimle Görüş</button></Link>
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

        {/* ---------- Acil Durum İşareti ---------- */}
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <label style={{ display: 'flex', alignItems: 'start', gap: 10, fontSize: '15px', lineHeight: '1.6' }}>
            <input
              type="checkbox"
              checked={acilDurum}
              onChange={(e) => setAcilDurum(e.target.checked)}
              style={{ marginTop: '4px' }}
            />
            <strong>Acil durum işareti:</strong> Bu işaretleme hekime acil durum bildirimi gönderir.
          </label>
          {acilDurum && (
            <button
              onClick={() => {
                bildirimOlustur?.({
                  tur: 'acil',
                  title: `Acil Durum — ${patient?.name}`,
                  body: 'Hasta acil durum işaretini aktif etti. Derhal hekimle iletişime geçin.',
                  hastaId: pid
                })
                setMsg('Hekime acil durum bildirimi gönderildi.')
              }}
              className="btn-new"
              disabled={!pid}
            >
              <Alert size={15} /> Hekime Bildir
            </button>
          )}
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={saveInfo} disabled={saving}>
            <Save size={15} /> {saving ? 'Kaydediliyor...' : 'Bilgilerimi Kaydet'}
          </button>
          {showUndo && (
            <button onClick={geriAl} className="ghost" style={{ color: '#b91c1c' }}>
              <Refresh size={15} /> Geri Al
            </button>
          )}
        </div>
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

      {/* ---------- Ağız bakımı rehberi ---------- */}
      <Card icon={Drop} title="Ağız Bakımı Rehberim" desc="Diş kayıtlarınıza göre size özel öneriler.">
        <BakimRehberi veri={bakimVerisi} />
      </Card>

      {/* ---------- Sağlık geçmişi ---------- */}
      <Card
        icon={Clock}
        title="Sağlık Geçmişim"
        desc="Muayeneleriniz, gönderdiğiniz fotoğraflar ve diş kayıtlarınız kronolojik sırada."
      >
        <GecmisZamanCizelgesi appts={myAppts} photos={photos} teeth={teeth} />
      </Card>

      {/* ---------- Randevu hazırlığı ---------- */}
      <Card icon={Calendar} title="Randevu Hazırlığı" desc="Kliniğe giderken yanınıza almanız gerekenler.">
        <RandevuHazirligi randevu={nextAppt} yas={puan.yas} />
      </Card>

      {/* ---------- Randevu ve görüşme (hasta panelinin ana eylemi) ---------- */}
      <Card
        icon={Calendar}
        title="Randevu Al veya Hekiminizle Görüşün"
        desc="Klinik verilerinizi hekiminiz doldurur; siz randevu ve görüşme için iki adımdasınız."
      >
        <RandevuGorusmeKarti sonrakiRandevu={nextAppt} />
      </Card>

      {/* ---------- Bilgi videoları ve içerikler ---------- */}
      <Card icon={Video} title="Bilgi Videoları ve İçerikler" desc="Diş sağlığı hakkında eğitici videolar ve bilgiler.">
        <div className="video-liste">
          <div className="video-kart">
            <h4>Diş Fırçalama Nasıl Yapılır?</h4>
            <p className="muted">Doğru diş fırçalama tekniği ve süresi hakkında bilgi.</p>
            <iframe
              width="100%"
              height="200"
              src="https://www.youtube.com/embed/placeholder1"
              title="Diş Fırçalama"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ borderRadius: 8, marginBottom: 8 }}
            />
            <ul className="muted small">
              <li>Günde en az 2 kez, 2 dakika fırçalayın</li>
              <li>Florürlü diş macunu kullanın</li>
              <li>Fırçayı 45 derece açıyla tutun</li>
              <li>Dilinizi de fırçalayın</li>
            </ul>
          </div>
          <div className="video-kart">
            <h4>Diş Tali (Floss) Nasıl Kullanılır?</h4>
            <p className="muted">Diş aralarını temizlemek için diş tali kullanımı.</p>
            <iframe
              width="100%"
              height="200"
              src="https://www.youtube.com/embed/placeholder2"
              title="Diş Tali Kullanımı"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ borderRadius: 8, marginBottom: 8 }}
            />
            <ul className="muted small">
              <li>Günde en az 1 kez diş tali kullanın</li>
              <li>Diş teli dişlerin arasına nazikçe yerleştirin</li>
              <li>C şekli vererek diş eti çizgisini takip edin</li>
              <li>Her diş için temiz bir bölüm kullanın</li>
            </ul>
          </div>
          <div className="video-kart">
            <h4>Çocuklar İçin Diş Sağlığı</h4>
            <p className="muted">Çocuklarda diş bakım alışkanlıkları ve önleme.</p>
            <ul className="muted small">
              <li>İlk diş çıktıktan sonra fırçalamaya başlayın</li>
              <li>Florürlü diş macunu kullanın (bezelye tanesi kadar)</li>
              <li>Şekerli atıştırmalıkları sınırlayın</li>
              <li>6 ayda bir diş hekimi kontrolü yapın</li>
              <li>Gece yatmadan önce şekerli gıda tüketmeyin</li>
            </ul>
          </div>
          <div className="video-kart">
            <h4>Sağlıksız Atıştırmalıklar ve Diş Sağlığı</h4>
            <p className="muted">Abur cubur ve şekerli gıdaların dişlere etkisi.</p>
            <ul className="muted small">
              <li>Şekerli içecekler diş çürüğü riskini artırır</li>
              <li>Yapışkan şekerler diş yüzeyine yapışarak çürük yapar</li>
              <li>Atıştırmalık olarak meyve, sebze, peynir tercih edin</li>
              <li>Gece yatmadan önce şekerli gıda tüketmeyin</li>
              <li>Atıştırmalık sonrası su için veya diş fırçalayın</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* ---------- Acil durum rehberi ---------- */}
      <Card
        icon={Alert}
        title="Acil Durum Rehberi"
        desc="Ağrı, kanama, kırık gibi durumlarda ilk yapmanız gerekenler."
        action={<span className="badge warn">6 bölüm</span>}
      >
        <AcilRehber />
      </Card>

      {/* ---------- Yardım ---------- */}
      <Card icon={FileText} title="Yardım ve Bilgilendirme">
        <div className="help-links">
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

/** Hekimin oluşturduğu tedavi planının hasta görünümü (PatientPanel'de kullanılır). */
function TedaviOzet({ planlar = [] }) {
  const satirlar = [...(planlar || [])].sort((a, b) =>
    String(b.created_at || b.date || '').localeCompare(String(a.created_at || a.date || ''))
  )
  if (!satirlar.length) return <p className="muted">Henüz tedavi planı kaydı yok.</p>
  return (
    <div className="plan-liste">
      {satirlar.map((p, i) => (
        <div className="appt-row" key={p.id || i}>
          <div>
            <strong>{p.islem_adi || p.islem || p.tedavi || 'İşlem belirtilmemiş'}</strong>
            <p className="muted">
              {p.seans ? `${p.seans} seans` : ''}
              {p.status ? ` · Durum: ${p.status}` : ''}
              {(p.date || p.created_at) ? ` · ${String(p.date || p.created_at).slice(0, 10)}` : ''}
            </p>
            {p.note && <p className="muted">{p.note}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
