import { useEffect, useState } from 'react'
import { createUserByDoctor, updateUserByAdmin, setPasswordByAdmin, updateProfileByAdmin, logout } from '../services/auth.js'
import { listAllProfiles, listAppointments, listReferrals, listRequests } from '../services/db.js'
import { useNavigate } from 'react-router-dom'
import { Shield, Chart, Users, Lock, Clipboard, LogOut, Stethoscope, UserPlus, Key, Refresh, X, CheckCircle, User, Phone, Save, Alert, Settings } from '../components/Icons.jsx'

const BRANCHES = ['genel', 'restoratif', 'endodonti', 'periodontoloji', 'pedodonti', 'ortodonti', 'protez', 'ağız-cerrahi']
const BRANCH_TR = { genel: 'Genel Diş', restoratif: 'Restoratif', endodonti: 'Endodonti', periodontoloji: 'Periodontoloji', pedodonti: 'Pedodonti', ortodonti: 'Ortodonti', protez: 'Protez', 'ağız-cerrahi': 'Ağız ve Çene Cerrahisi' }
const ROLE_TR = { admin: 'Süper Admin', hekim: 'Hekim', hasta: 'Hasta', ebeveyn: 'Ebeveyn' }

const empty = { name: '', email: '', pass: '', role: 'hekim', branch: 'genel', tc_no: '', phone: '', username: '' }

const GENDERS = ['', 'Kadın', 'Erkek']
const BLOODS = ['', 'A0', 'A Rh+', 'A Rh-', 'B0', 'B Rh+', 'B Rh-', 'AB0', 'AB Rh+', 'AB Rh-', 'O0', 'O Rh+', 'O Rh-']
const RELATIONS = ['', 'Anne', 'Baba', 'Eş', 'Kardeş', 'Akraba', 'Veli', 'Diğer']
const TREATMENTS = ['kontrol', 'temizlik', 'dolgu', 'kanal tedavisi', 'protez', 'ortodonti', 'cerrahi', 'pedodonti']
const ROLES = ['admin', 'hekim', 'hasta', 'ebeveyn']
const REMINDERS = [1, 2, 3, 5, 7, 10, 14, 30, 60, 90, 180, 365]

