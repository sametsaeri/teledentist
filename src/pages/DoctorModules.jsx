// Hekim paneli — klinik sistem modülleri
// Her modül tam çalışır: listeleme, ekleme, güncelleme, silme.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSession } from '../services/store.js'
import {
  anamnesisApi, plansApi, notesApi, eventsApi, listPatients
} from '../services/db.js'
import { ISLEMLER } from '../ai/prognos.js'
import { kontrolAraligi } from '../data/disAdlari.js'
import {
  Alert, Plus, Check, X, Clock, Clipboard, User, Flask,
  Camera, TrendingUp, Wrench, Calendar, Save, Users, Tooth, Notebook
} from '../components/Icons.jsx'

/* ------------------------------------------------------------------ */
/* Ortak: kayıt satırı eylem çubuğu                                     */
/* ------------------------------------------------------------------ */
function RowActions({ onEdit, onDelete, onSave, editing, msg }) {
  return (
    <span className="row-actions">
      {editing
        ? <button className="ghost tiny" onClick={onSave}><Check size={13} /> Kaydet</button>
        : onEdit && <button className="ghost tiny" onClick={onEdit}><Wrench size={13} /> Düzenle</button>}
      {onDelete && <button className="ghost tiny danger" onClick={onDelete}><X size={13} /> Sil</button>}
      {msg && <span className="muted"> {msg}</span>}
    </span>
  )
}

const KIND_TR = { gorev: 'Görev', etkinlik: 'Etkinlik', toplanti: 'Toplantı', izin: 'İzin', egitim: 'Eğitim' }

