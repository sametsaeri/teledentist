// Hekim paneli — klinik sistem modülleri
// Her modül tam çalışır: listeleme, ekleme, güncelleme, silme.
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSession } from '../services/store.js'
import {
  anamnesisApi, plansApi, materialsApi, labApi, pricesApi, invoicesApi, notesApi, eventsApi, listPatients
} from '../services/db.js'
import {
  Alert, Plus, Check, X, Clock, Clipboard, User, Box, Flask, Tag,
  Receipt, Notebook, Tooth, Camera, TrendingUp, Package, Wrench, Calendar, Save
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

    const mats = [
      { name: 'Latex Eldiven M', category: 'sarf', unit: 'kutu', quantity: 12, min_quantity: 20 },
      { name: 'Lokal anestezik (lidokain)', category: 'anestezi', unit: 'adet', quantity: 40, min_quantity: 15 },
      { name: 'Kompozit dolgu seti', category: 'dolgu', unit: 'paket', quantity: 6, min_quantity: 10 },
      { name: 'Kanal eğesi 25 numara', category: 'endodonti', unit: 'adet', quantity: 18, min_quantity: 5 },
      { name: 'Protez akrili tozu', category: 'protez', unit: 'gram', quantity: 800, min_quantity: 500, expiry: ev(-20) },
      { name: 'Cerrahi maske tip 2', category: 'sarf', unit: 'adet', quantity: 200, min_quantity: 100 },
      { name: 'İmplant titanyum vida', category: 'cerrahi', unit: 'adet', quantity: 3, min_quantity: 5, expiry: ev(45) }
    ]
    for (const m of mats) await materialsApi.insert(m)

    const prices = [
      { code: 'F03', name: 'İmplant üstü protez', category: 'protez', price: 18500 },
      { code: 'K03', name: 'Kanal tedavisi yeniden', category: 'endodonti', price: 5200 },
      { code: 'T03', name: 'Air flow temizlik', category: 'temizlik', price: 1600 }
    ]
    for (const p of prices) await pricesApi.insert(p)

    const labCases = [
      { patient_id: null, patient_name: 'Demo Hasta', kind: 'zirkonyum', lab: 'Anadolu Diş Lab.', sent_at: ev(-12), due_at: ev(-2), status: 'laboratuvarda', note: 'Üst sol 16 nolu diş zirkonyum kaplama' },
      { patient_id: null, patient_name: 'Demo Hasta', kind: 'protez', lab: 'Anadolu Diş Lab.', sent_at: ev(-40), due_at: ev(-12), status: 'geldi', note: 'Alt çene bütün protez' }
    ]
    for (const l of labCases) await labApi.insert(l)

    const notes = [
      { patient_id: pid, kind: 'not', body: '16 nolu dişte derin çürük, kanal tedavisi planlandı. Geçici dolgu yapıldı.' },
      { patient_id: pid, kind: 'rapor', body: 'Dijital muayene: plak indeksi 1.8, ağız hijyeni orta düzey.' }
    ]
    for (const n of notes) await notesApi.insert(n)

    setBusy(false)
    setMsg('Demo veri yüklendi: 7 malzeme, 3 fiyat, 2 laboratuvar kaydı, 2 klinik notu.')
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
/* 2) ENVANTER (malzeme + son kullanma uyarısı)                         */
/* ================================================================== */
export function Inventory() {
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState('')
  const [edit, setEdit] = useState(null)
  const [form, setForm] = useState({ name: '', category: 'sarf', unit: 'adet', quantity: 0, min_quantity: 5, expiry: '' })
  const [q, setQ] = useState('')

  const load = () => materialsApi.list({ order: 'name', asc: true }).then(setRows)
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!form.name.trim()) return setMsg('Malzeme adı zorunlu.')
    const r = await materialsApi.insert({ ...form, quantity: Number(form.quantity) || 0, min_quantity: Number(form.min_quantity) || 0, expiry: form.expiry || null })
    setMsg(r.error || `${form.name} envantere eklendi.`)
    setForm({ name: '', category: 'sarf', unit: 'adet', quantity: 0, min_quantity: 5, expiry: '' })
    load()
  }

  const save = async () => {
    const r = await materialsApi.update(edit.id, { ...edit, quantity: Number(edit.quantity) || 0, min_quantity: Number(edit.min_quantity) || 0 })
    setMsg(r.error || 'Güncellendi.')
    setEdit(null)
    load()
  }

  const del = async (id) => {
    const r = await materialsApi.remove(id)
    setMsg(r.error || 'Kayıt silindi.')
    load()
  }

  const ql = q.toLowerCase()
  const list = rows.filter((r) => !ql || String(r.name).toLowerCase().includes(ql) || String(r.category).toLowerCase().includes(ql))
  const today = new Date().toISOString().slice(0, 10)
  const soon = (d) => d && d <= new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)
  const lowCount = rows.filter((r) => Number(r.quantity) <= Number(r.min_quantity)).length
  const expCount = rows.filter((r) => soon(r.expiry)).length

  return (
    <div>
      <div className="kpi-row compact">
        <div className="kpi"><b>{rows.length}</b><span>Kalem</span></div>
        <div className={`kpi ${lowCount ? 'warn' : ''}`}><b>{lowCount}</b><span>Kritik Stok</span></div>
        <div className={`kpi ${expCount ? 'warn' : ''}`}><b>{expCount}</b><span>Süresi Yaklaşan</span></div>
      </div>

      <div className="card">
        <div className="card-head"><h3><Package size={18} /> Yeni Malzeme</h3></div>
        <div className="grid form-grid">
          <label>Malzeme *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="örn. Latex Eldiven M" /></label>
          <label>Kategori
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {['sarf', 'anestezi', 'dolgu', 'endodonti', 'protez', 'cerrahi', 'hijyen', 'laboratuvar'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Birim
            <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {['adet', 'kutu', 'paket', 'ml', 'gram'].map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </label>
          <label>Miktar<input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></label>
          <label>Kritik Seviye<input type="number" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: e.target.value })} /></label>
          <label>Son Kullanma<input type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} /></label>
        </div>
        <button onClick={add}><Plus size={15} /> Envantere Ekle</button>
      </div>

      <div className="card">
        <div className="card-head">
          <h3><Box size={18} /> Envanter ({rows.length})</h3>
          <input placeholder="Malzeme ara..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {list.length === 0 && <p className="muted">Kayıt yok.</p>}
        {list.map((r) => {
          const low = Number(r.quantity) <= Number(r.min_quantity)
          const exp = soon(r.expiry)
          return (
            <div className="appt-row" key={r.id}>
              <div>
                <strong>{r.name}</strong> <span className="muted">({r.category} · {r.unit})</span>
                <p className="muted">
                  Miktar: <b>{r.quantity}</b> / kritik {r.min_quantity}
                  {r.expiry ? <> · Son kullanma: <b>{r.expiry}</b></> : null}
                </p>
                {low && <span className="badge warn-badge"><Alert size={12} /> Kritik stok</span>}
                {exp && <span className="badge warn-badge"><Clock size={12} /> Süresi yaklaşıyor</span>}
              </div>
              <RowActions
                editing={edit?.id === r.id}
                onEdit={() => setEdit({ ...r })}
                onSave={save}
                onDelete={() => del(r.id)}
              />
            </div>
          )
        })}
        {edit && (
          <div className="card edit-panel">
            <h4>Düzenle: {edit.name}</h4>
            <div className="grid form-grid">
              <label>Ad<input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
              <label>Miktar<input type="number" value={edit.quantity} onChange={(e) => setEdit({ ...edit, quantity: e.target.value })} /></label>
              <label>Kritik Seviye<input type="number" value={edit.min_quantity} onChange={(e) => setEdit({ ...edit, min_quantity: e.target.value })} /></label>
              <label>Son Kullanma<input type="date" value={edit.expiry || ''} onChange={(e) => setEdit({ ...edit, expiry: e.target.value })} /></label>
            </div>
          </div>
        )}
        {msg && <p className="muted">{msg}</p>}
      </div>
    </div>
  )
}