function randomPass() {
  const chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

function toEditForm(u) {
  return {
    name: u.name || '', email: u.email || '', username: u.username || '',
    role: u.role || 'hekim', branch: u.branch || 'genel',
    tc_no: u.tc_no || '', birth_date: u.birth_date || '', gender: u.gender || '',
    phone: u.phone || '', address: u.address || '', city: u.city || '', district: u.district || '',
    blood: u.blood || '', insurance: u.insurance || '', school: u.school || '',
    occupation: u.occupation || '', near_name: u.near_name || '', near_phone: u.near_phone || '',
    near_relation: u.near_relation || '', note: u.note || '',
    reminder_days: u.reminder_days ?? 5, last_visit: u.last_visit || '',
    treatment_type: u.treatment_type || 'kontrol',
    plaque_index: u.plaque_index ?? 1, anxiety_score: u.anxiety_score ?? 3
  }
}

function Modal({ title, sub, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div>
            <h3>{title}</h3>
            {sub && <p className="muted">{sub}</p>}
          </div>
          <button className="ghost" onClick={onClose} aria-label="Kapat"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// --- Süper admin: şifre atama ---
function PasswordModal({ user, onClose, onDone }) {
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setMsg('')
    if (pass.length < 6) return setMsg('Şifre en az 6 karakter olmalı.')
    if (pass !== pass2) return setMsg('Şifreler aynı değil.')
    setBusy(true)
    const r = await setPasswordByAdmin(user.id, pass)
    setBusy(false)
    if (r.error) return setMsg(r.error)
    onDone(`${user.name} için yeni şifre atandı. Kullanıcının açık oturumları kapatıldı.`)
  }

  return (
    <Modal title="Şifre Ata" sub={`${user.name} · ${user.email}`} onClose={onClose}>
      <h4 className="modal-sub"><Key size={15} /> Yeni Şifre</h4>
      <div className="grid form-grid">
        <label>Yeni Şifre
          <input type="text" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" />
        </label>
        <label>Yeni Şifre (tekrar)
          <input type="text" value={pass2} onChange={(e) => setPass2(e.target.value)} autoComplete="new-password" />
        </label>
      </div>
      <p className="muted">En az 6 karakter. Kullanıcıya bu şifreyi güvenli bir kanaldan iletin.</p>
      <button className="ghost" type="button" onClick={() => { const p = randomPass(); setPass(p); setPass2(p) }}>
        <Refresh size={15} /> Rastgele Şifre Üret
      </button>
      {msg && <p className="auth-err"><Alert size={15} /> {msg}</p>}
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>Vazgeç</button>
        <button onClick={save} disabled={busy}>{busy ? 'Atanıyor...' : <><CheckCircle size={15} /> Şifreyi Ata</>}</button>
      </div>
    </Modal>
  )
}

// --- Süper admin: kullanıcının tüm verisini düzenleme ---
function EditUserModal({ user, onClose, onDone }) {
  const [form, setForm] = useState(() => toEditForm(user))
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const save = async () => {
    setMsg('')
    if (!form.name.trim()) return setMsg('Ad soyad zorunlu.')
    if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return setMsg('E-posta geçersiz.')
    if (form.tc_no && !/^\d{5,11}$/.test(form.tc_no)) return setMsg('TC kimlik numarası 5-11 haneli olmalı.')
    setBusy(true)
    const r = await updateProfileByAdmin(user.id, {
      ...form,
      reminder_days: Number(form.reminder_days) || 5,
      plaque_index: Number(form.plaque_index) || 1,
      anxiety_score: Number(form.anxiety_score) || 3
    })
    setBusy(false)
    if (r.error) return setMsg(r.error)
    onDone(`${form.name} bilgileri güncellendi${r.fallback ? ' (e-posta değişikliği için sunucu fonksiyonunu çalıştırın)' : ''}.`)
  }

  return (
    <Modal title="Kullanıcıyı Düzenle" sub={`${user.email} · rol: ${ROLE_TR[user.role] || user.role}`} onClose={onClose}>
      <h4 className="modal-sub"><Shield size={15} /> Hesap Bilgileri</h4>
      <div className="grid form-grid">
        <label>Ad Soyad *<input value={form.name} onChange={set('name')} /></label>
        <label>E-posta (giriş bilgisi)
          <input value={form.email} onChange={set('email')} />
        </label>
        <label>Kullanıcı Adı<input value={form.username} onChange={set('username')} placeholder="örn: resulyel" /></label>
        <label>Rol
          <select value={form.role} onChange={set('role')}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_TR[r]}</option>)}
          </select>
        </label>
        <label>Branş
          <select value={form.branch} onChange={set('branch')}>
            {BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_TR[b]}</option>)}
          </select>
        </label>
        <label>Hatırlatma (gün önce)
          <select value={form.reminder_days} onChange={set('reminder_days')}>
            {REMINDERS.map((d) => <option key={d} value={d}>{d} gün</option>)}
          </select>
        </label>
      </div>

      <h4 className="modal-sub"><User size={15} /> Kimlik Bilgileri</h4>
      <div className="grid form-grid">
        <label>TC Kimlik No<input value={form.tc_no} onChange={set('tc_no')} /></label>
        <label>Doğum Tarihi<input type="date" value={form.birth_date || ''} onChange={set('birth_date')} /></label>
        <label>Cinsiyet
          <select value={form.gender} onChange={set('gender')}>
            {GENDERS.map((g) => <option key={g} value={g}>{g || 'Seç'}</option>)}
          </select>
        </label>
        <label>Kan Grubu
          <select value={form.blood} onChange={set('blood')}>
            {BLOODS.map((b) => <option key={b} value={b}>{b || 'Seç'}</option>)}
          </select>
        </label>
      </div>

      <h4 className="modal-sub"><Phone size={15} /> İletişim ve Adres</h4>
      <div className="grid form-grid">
        <label>Telefon<input value={form.phone} onChange={set('phone')} /></label>
        <label>Adres<input value={form.address} onChange={set('address')} /></label>
        <label>İl<input value={form.city} onChange={set('city')} /></label>
        <label>İlçe<input value={form.district} onChange={set('district')} /></label>
      </div>

      <h4 className="modal-sub"><Users size={15} /> Yakın ve Sosyal Bilgiler</h4>
      <div className="grid form-grid">
        <label>Yakın Adı<input value={form.near_name} onChange={set('near_name')} /></label>
        <label>Yakın Telefonu<input value={form.near_phone} onChange={set('near_phone')} /></label>
        <label>Yakınlık
          <select value={form.near_relation} onChange={set('near_relation')}>
            {RELATIONS.map((r) => <option key={r} value={r}>{r || 'Seç'}</option>)}
          </select>
        </label>
        <label>Okul<input value={form.school} onChange={set('school')} /></label>
        <label>Meslek<input value={form.occupation} onChange={set('occupation')} /></label>
        <label>Sağlık Sigortası<input value={form.insurance} onChange={set('insurance')} /></label>
      </div>

      <h4 className="modal-sub"><Chart size={15} /> Klinik Bilgiler</h4>
      <div className="grid form-grid">
        <label>Son Kontrol<input type="date" value={form.last_visit || ''} onChange={set('last_visit')} /></label>
        <label>Tedavi Türü
          <select value={form.treatment_type} onChange={set('treatment_type')}>
            {TREATMENTS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label>Plak İndeksi (0-3)<input type="number" min="0" max="3" step="0.1" value={form.plaque_index} onChange={set('plaque_index')} /></label>
        <label>Anksiyete (1-10)<input type="number" min="1" max="10" value={form.anxiety_score} onChange={set('anxiety_score')} /></label>
      </div>
      <label>Not<textarea rows="3" value={form.note} onChange={set('note')} /></label>

      {msg && <p className="auth-err"><Alert size={15} /> {msg}</p>}
      <div className="modal-actions">
        <button className="ghost" onClick={onClose}>Vazgeç</button>
        <button onClick={save} disabled={busy}>{busy ? 'Kaydediliyor...' : <><Save size={15} /> Bilgileri Kaydet</>}</button>
      </div>
    </Modal>
  )
}

