import { useEffect, useState } from 'react'
import { listDoctors, createProfile } from '../services/db.js'
import { supabase, hasSupabase } from '../services/supabase.js'
import { getSession } from '../services/store.js'

// Yalnızca admin: hekim hesabı açma
export function AdminPanel() {
  const [doctors, setDoctors] = useState([])
  const [form, setForm] = useState({ uid: '', email: '', name: '', branch: 'genel' })
  const [msg, setMsg] = useState('')
  useEffect(() => { listDoctors().then(setDoctors) }, [])
  const save = async () => {
    const r = await createProfile({ uid: form.uid, role: 'hekim', email: form.email, name: form.name, createdBy: getSession()?.id })
    if (!r.error && form.branch !== 'genel' && hasSupabase) {
      await supabase.from('profiles').update({ branch: form.branch }).eq('id', form.uid)
    }
    setMsg(r.error || 'Hekim profili kaydedildi.')
    if (!r.error) { listDoctors().then(setDoctors); setForm({ uid: '', email: '', name: '', branch: 'genel' }) }
  }
  return (
    <div>
      <h1>Admin Paneli</h1>
      <p className="muted">Hekim hesaplarını yalnızca admin açar. Önce Authentication ekranında kullanıcıyı açın.</p>
      <div className="card">
        <h3>Yeni Hekim Kaydı</h3>
        <div className="toolbar">
          <input placeholder="Auth UID" value={form.uid} onChange={(e) => setForm({ ...form, uid: e.target.value })} style={{ width: 280 }} />
          <input placeholder="e-posta" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input placeholder="Ad Soyad" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
            <option value="genel">Genel Diş</option>
            <option value="restoratif">Restoratif</option>
            <option value="endodonti">Endodonti</option>
            <option value="periodontoloji">Periodontoloji</option>
            <option value="pedodonti">Pedodonti</option>
          </select>
          <button onClick={save}>Hekimi Kaydet</button>
        </div>
        {msg && <p className="muted">{msg}</p>}
      </div>
      <div className="card">
        <h3>Kayıtlı Hekimler ({doctors.length})</h3>
        {doctors.map((d) => <p key={d.id}><strong>{d.name}</strong> <span className="muted">({d.email}) {d.branch ? `- ${d.branch}` : ''}</span></p>)}
      </div>
    </div>
  )
}