/* ================================================================== */
/* 7) HEKİM KİŞİSEL TAKVİMİ (etkinlik / görev)                         */
/* ================================================================== */
export function DoctorSchedule() {
  const me = getSession()
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState('')
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState({
    title: '', kind: 'gorev', event_date: new Date().toISOString().slice(0, 10),
    event_time: '09:00', duration_min: 30, note: ''
  })

  const load = () => eventsApi.list({ order: 'event_date', asc: true }).then(setRows)
  useEffect(() => { load() }, [])

  const mine = rows.filter((r) => !me?.id || !r.doctor_id || r.doctor_id === me.id)

  const add = async () => {
    setMsg('')
    if (!form.title.trim()) return setMsg('Etkinlik başlığı zorunlu.')
    if (!form.event_date) return setMsg('Tarih seçin.')
    const r = await eventsApi.insert({ ...form, doctor_id: me?.id || null })
    setMsg(r.error || `${form.title} takvime eklendi.`)
    setForm({ ...form, title: '', note: '' })
    load()
  }

  const toggle = async (row) => {
    const r = await eventsApi.update(row.id, { done: !row.done })
    setMsg(r.error || (row.done ? 'Görev tekrar açıldı.' : 'Görev tamamlandı.'))
    load()
  }

  const save = async () => {
    const r = await eventsApi.update(edit.id, { ...edit, duration_min: Number(edit.duration_min) || 30 })
    setMsg(r.error || 'Etkinlik güncellendi.')
    setEdit(null)
    load()
  }

  const del = async (id) => {
    const r = await eventsApi.remove(id)
    setMsg(r.error || 'Etkinlik silindi.')
    load()
  }

  const today = new Date().toISOString().slice(0, 10)
  const todayList = mine.filter((r) => r.event_date === today)
  const upcoming = mine.filter((r) => r.event_date > today).slice(0, 8)
  const past = mine.filter((r) => r.event_date < today).slice(0, 5)
  const openTasks = mine.filter((r) => !r.done).length

  const row = (r) => (
    <div className={`appt-row ${r.done ? 'done-row' : ''}`} key={r.id}>
      <div>
        <span className="badge">{KIND_TR[r.kind] || r.kind}</span>
        <span className="time-chip">{r.event_time || '—'}</span>
        <strong>{r.title}</strong>
        <p className="muted">{r.event_date} · {r.duration_min} dk{r.note ? ` · ${r.note}` : ''}</p>
      </div>
      <span className="row-actions">
        <button className="ghost tiny" onClick={() => toggle(r)}>
          <Check size={13} /> {r.done ? 'Geri al' : 'Tamamlandı'}
        </button>
        <button className="ghost tiny" onClick={() => setEdit({ ...r })}><Wrench size={13} /> Düzenle</button>
        <button className="ghost tiny danger" onClick={() => del(r.id)}><X size={13} /> Sil</button>
      </span>
    </div>
  )

  return (
    <div className="card">
      <div className="card-head">
        <h3><Calendar size={18} /> Kişisel Takvimim</h3>
        <span className="badge">{openTasks} açık görev</span>
      </div>
      <p className="muted">
        Randevulardan bağımsız kendi etkinlik ve görevlerinizi yazabilirsiniz. Bu liste yalnızca size özeldir.
      </p>

      <div className="grid form-grid">
        <label>Başlık *<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="örn: Muhalebe toplantısı" /></label>
        <label>Tür
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            {Object.entries(KIND_TR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Tarih<input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} /></label>
        <label>Saat<input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} /></label>
        <label>Süre (dk)<input type="number" min="5" step="5" value={form.duration_min} onChange={(e) => setForm({ ...form, duration_min: e.target.value })} /></label>
        <label>Not<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
      </div>
      <button onClick={add}><Plus size={15} /> Takvime Ekle</button>

      <h4 className="modal-sub">Bugün ({today})</h4>
      {todayList.length === 0 && <p className="muted">Bugün için kişisel etkinliğiniz yok.</p>}
      {todayList.map(row)}

      {upcoming.length > 0 && <><h4 className="modal-sub">Yaklaşanlar</h4>{upcoming.map(row)}</>}
      {past.length > 0 && <><h4 className="modal-sub">Geçmiş</h4>{past.map(row)}</>}

      {edit && (
        <div className="card edit-panel">
          <h4>Düzenle: {edit.title}</h4>
          <div className="grid form-grid">
            <label>Başlık<input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
            <label>Tür
              <select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>
                {Object.entries(KIND_TR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label>Tarih<input type="date" value={edit.event_date || ''} onChange={(e) => setEdit({ ...edit, event_date: e.target.value })} /></label>
            <label>Saat<input type="time" value={edit.event_time || ''} onChange={(e) => setEdit({ ...edit, event_time: e.target.value })} /></label>
            <label>Süre (dk)<input type="number" value={edit.duration_min} onChange={(e) => setEdit({ ...edit, duration_min: e.target.value })} /></label>
            <label>Not<input value={edit.note || ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></label>
          </div>
          <button onClick={save}><Save size={15} /> Değişiklikleri Kaydet</button>
        </div>
      )}
      {msg && <p className="muted">{msg}</p>}
    </div>
  )
}

/* ================================================================== */
/* 0) DEMO VERİ YÜKLEYİCİ                                              */
/* Modüller boş görünmesin diye örnek klinik verisi yükler.            */
/* ================================================================== */
export function DemoSeeder({ onDone }) {
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const seed = async () => {
    setBusy(true); setMsg('Yükleniyor...')
    const pid = getSession()?.id || 'demo'
    const ev = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)

    const notes = [
      { patient_id: pid, kind: 'not', body: '16 nolu dişte derin çürük, kanal tedavisi planlandı. Geçici dolgu yapıldı.' },
      { patient_id: pid, kind: 'rapor', body: 'Dijital muayene: plak indeksi 1.8, ağız hijyeni orta düzey.' }
    ]
    for (const n of notes) await notesApi.insert(n)

    setBusy(false)
    setMsg('Demo veri yüklendi: 2 klinik notu.')
    onDone()
  }

  return (
    <div className="card">
      <div className="card-head">
        <h3><Flask size={18} /> Demo Verisi</h3>
        <button className="ghost" onClick={seed} disabled={busy}>
          {busy ? 'Yükleniyor...' : 'Örnek Veri Yükle'}
        </button>
      </div>
      <p className="muted">
        Modülleri denemek için örnek klinik verisi ekler: malzeme stoğu, fiyat listesi,
        laboratuvar takibi ve klinik günlük kayıtları.
      </p>
      {msg && <p className="muted">{msg}</p>}
    </div>
  )
}

/* ================================================================== */
/* 1) GÜNLÜK AKIŞ                                                      */
/* ================================================================== */
export function DailyFlow({ appts, patients, onComplete }) {
  const today = new Date().toISOString().slice(0, 10)
  const todays = useMemo(
    () => appts.filter((a) => a.appt_date === today && a.status !== 'tamamlandı')
      .sort((a, b) => String(a.appt_time || '').localeCompare(String(b.appt_time || ''))),
    [appts, today]
  )
  const nameOf = (n) => patients.find((p) => (p.name || '').toLowerCase() === String(n || '').toLowerCase())
  const done = appts.filter((a) => a.appt_date === today && a.status === 'tamamlandı').length

  return (
    <div className="card">
      <div className="card-head">
        <h3><Clock size={18} /> Bugünün Akışı</h3>
        <span className="badge">{todays.length} randevu</span>
      </div>

      <div className="kpi-row compact">
        <div className="kpi"><b>{todays.length}</b><span>Bekleyen</span></div>
        <div className="kpi ok"><b>{done}</b><span>Tamamlanan</span></div>
        <div className="kpi"><b>{appts.filter((a) => a.status === 'yeni').length}</b><span>Onay Bekleyen Talep</span></div>
      </div>

      {todays.length === 0 && <p className="muted">Bugün için randevu yok.</p>}
      {todays.map((a) => {
        const p = nameOf(a.name)
        return (
          <div className="appt-row" key={a.id}>
            <div>
              <span className="time-chip">{a.appt_time || '—'}</span>
              <strong>{a.name}</strong> <span className="muted">({a.contact})</span>
              <p className="muted"><Tooth size={13} /> {a.complaint}</p>
              {a.is_online && <span className="badge online">Online görüşme</span>}
            </div>
            <div className="toolbar">
              {p && <Link to={`/hekim/hasta/${p.id}`}><button className="ghost">Hastayı Aç</button></Link>}
              <button onClick={() => onComplete(a.id)}><Check size={15} /> Tamamlandı</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ================================================================== */
/* 2) TEDAVİ SÜRELERİ — planlama aracı (ÜCRET YOK)                     */
/* ------------------------------------------------------------------ */
/* NEDEN ÜCRET YOK: Bu proje devlet projesidir. Devlet tarafından          */
/* belirlenmiş bir fiyat/ücret listesi YOKTUR. Önceden burada fiyat        */
/* listesi ve hasta bakiyesi tutuluyordu; bu hem yanıltıcıydı hem de      */
/* projeye uygun değildi. Yerine klinik olarak anlamlı ve mevzuata uygun   */
/* olan SEANS ve SÜRE takibi kondu: hekim planlama yapar, hasta öder       */
/* değil.                                                                  */
/* ================================================================== */
export function TedaviSureleri({ patients, plans = [] }) {
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')

  // Tedavi planındaki kayıtlardan gerçek süre toplamı
  const planSatirlari = useMemo(() => {
    const islemler = new Map()
    plans.forEach((p) => {
      const kod = p.islem || p.tedavi || 'muayene'
      const islem = ISLEMLER[kod]
      const ad = islem?.ad || p.islem_adi || p.tedavi || 'Belirtilmemiş işlem'
      const seans = Number(p.seans || islem?.seans || 1)
      const mevcut = islemler.get(ad) || {
        ad, seans: 0, hastaSayisi: 0, durum: p.status || 'devam',
        dakika: islem ? sureDakika(islem.sure) : 35
      }
      mevcut.seans += seans
      mevcut.hastaSayisi += 1
      mevcut.durum = p.status || mevcut.durum
      islemler.set(ad, mevcut)
    })
    return [...islemler.values()].sort((a, b) => b.seans - a.seans)
  }, [plans])

  const toplamSeans = planSatirlari.reduce((t, r) => t + r.seans, 0)
  const devamEden = plans.filter((p) => p.status === 'devam').length
  const tamamlanan = plans.filter((p) => p.status === 'tamam').length
  const tamamlanmaOrani = plans.length ? Math.round((tamamlanan / plans.length) * 100) : 0

  // Tedavi başına ortalama süre (dakika)
  const ortalamaDk = planSatirlari.length
    ? Math.round(planSatirlari.reduce((t, r) => t + r.dakika, 0) / planSatirlari.length)
    : 35

  const ql = q.toLowerCase()
  const isimListesi = patients.filter((u) =>
    !ql || (u.name || '').toLowerCase().includes(ql) || (u.phone || '').includes(ql)
  )

  return (
    <div>
      <div className="kurulum-notu">
        <Clock size={15} />
        <p>
          Bu proje <b>devlet projesidir</b> ve devlet tarafından belirlenmiş bir ücret listesi
          bulunmamaktadır. Bu ekran ücret göstermez; yalnızca tedavi planlaması için
          <b> gerekli seans sayısını ve süreyi</b> takip eder.
        </p>
      </div>

      <div className="kpi-row compact">
        <div className="kpi"><b>{plans.length}</b><span>Tedavi Planı</span></div>
        <div className="kpi"><b>{toplamSeans}</b><span>Toplam Seans</span></div>
        <div className="kpi"><b>{devamEden}</b><span>Devam Eden</span></div>
        <div className={`kpi ${tamamlanmaOrani < 50 && plans.length > 0 ? 'warn' : ''}`}>
          <b>%{tamamlanmaOrani}</b><span>Tamamlanma</span>
        </div>
      </div>

      <div className="card">
        <h3><Clock size={18} /> Standart İşlem Süreleri</h3>
        <p className="muted">
          Her işlem için ortalama seans sayısı ve süre. Planlama yaparken referans olur;
          hastanın durumuna göre değişebilir.
        </p>
        <div className="sure-tablosu">
          <table>
            <thead>
              <tr><th>İşlem</th><th>Seans</th><th>Tahmini Süre</th></tr>
            </thead>
            <tbody>
              {Object.entries(ISLEMLER).map(([kod, i]) => (
                <tr key={kod}>
                  <td>{i.ad}</td>
                  <td><b>{i.seans}</b></td>
                  <td className="muted">{i.sure}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          Ortalama işlem süresi: <b>{ortalamaDk} dakika</b>. Bir güne planlanabilecek
          muayene sayısı buna göre belirlenir.
        </p>
      </div>

      <div className="card">
        <h3><Clipboard size={18} /> Tedavi Planı Özeti ({planSatirlari.length})</h3>
        {planSatirlari.length === 0 ? (
          <p className="muted">
            Henüz tedavi planı kaydı yok. Hasta detay sayfasından plan oluşturduğunuzda
            burada toplam seans ve süre görünür.
          </p>
        ) : (
          <div className="sure-liste">
            {planSatirlari.map((r) => (
              <div className="appt-row" key={r.ad}>
                <div>
                  <strong>{r.ad}</strong>
                  <p className="muted">
                    {r.hastaSayisi} hasta · toplam <b>{r.seans} seans</b> · durum: {r.durum}
                  </p>
                </div>
                <span className="badge">{r.durum}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h3><Users size={18} /> Hasta Bazında Kontrol</h3>
          <input placeholder="Hasta ara..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <p className="muted">
          Hastanın önerilen kontrol aralığı ve son muayenesi. Randevu planlamasında
          zamanlama kararını buradan verirsiniz.
        </p>
        {isimListesi.length === 0 && <p className="muted">Kayıtlı hasta yok.</p>}
        {isimListesi.slice(0, 20).map((p) => {
          const son = p.last_visit || p.lastVisit
          const kontrol = kontrolAraligi(p.treatment_type || 'kontrol')
          return (
            <div className="appt-row" key={p.id}>
              <div>
                <strong>{p.name}</strong> <span className="muted">{p.phone || 'telefon yok'}</span>
                <p className="muted">
                  Son muayene: {son || 'kayıt yok'} · Önerilen aralık: {kontrol.metin}
                </p>
              </div>
              <Link to={`/hekim/hasta/${p.id}`}><button className="ghost">Hastayı Aç</button></Link>
            </div>
          )
        })}
        {msg && <p className="muted">{msg}</p>}
      </div>
    </div>
  )
}

/** "2–3 seans" / "30–45 dk" gibi metinden üst sınırı dakikaya çevirir. */
function sureDakika(metin, varsayilan = 35) {
  const rakamlar = String(metin || '').match(/\d+/g)
  if (!rakamlar) return varsayilan
  const son = Number(rakamlar[rakamlar.length - 1])
  return String(metin).includes('seans') ? son * 30 : son
}

/* ================================================================== */
/* 5) KLINIK GÜNLÜK (tüm hastaların notları)                            */
/* ================================================================== */
export function ClinicJournal({ patients }) {
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')
  const [form, setForm] = useState({ patient_id: '', kind: 'not', body: '' })

  const load = () => notesApi.list().then(setRows)
  useEffect(() => { load() }, [])

  const add = async () => {
    const p = patients.find((x) => x.id === form.patient_id)
    if (!p) return setMsg('Hasta seçin.')
    if (!form.body.trim()) return setMsg('Not metni zorunlu.')
    const r = await notesApi.insert({
      patient_id: p.id, doctor_id: getSession()?.id || null,
      kind: form.kind, body: form.body
    })
    setMsg(r.error || 'Not kaydedildi.')
    setForm({ patient_id: '', kind: 'not', body: '' })
    load()
  }
  const del = async (id) => { const r = await notesApi.remove(id); setMsg(r.error || 'Not silindi.'); load() }

  const ql = q.toLowerCase()
  const list = rows.filter((r) => !ql || String(r.body).toLowerCase().includes(ql) || String(r.patient_name || '').toLowerCase().includes(ql))

  return (
    <div>
      <div className="card">
        <div className="card-head"><h3><Notebook size={18} /> Yeni Klinik Notu</h3></div>
        <div className="grid form-grid">
          <label>Hasta
            <select value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}>
              <option value="">— seçin —</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>Tür
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              <option value="not">Klinik not</option>
              <option value="rapor">Rapor</option>
              <option value="sevk">Sevk</option>
              <option value="konsultasyon">Konsültasyon</option>
            </select>
          </label>
        </div>
        <label>Not<textarea rows="3" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
        <button onClick={add}><Plus size={15} /> Notu Kaydet</button>
      </div>

      <div className="card">
        <div className="card-head">
          <h3><Notebook size={18} /> Klinik Günlüğü ({rows.length})</h3>
          <input placeholder="Notlarda ara..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {list.length === 0 && <p className="muted">Kayıt yok.</p>}
        {list.map((r) => (
          <div className="appt-row" key={r.id}>
            <div>
              <span className="badge">{r.kind}</span>
              <strong>{r.patient_name || '—'}</strong>
              <p className="muted">{String(r.created_at || '').slice(0, 16)}</p>
              <p>{r.body}</p>
            </div>
            <div className="toolbar">
              {r.patient_id && <Link to={`/hekim/hasta/${r.patient_id}`}><button className="ghost">Hastayı Aç</button></Link>}
              <button className="ghost tiny danger" onClick={() => del(r.id)}><X size={13} /> Sil</button>
            </div>
          </div>
        ))}
        {msg && <p className="muted">{msg}</p>}
      </div>
    </div>
  )
}

/* ================================================================== */
/* 6) MODÜL İSTATİSTİKLERİ                                             */
/* ================================================================== */
export function ClinicStats({ patients, appts, plans, photos = [] }) {
  const today = new Date().toISOString().slice(0, 10)
  const month = today.slice(0, 7)
  const inMonth = appts.filter((a) => String(a.created_at || '').slice(0, 7) === month)
  const pendingPhotos = photos.filter((p) => p.status !== 'degerlendirildi').length
  const devamEden = plans.filter((p) => p.status === 'devam').length
  const tamamlanan = plans.filter((p) => p.status === 'tamam').length

  const cards = [
    { Icon: User, n: patients.length, l: 'Kayıtlı hasta', to: '?tab=hastalar' },
    { Icon: Calendar, n: inMonth.length, l: 'Bu ay randevu talebi', to: '?tab=randevu' },
    { Icon: Clipboard, n: devamEden, l: 'Devam eden tedavi', to: '?tab=hastalar' },
    { Icon: Clock, n: tamamlanan, l: 'Tamamlanan tedavi', to: '?tab=sure' },
    { Icon: Camera, n: pendingPhotos, l: 'Değerlendirilmeyen fotoğraf', to: '?tab=foto' },
    { Icon: TrendingUp, n: appts.filter((a) => a.status === 'tamamlandı').length, l: 'Tamamlanan randevu', to: '?tab=takvim' }
  ]

  return (
    <div className="module-grid">
      {cards.map((c, i) => (
        <Link key={c.l} to={'/hekim' + c.to} className="module-card" style={{ animationDelay: `${i * 55}ms` }}>
          <c.Icon size={22} />
          <b>{c.n}</b>
          <span>{c.l}</span>
        </Link>
      ))}
    </div>
  )
}
