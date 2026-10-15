import { useEffect, useState } from 'react'
import { createUserByDoctor, updateUserByAdmin, logout } from '../services/auth.js'
import { listAllProfiles, listAppointments, listReferrals, listRequests } from '../services/db.js'
import { useNavigate } from 'react-router-dom'
import { Shield, Chart, Users, Lock, Clipboard, LogOut, Stethoscope, Plus, UserPlus } from '../components/Icons.jsx'

const BRANCHES = ['genel', 'restoratif', 'endodonti', 'periodontoloji', 'pedodonti', 'ortodonti', 'protez', 'ağız-cerrahi']
const BRANCH_TR = { genel: 'Genel Diş', restoratif: 'Restoratif', endodonti: 'Endodonti', periodontoloji: 'Periodontoloji', pedodonti: 'Pedodonti', ortodonti: 'Ortodonti', protez: 'Protez', 'ağız-cerrahi': 'Ağız ve Çene Cerrahisi' }
const ROLE_TR = { admin: 'Süper Admin', hekim: 'Hekim', hasta: 'Hasta', ebeveyn: 'Ebeveyn' }

const empty = { name: '', email: '', pass: '', role: 'hekim', branch: 'genel', tc_no: '', phone: '', username: '' }

export function AdminPanel() {
  const nav = useNavigate()
  const [tab, setTab] = useState('genel')
  const [users, setUsers] = useState([])
  const [appts, setAppts] = useState([])
  const [refs, setRefs] = useState([])
  const [requests, setRequests] = useState([])
  const [form, setForm] = useState(empty)
  const [msg, setMsg] = useState('')

  const reload = () => {
    listAllProfiles().then(setUsers)
    listAppointments().then(setAppts)
    listReferrals().then(setRefs)
    listRequests().then(setRequests)
  }
  useEffect(reload, [])

  const doctors = users.filter((u) => u.role === 'hekim')
  const patients = users.filter((u) => u.role === 'hasta' || u.role === 'ebeveyn')

  const addUser = async () => {
    setMsg('')
    const extra = {}
    if (form.tc_no) extra.tc_no = form.tc_no
    if (form.phone) extra.phone = form.phone
    const r = await createUserByDoctor({
      name: form.name, email: form.email, pass: form.pass,
      role: form.role, branch: form.branch, username: form.username, extra
    })
    if (r.error) return setMsg(r.error)
    setMsg(`${form.name} (${ROLE_TR[form.role]}) hesabı açıldı.`)
    setForm(empty)
    reload()
  }

  const changeRole = async (u, role) => {
    const r = await updateUserByAdmin(u.id, { role })
    setMsg(r.error || `${u.name} → ${ROLE_TR[role]} olarak güncellendi.`)
    reload()
  }

  const saveMeta = async (u, patch) => {
    const r = await updateUserByAdmin(u.id, patch)
    setMsg(r.error || `${u.name} güncellendi.`)
    reload()
  }

  const out = async () => { await logout(); nav('/admin') }

  return (
    <div>
      <h1><Shield size={24} /> Süper Admin Paneli</h1>
      <p className="muted">Sistem yöneticisi: kullanıcı açma ve yetkilendirme.</p>

      <div className="tabs">
        <button className={tab === 'genel' ? 'tab active' : 'tab'} onClick={() => setTab('genel')}><Chart size={15} /> Genel</button>
        <button className={tab === 'kullanici' ? 'tab active' : 'tab'} onClick={() => setTab('kullanici')}><Users size={15} /> Kullanıcılar</button>
        <button className={tab === 'yetki' ? 'tab active' : 'tab'} onClick={() => setTab('yetki')}><Lock size={15} /> Yetkilendirme</button>
        <button className={tab === 'istek' ? 'tab active' : 'tab'} onClick={() => setTab('istek')}><Clipboard size={15} /> Kayıt İstekleri</button>
        <button className="ghost" onClick={out}><LogOut size={15} /> Çıkış</button>
      </div>

      {tab === 'genel' && (
        <div>
          <div className="kpi-row">
            <div className="kpi"><b>{users.length}</b><span>Toplam Kullanıcı</span></div>
            <div className="kpi"><b>{doctors.length}</b><span>Hekim</span></div>
            <div className="kpi"><b>{patients.length}</b><span>Hasta / Ebeveyn</span></div>
            <div className="kpi"><b>{appts.length}</b><span>Randevu</span></div>
            <div className="kpi"><b>{refs.length}</b><span>Sevk</span></div>
            <div className="kpi warn"><b>{requests.length}</b><span>Bekleyen İstek</span></div>
          </div>
          <div className="card">
            <div className="card-head">
              <h3><Stethoscope size={18} /> Hekimler</h3>
              <button onClick={() => { setTab('kullanici'); setForm({ ...empty, role: 'hekim' }) }}>
                <UserPlus size={15} /> Hekim Ekle
              </button>
            </div>
            {doctors.length === 0 && <p className="muted">Kayıtlı hekim yok.</p>}
            {doctors.map((d) => (
              <p key={d.id}><strong>Dt. {d.name}</strong> <span className="muted">({d.email})</span> <span className="badge">{BRANCH_TR[d.branch] || d.branch}</span></p>
            ))}
          </div>
        </div>
      )}

      {tab === 'kullanici' && (
        <div className="card">
          <h3><UserPlus size={18} /> Yeni Kullanıcı Aç</h3>
          <div className="grid form-grid">
            <label>Ad Soyad *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>E-posta *<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label>Şifre *<input value={form.pass} onChange={(e) => setForm({ ...form, pass: e.target.value })} /></label>
            <label>Kullanıcı Adı<input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="örn: resulyel" /></label>
            <label>Rol
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="hekim">Hekim</option>
                <option value="hasta">Hasta</option>
                <option value="ebeveyn">Ebeveyn</option>
              </select>
            </label>
            {form.role === 'hekim' && (
              <label>Branş
                <select value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })}>
                  {BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_TR[b]}</option>)}
                </select>
              </label>
            )}
            <label>TC No<input value={form.tc_no} onChange={(e) => setForm({ ...form, tc_no: e.target.value })} /></label>
            <label>Telefon<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
          </div>
          <button onClick={addUser}>Hesabı Oluştur</button>
          {msg && <p className="muted">{msg}</p>}

          <h3><Users size={18} /> Tüm Kullanıcılar ({users.length})</h3>
          <table className="table">
            <thead><tr><th>Ad</th><th>E-posta</th><th>Rol</th><th>Branş</th><th>Telefon</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.role === 'hekim' || u.role === 'admin' ? 'Dt. ' + u.name : u.name}</td>
                  <td className="muted">{u.email}</td>
                  <td><span className={`role-badge ${u.role}`}>{ROLE_TR[u.role]}</span></td>
                  <td className="muted">{BRANCH_TR[u.branch] || '-'}</td>
                  <td className="muted">{u.phone || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'yetki' && (
        <div className="card">
          <h3><Lock size={18} /> Kullanıcı Yetkilerini Düzenle</h3>
          <p className="muted">Rol değişikliği anında geçerlidir. Veriler silinmez.</p>
          <table className="table">
            <thead><tr><th>Kullanıcı</th><th>Mevcut Rol</th><th>Yeni Rol</th><th>Kullanıcı Adı</th><th>Branş</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong><br /><span className="muted">{u.email}</span></td>
                  <td><span className={`role-badge ${u.role}`}>{ROLE_TR[u.role]}</span></td>
                  <td>
                    <select defaultValue={u.role} onChange={(e) => changeRole(u, e.target.value)}>
                      {['admin', 'hekim', 'hasta', 'ebeveyn'].map((r) => <option key={r} value={r}>{ROLE_TR[r]}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      defaultValue={u.username || ''}
                      onBlur={(e) => e.target.value !== (u.username || '') && saveMeta(u, { username: e.target.value })}
                      placeholder="kullanıcı adı"
                    />
                  </td>
                  <td>
                    <select defaultValue={u.branch || 'genel'} onChange={(e) => saveMeta(u, { branch: e.target.value })}>
                      {BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_TR[b]}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {msg && <p className="muted">{msg}</p>}
        </div>
      )}

      {tab === 'istek' && (
        <div className="card">
          <h3><Clipboard size={18} /> Bekleyen Kayıt İstekleri ({requests.length})</h3>
          {requests.length === 0 && <p className="muted">Bekleyen istek yok.</p>}
          {requests.map((r) => (
            <p key={r.id}><strong>{r.name}</strong> <span className="muted">({r.email})</span> <span className="badge">{r.role}</span></p>
          ))}
        </div>
      )}
    </div>
  )
}