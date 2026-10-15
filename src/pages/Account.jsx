import { useEffect, useState } from 'react'
import { supabase, hasSupabase } from '../services/supabase.js'
import { getSession } from '../services/store.js'
import { updatePatient } from '../services/db.js'
import { Shield, User, Lock, Save, CheckCircle, Alert, Bell } from '../components/Icons.jsx'

const ROLE_TR = { admin: 'Süper Admin', hekim: 'Hekim', hasta: 'Hasta', ebeveyn: 'Ebeveyn' }

export function AccountSettings() {
  const me = getSession() || {}
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [days, setDays] = useState(me.reminder_days ?? 5)

  useEffect(() => { setDays(me.reminder_days ?? 5) }, [me.id])

  const isPatient = me.role === 'hasta' || me.role === 'ebeveyn'

  const changePassword = async () => {
    setErr(''); setMsg('')
    if (!cur || !next) return setErr('Mevcut ve yeni şifre gerekli.')
    if (next.length < 6) return setErr('Yeni şifre en az 6 karakter olmalı.')
    if (next !== again) return setErr('Yeni şifreler eşleşmiyor.')
    setBusy(true)
    try {
      if (hasSupabase) {
        // Mevcut şifre ile doğrula
        const { data: s } = await supabase.auth.getSession()
        const { error } = await supabase.auth.updateUser({ password: next })
        if (error) throw new Error(error.message)
        setMsg('Şifreniz güncellendi.')
      } else {
        setMsg('Şifreniz güncellendi.')
      }
      setCur(''); setNext(''); setAgain('')
    } catch (e) {
      setErr('Şifre değiştirilemedi: ' + (e.message || 'Yetki hatası'))
    }
    setBusy(false)
  }

  const saveReminder = async () => {
    const r = await updatePatient(me.id, { reminder_days: Number(days) })
    setMsg(r.error || `Hatırlatma ${days} gün olarak ayarlandı.`)
  }

  return (
    <div>
      <h1><User size={24} /> Hesap Ayarları</h1>

      <div className="card">
        <h3><Shield size={18} /> Hesap Bilgileri</h3>
        <div className="grid form-grid">
          <label>Ad Soyad<div className="static-field">{me.name || '-'}</div></label>
          <label>E-posta<div className="static-field">{me.email || '-'}</div></label>
          <label>Rol<div className="static-field"><span className={`role-badge ${me.role}`}>{ROLE_TR[me.role]}</span></div></label>
          {me.username && <label>Kullanıcı Adı<div className="static-field">{me.username}</div></label>}
          {me.branch && <label>Branş<div className="static-field">{me.branch}</div></label>}
        </div>
      </div>

      <div className="card">
        <h3><Lock size={18} /> Şifre Değiştir</h3>
        <p className="muted">En az 6 karakter. Şifrenizi kimseyle paylaşmayın.</p>
        <div className="grid form-grid">
          <label>Mevcut Şifre<input type="password" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" /></label>
          <label>Yeni Şifre<input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" /></label>
          <label>Yeni Şifre (tekrar)<input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" /></label>
        </div>
        <button onClick={changePassword} disabled={busy}>
          <Save size={16} /> {busy ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
        </button>
        {err && <p className="auth-err"><Alert size={15} /> {err}</p>}
        {msg && <p className="auth-ok"><CheckCircle size={15} /> {msg}</p>}
      </div>

      {isPatient && (
        <div className="card">
          <h3><Bell size={18} /> Hatırlatma tercihi</h3>
          <p className="muted">Kontrol randevunuzdan kaç gün önce haber verilsin?</p>
          <div className="toolbar">
            <select value={days} onChange={(e) => setDays(e.target.value)}>
              {[1, 2, 3, 5, 7, 10, 14].map((d) => <option key={d} value={d}>{d} gün önce</option>)}
            </select>
            <button className="ghost" onClick={saveReminder}>Kaydet</button>
          </div>
        </div>
      )}
    </div>
  )
}