/* ================================================================== */
/* 3) LABORATUVAR TAKİBİ                                               */
/* ================================================================== */
export function LabTracker({ patients }) {
  const [rows, setRows] = useState([])
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState({ patient_id: '', patient_name: '', kind: 'protez', lab: '', due_at: '', note: '' })
  const [edit, setEdit] = useState(null)

  const load = () => labApi.list().then(setRows)
  useEffect(() => { load() }, [])

  const add = async () => {
    if (!form.kind) return setMsg('Proje türü seçin.')
    const p = patients.find((x) => x.id === form.patient_id)
    const r = await labApi.insert({
      patient_id: form.patient_id || null,
      patient_name: p?.name || form.patient_name || '',
      kind: form.kind, lab: form.lab, due_at: form.due_at || null, note: form.note
    })
    setMsg(r.error || 'Laboratuvar kaydı açıldı.')
    setForm({ patient_id: '', patient_name: '', kind: 'protez', lab: '', due_at: '', note: '' })
    load()
  }

  const save = async () => {
    const r = await labApi.update(edit.id, edit)
    setMsg(r.error || 'Güncellendi.')
    setEdit(null)
    load()
  }

  const del = async (id) => {
    const r = await labApi.remove(id)
    setMsg(r.error || 'Kayıt silindi.')
    load()
  }

  const setStatus = async (row, status) => {
    const r = await labApi.update(row.id, { status })
    setMsg(r.error || `Durum güncellendi: ${status}`)
    load()
  }

  const today = new Date().toISOString().slice(0, 10)
  const waiting = rows.filter((r) => r.status === 'laboratuvarda')
  const late = waiting.filter((r) => r.due_at && r.due_at < today)

  return (
    <div>
      <div className="kpi-row compact">
        <div className="kpi"><b>{waiting.length}</b><span>Laboratuvarda</span></div>
        <div className="kpi"><b>{rows.filter((r) => r.status === 'geldi').length}</b><span>Hazır / Geldi</span></div>
        <div className={`kpi ${late.length ? 'warn' : ''}`}><b>{late.length}</b><span>Geciken</span></div>
      </div>

      <div className="card">
        <div className="card-head"><h3><Flask size={18} /> Yeni Laboratuvar Kaydı</h3></div>
        <div className="grid form-grid">
          <label>Hasta
            <select value={form.patient_id} onChange={(e) => {
              const p = patients.find((x) => x.id === e.target.value)
              setForm({ ...form, patient_id: e.target.value, patient_name: p?.name || '' })
            }}>
              <option value="">— seçin —</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label>Proje Türü
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
              {['protez', 'zirkonyum', 'implant', 'ortodonti', 'tamir', 'laminate'].map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </label>
          <label>Laboratuvar<input value={form.lab} onChange={(e) => setForm({ ...form, lab: e.target.value })} placeholder="örn. Anadolu Diş Lab." /></label>
          <label>Termin Tarihi<input type="date" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></label>
          <label>Not<input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        </div>
        <button onClick={add}><Plus size={15} /> Kaydı Aç</button>
      </div>

      <div className="card">
        <h3><Flask size={18} /> Laboratuvar Kayıtları ({rows.length})</h3>
        {rows.length === 0 && <p className="muted">Kayıt yok.</p>}
        {rows.map((r) => (
          <div className="appt-row" key={r.id}>
            <div>
              <span className="badge">{r.kind}</span>
              <strong>{r.patient_name || '—'}</strong>
              <p className="muted">
                {r.lab || 'laboratuvar belirtilmedi'} · gönderim {String(r.sent_at || '').slice(0, 10)}
                {r.due_at ? ` · termin ${r.due_at}` : ''}
              </p>
              {r.note && <p className="muted">{r.note}</p>}
              {r.due_at && r.due_at < today && r.status === 'laboratuvarda' && (
                <span className="badge warn-badge"><Alert size={12} /> Termin geçti</span>
              )}
            </div>
            <div className="toolbar">
              <select value={r.status} onChange={(e) => setStatus(r, e.target.value)}>
                <option value="laboratuvarda">Laboratuvarda</option>
                <option value="geldi">Geldi</option>
                <option value="uygulandi">Uygulandı</option>
              </select>
              {r.patient_id && <Link to={`/hekim/hasta/${r.patient_id}`}><button className="ghost">Hastayı Aç</button></Link>}
              <RowActions
                editing={edit?.id === r.id}
                onEdit={() => setEdit({ ...r })}
                onSave={save}
                onDelete={() => del(r.id)}
              />
            </div>
          </div>
        ))}
        {edit && (
          <div className="card edit-panel">
            <h4>Düzenle</h4>
            <div className="grid form-grid">
              <label>Proje Türü
                <select value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })}>
                  {['protez', 'zirkonyum', 'implant', 'ortodonti', 'tamir', 'laminate'].map((k) => <option key={k} value={k}>{k}</option>)}
                </select>
              </label>
              <label>Laboratuvar<input value={edit.lab || ''} onChange={(e) => setEdit({ ...edit, lab: e.target.value })} /></label>
              <label>Termin<input type="date" value={edit.due_at || ''} onChange={(e) => setEdit({ ...edit, due_at: e.target.value })} /></label>
              <label>Not<input value={edit.note || ''} onChange={(e) => setEdit({ ...edit, note: e.target.value })} /></label>
            </div>
          </div>
        )}
        {msg && <p className="muted">{msg}</p>}
      </div>
    </div>
  )
}