export function AdminPanel() {
  const nav = useNavigate()
  const [tab, setTab] = useState('genel')
  const [users, setUsers] = useState([])
  const [appts, setAppts] = useState([])
  const [refs, setRefs] = useState([])
  const [requests, setRequests] = useState([])
  const [form, setForm] = useState(empty)
  const [msg, setMsg] = useState('')
  const [pwUser, setPwUser] = useState(null)
  const [editUser, setEditUser] = useState(null)

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

          <div className="card">
            <div className="card-head">
              <h3><Users size={18} /> Hasta / Ebeveyn ({patients.length})</h3>
              <button onClick={() => { setTab('kullanici'); setForm({ ...empty, role: 'hasta' }) }}>
                <UserPlus size={15} /> Hasta Ekle
              </button>
            </div>
            {patients.length === 0 && <p className="muted">Kayıtlı hasta yok.</p>}
            {patients.map((p) => (
              <p key={p.id}>
                <strong>{p.name}</strong> <span className="muted">({p.email})</span>
                <span className="badge">{ROLE_TR[p.role]}</span>
                {p.phone && <span className="muted"> · {p.phone}</span>}
                {p.city && <span className="muted"> · {p.city}</span>}
                <span className="row-actions">
                  <button className="ghost tiny" onClick={() => setEditUser(p)}><Settings size={13} /> Düzenle</button>
                  <button className="ghost tiny" onClick={() => setPwUser(p)}><Key size={13} /> Şifre</button>
                </span>
              </p>
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
            <thead><tr><th>Ad</th><th>E-posta</th><th>Rol</th><th>Branş</th><th>Telefon</th><th>İşlem</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.role === 'hekim' || u.role === 'admin' ? 'Dt. ' + u.name : u.name}</td>
                  <td className="muted">{u.email}</td>
                  <td><span className={`role-badge ${u.role}`}>{ROLE_TR[u.role]}</span></td>
                  <td className="muted">{BRANCH_TR[u.branch] || '-'}</td>
                  <td className="muted">{u.phone || '-'}</td>
                  <td className="row-actions">
                    <button className="ghost tiny" onClick={() => setEditUser(u)}>
                      <Settings size={13} /> Düzenle
                    </button>
                    <button className="ghost tiny" onClick={() => setPwUser(u)}>
                      <Key size={13} /> Şifre
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'yetki' && (
        <div className="card">
          <h3><Lock size={18} /> Kullanıcı Yetkilerini Düzenle</h3>
          <p className="muted">Rol, kullanıcı adı ve branş değişikliği anında geçerlidir. Veriler silinmez.</p>
          <table className="table">
            <thead><tr><th>Kullanıcı</th><th>Mevcut Rol</th><th>Yeni Rol</th><th>Kullanıcı Adı</th><th>Branş</th><th>İşlem</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.name}</strong><br /><span className="muted">{u.email}</span></td>
                  <td><span className={`role-badge ${u.role}`}>{ROLE_TR[u.role]}</span></td>
                  <td>
                    <select defaultValue={u.role} onChange={(e) => changeRole(u, e.target.value)}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_TR[r]}</option>)}
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
                  <td className="row-actions">
                    <button className="ghost tiny" onClick={() => setEditUser(u)}>
                      <Settings size={13} /> Düzenle
                    </button>
                    <button className="ghost tiny" onClick={() => setPwUser(u)}>
                      <Key size={13} /> Şifre
                    </button>
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

      {pwUser && (
        <PasswordModal
          user={pwUser}
          onClose={() => setPwUser(null)}
          onDone={(m) => { setPwUser(null); setMsg(m); reload() }}
        />
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onDone={(m) => { setEditUser(null); setMsg(m); reload() }}
        />
      )}
    </div>
  )
}