/* ================================================================== */
/* 4) FİYATLANDIRMA + HESAP                                            */
/* ================================================================== */
export function Billing({ patients, initial = 'fiyat' }) {
  const [prices, setPrices] = useState([])
  const [invoices, setInvoices] = useState([])
  const [msg, setMsg] = useState('')
  const [tab, setTab] = useState(initial)
  const [form, setForm] = useState({ code: '', name: '', category: 'tedavi', price: 0 })
  const [inv, setInv] = useState({ patient_id: '', item: '', amount: 0, paid: 0, due_date: '' })
  const [editP, setEditP] = useState(null)
  const [editI, setEditI] = useState(null)

  const load = () => { pricesApi.list({ order: 'id', asc: true }).then(setPrices); invoicesApi.list().then(setInvoices) }
  useEffect(() => { load() }, [])

  const addPrice = async () => {
    if (!form.name.trim()) return setMsg('İşlem adı zorunlu.')
    const r = await pricesApi.insert({ ...form, price: Number(form.price) || 0 })
    setMsg(r.error || 'Fiyat eklendi.')
    setForm({ code: '', name: '', category: 'tedavi', price: 0 })
    load()
  }
  const savePrice = async () => {
    const r = await pricesApi.update(editP.id, { ...editP, price: Number(editP.price) || 0 })
    setMsg(r.error || 'Fiyat güncellendi.')
    setEditP(null); load()
  }
  const delPrice = async (id) => { const r = await pricesApi.remove(id); setMsg(r.error || 'Silindi.'); load() }

  const addInv = async () => {
    const p = patients.find((x) => x.id === inv.patient_id)
    if (!p) return setMsg('Hasta seçin.')
    if (!inv.item.trim()) return setMsg('İşlem açıklaması zorunlu.')
    const r = await invoicesApi.insert({
      patient_id: p.id, patient_name: p.name, item: inv.item,
      amount: Number(inv.amount) || 0, paid: Number(inv.paid) || 0, due_date: inv.due_date || null
    })
    setMsg(r.error || 'Hesap kaydı açıldı.')
    setInv({ patient_id: '', item: '', amount: 0, paid: 0, due_date: '' })
    load()
  }
  const saveInv = async () => {
    const r = await invoicesApi.update(editI.id, { ...editI, amount: Number(editI.amount) || 0, paid: Number(editI.paid) || 0 })
    setMsg(r.error || 'Hesap güncellendi.')
    setEditI(null); load()
  }
  const delInv = async (id) => { const r = await invoicesApi.remove(id); setMsg(r.error || 'Silindi.'); load() }

  const balance = (i) => Number(i.amount || 0) - Number(i.paid || 0)
  const totalDebt = invoices.reduce((s, i) => s + Math.max(0, balance(i)), 0)
  const totalPaid = invoices.reduce((s, i) => s + Number(i.paid || 0), 0)

  return (
    <div>
      <div className="kpi-row compact">
        <div className="kpi"><b>{invoices.length}</b><span>Hesap Kaydı</span></div>
        <div className="kpi"><b>{totalPaid.toLocaleString('tr-TR')} ₺</b><span>Tahsil Edilen</span></div>
        <div className={`kpi ${totalDebt > 0 ? 'warn' : ''}`}><b>{totalDebt.toLocaleString('tr-TR')} ₺</b><span>Toplam Bakiye</span></div>
      </div>

      <div className="tabs">
        <button className={tab === 'fiyat' ? 'tab active' : 'tab'} onClick={() => setTab('fiyat')}><Tag size={15} /> Fiyat Listesi</button>
        <button className={tab === 'hesap' ? 'tab active' : 'tab'} onClick={() => setTab('hesap')}><Receipt size={15} /> Hesaplar ve Bakiye</button>
      </div>

      {tab === 'fiyat' && (
        <div>
          <div className="card">
            <div className="card-head"><h3><Tag size={18} /> Yeni Fiyat</h3></div>
            <div className="grid form-grid">
              <label>Kod<input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="örn. F03" /></label>
              <label>İşlem *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label>Kategori
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {['tedavi', 'muayene', 'görüntüleme', 'restoratif', 'endodonti', 'temizlik', 'estetik', 'protez', 'implant', 'ortodonti'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
              <label>Fiyat (₺)<input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
            </div>
            <button onClick={addPrice}><Plus size={15} /> Fiyat Ekle</button>
          </div>

          <div className="card">
            <h3><Tag size={18} /> Fiyat Listesi ({prices.length})</h3>
            {prices.length === 0 && <p className="muted">Fiyat listesi boş.</p>}
            {prices.map((p) => (
              <div className="appt-row" key={p.id}>
                <div>
                  {p.code && <span className="badge">{p.code}</span>}
                  <strong>{p.name}</strong> <span className="muted">({p.category})</span>
                  <p><b>{Number(p.price).toLocaleString('tr-TR')} ₺</b></p>
                </div>
                <RowActions
                  editing={editP?.id === p.id}
                  onEdit={() => setEditP({ ...p })}
                  onSave={savePrice}
                  onDelete={() => delPrice(p.id)}
                />
                {editP?.id === p.id && (
                  <span className="row-actions">
                    <input type="number" value={editP.price} onChange={(e) => setEditP({ ...editP, price: e.target.value })} />
                  </span>
                )}
              </div>
            ))}
            {msg && <p className="muted">{msg}</p>}
          </div>
        </div>
      )}

      {tab === 'hesap' && (
        <div>
          <div className="card">
            <div className="card-head"><h3><Receipt size={18} /> Yeni Hesap Kaydı</h3></div>
            <div className="grid form-grid">
              <label>Hasta
                <select value={inv.patient_id} onChange={(e) => setInv({ ...inv, patient_id: e.target.value })}>
                  <option value="">— seçin —</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <label>İşlem *<input value={inv.item} onChange={(e) => setInv({ ...inv, item: e.target.value })} /></label>
              <label>Tutar (₺)<input type="number" value={inv.amount} onChange={(e) => setInv({ ...inv, amount: e.target.value })} /></label>
              <label>Ödenen (₺)<input type="number" value={inv.paid} onChange={(e) => setInv({ ...inv, paid: e.target.value })} /></label>
              <label>Vade<input type="date" value={inv.due_date} onChange={(e) => setInv({ ...inv, due_date: e.target.value })} /></label>
            </div>
            <button onClick={addInv}><Plus size={15} /> Hesap Kaydı Aç</button>
          </div>

          <div className="card">
            <h3><Receipt size={18} /> Hesaplar ({invoices.length})</h3>
            {invoices.length === 0 && <p className="muted">Hesap kaydı yok.</p>}
            {invoices.map((i) => (
              <div className="appt-row" key={i.id}>
                <div>
                  <strong>{i.patient_name || '—'}</strong> <span className="muted">{i.item}</span>
                  <p className="muted">
                    Tutar {Number(i.amount).toLocaleString('tr-TR')} ₺ · Ödenen {Number(i.paid).toLocaleString('tr-TR')} ₺ ·
                    Bakiye <b className={balance(i) > 0 ? 'due-now' : ''}>{balance(i).toLocaleString('tr-TR')} ₺</b>
                    {i.due_date ? ` · vade ${i.due_date}` : ''}
                  </p>
                </div>
                <div className="toolbar">
                  {i.patient_id && <Link to={`/hekim/hasta/${i.patient_id}`}><button className="ghost">Hastayı Aç</button></Link>}
                  <RowActions
                    editing={editI?.id === i.id}
                    onEdit={() => setEditI({ ...i })}
                    onSave={saveInv}
                    onDelete={() => delInv(i.id)}
                  />
                </div>
                {editI?.id === i.id && (
                  <div className="card edit-panel">
                    <div className="grid form-grid">
                      <label>İşlem<input value={editI.item} onChange={(e) => setEditI({ ...editI, item: e.target.value })} /></label>
                      <label>Tutar<input type="number" value={editI.amount} onChange={(e) => setEditI({ ...editI, amount: e.target.value })} /></label>
                      <label>Ödenen<input type="number" value={editI.paid} onChange={(e) => setEditI({ ...editI, paid: e.target.value })} /></label>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {msg && <p className="muted">{msg}</p>}
          </div>
        </div>
      )}
    </div>
  )
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
export function ClinicStats({ patients, appts, plans, invoices, materials, lab, photos = [] }) {
  const today = new Date().toISOString().slice(0, 10)
  const month = today.slice(0, 7)
  const inMonth = appts.filter((a) => String(a.created_at || '').slice(0, 7) === month)
  const debt = invoices.reduce((s, i) => s + Math.max(0, Number(i.amount || 0) - Number(i.paid || 0)), 0)
  const lowStock = materials.filter((m) => Number(m.quantity) <= Number(m.min_quantity)).length
  const pendingPhotos = photos.filter((p) => p.status !== 'degerlendirildi').length

  const cards = [
    { Icon: User, n: patients.length, l: 'Kayıtlı hasta', to: '?tab=hastalar' },
    { Icon: Calendar, n: inMonth.length, l: 'Bu ay randevu talebi', to: '?tab=randevu' },
    { Icon: Clipboard, n: plans.filter((p) => p.status === 'devam').length, l: 'Devam eden tedavi', to: '?tab=hastalar' },
    { Icon: Receipt, n: debt.toLocaleString('tr-TR') + ' ₺', l: 'Toplam bakiye', to: '?tab=hesap' },
    { Icon: Package, n: lowStock, l: 'Kritik stok', to: '?tab=envanter' },
    { Icon: Flask, n: lab.filter((l) => l.status === 'laboratuvarda').length, l: 'Laboratuvarda', to: '?tab=laboratuvar' },
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
