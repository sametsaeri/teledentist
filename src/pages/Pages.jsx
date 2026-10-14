import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Reveal } from '../components/Reveal.jsx'
import { login, registerRequest } from '../services/auth.js'
import { insertAppointment } from '../services/db.js'

export function Home() {
  const { t } = useTranslation()
  return (
    <div>
      <div className="hero">
        <div className="hero-badge">🦷 KTÜ Diş Hekimliği Fakültesi</div>
        <h1>{t('home_title')}</h1>
        <p>{t('home_desc')}</p>
        <div className="hero-actions">
          <Link to="/e-randevu"><span className="btn btn-primary">📆 {t('home_cta1')}</span></Link>
          <Link to="/teledentistry"><span className="btn btn-ghost">🔬 {t('home_cta2')}</span></Link>
        </div>
        <div className="stat-row">
          <div className="stat"><b>{t('stat1_n')}</b>{t('stat1_l')}</div>
          <div className="stat"><b>{t('stat2_n')}</b>{t('stat2_l')}</div>
          <div className="stat"><b>{t('stat3_n')}</b>{t('stat3_l')}</div>
        </div>
      </div>

      <Reveal>
        <div className="card">
          <h2>🎯 {t('aim_title')}</h2>
          <p>{t('aim_desc')}</p>
        </div>
      </Reveal>

      <Reveal>
        <div className="card">
          <h2>🔄 {t('steps_title')}</h2>
          <div className="grid">
            <div className="step"><b>{t('step1_t')}</b><p className="muted">{t('step1_d')}</p></div>
            <div className="step"><b>{t('step2_t')}</b><p className="muted">{t('step2_d')}</p></div>
            <div className="step"><b>{t('step3_t')}</b><p className="muted">{t('step3_d')}</p></div>
            <div className="step"><b>{t('step4_t')}</b><p className="muted">{t('step4_d')}</p></div>
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="card">
          <h2>🏥 {t('dept_title')}</h2>
          <div className="grid">
            <div className="dept-mini"><b>🦷 {t('dept_rest')}</b><p className="muted">{t('dept_rest_d')}</p></div>
            <div className="dept-mini"><b>🩻 {t('dept_endo')}</b><p className="muted">{t('dept_endo_d')}</p></div>
            <div className="dept-mini"><b>🫧 {t('dept_perio')}</b><p className="muted">{t('dept_perio_d')}</p></div>
            <div className="dept-mini"><b>🧒 {t('dept_pedo')}</b><p className="muted">{t('dept_pedo_d')}</p></div>
          </div>
          <p><Link to="/e-randevu"><button>📆 {t('dept_cta')}</button></Link></p>
        </div>
      </Reveal>
    </div>
  )
}

export function About() {
  const { t } = useTranslation()
  const sections = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ t: t(`about_s${i}_t`), d: t(`about_s${i}_d`) }))
  return (
    <div>
      <div className="info-hero">
        <h1>{t('about_hero')}</h1>
        <p>{t('about_hero_d')}</p>
      </div>
      {sections.map((s, i) => (
        <Reveal key={i} delay={(i % 2) * 80}>
          <div className="card info-section">
            <div className="info-num">{i + 1}</div>
            <div><h3>{s.t}</h3><p>{s.d}</p></div>
          </div>
        </Reveal>
      ))}
      <Reveal>
        <div className="card toolbar">
          <Link to="/triyaj"><button>🩺 {t('about_try')}</button></Link>
          <Link to="/egitim"><button className="ghost">🎓 {t('about_edu')}</button></Link>
          <Link to="/e-randevu"><button className="ghost">📆 {t('about_erd')}</button></Link>
        </div>
      </Reveal>
    </div>
  )
}

export function Appointment() {
  const { t } = useTranslation()
  const params = new URLSearchParams(window.location.search)
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [dept, setDept] = useState(params.get('dept') || '')
  const [complaint, setComplaint] = useState('')
  const [apptDate, setApptDate] = useState('')
  const [kvkk, setKvkk] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setErr('')
    if (!name || !contact || !complaint) return setErr('Ad, iletişim ve şikayet zorunlu.')
    if (!kvkk) return setErr('KVKK onayı gerekli.')
    const r = await insertAppointment({ name, contact, dept, complaint, apptDate })
    if (r.error) return setErr(r.error)
    setDone(true)
  }

  if (done) return (
    <div className="card">
      <h1>✅ {t('appt_sent_t')}</h1>
      <p>{t('appt_sent_d')}</p>
    </div>
  )

  return (
    <div>
      <h1>📝 {t('appt_title')}</h1>
      <div className="card">
        <label>{t('appt_dept')}
          <select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">{t('appt_pick')}</option>
            <option value="restoratif">Restoratif (Dolgu)</option>
            <option value="endodonti">Endodonti (Kanal)</option>
            <option value="periodontoloji">Periodontoloji (Diş Eti)</option>
            <option value="pedodonti">Pedodonti (Çocuk)</option>
          </select>
        </label><br /><br />
        <input placeholder={t('appt_name')} value={name} onChange={(e) => setName(e.target.value)} /><br /><br />
        <input placeholder={t('appt_contact')} value={contact} onChange={(e) => setContact(e.target.value)} /><br /><br />
        <input placeholder="Tercih edilen randevu tarihi" type="date" value={apptDate} onChange={(e) => setApptDate(e.target.value)} /><br /><br />
        <textarea placeholder={t('appt_complaint')} rows="4" cols="40" value={complaint} onChange={(e) => setComplaint(e.target.value)} /><br /><br />
        <label><input type="checkbox" checked={kvkk} onChange={(e) => setKvkk(e.target.checked)} /> {t('appt_kvkk')}</label><br /><br />
        <button onClick={submit}>{t('appt_send')}</button>
        {err && <p className="auth-err">{err}</p>}
        <p className="muted">{t('appt_note')}</p>
        <p><Link to="/e-randevu"><button className="ghost">{t('appt_back')}</button></Link></p>
      </div>
    </div>
  )
}

// ----------------- Giriş ekranları -----------------

function AuthShell({ title, sub, children, footer, tone }) {
  const { t, i18n } = useTranslation()
  return (
    <div className={`auth-wrap ${tone || ''}`}>
      <div className="auth-card">
        <div className="auth-logo">🦷</div>
        <h1>{title}</h1>
        <p className="muted">{sub}</p>
        {children}
        <div className="auth-foot">{footer}</div>
        <div className="auth-lang">
          <button className={i18n.language === 'tr' ? 'lang-on' : 'ghost'} onClick={() => i18n.changeLanguage('tr')}>TR</button>
          <button className={i18n.language === 'en' ? 'lang-on' : 'ghost'} onClick={() => i18n.changeLanguage('en')}>EN</button>
        </div>
        <p className="muted small">© KTÜ Diş Hekimliği — TeleDentist</p>
      </div>
    </div>
  )
}

function LoginForm({ roles, to, register }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()
  const doLogin = async () => {
    setBusy(true); setErr('')
    const r = await login(email, pass, roles)
    setBusy(false)
    if (r.error) return setErr(r.error)
    nav(to)
  }
  return (
    <>
      <input placeholder={t('login_email')} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <input placeholder={t('login_pass')} type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
      {err && <p className="auth-err">⚠️ {err}</p>}
      <button className="btn-full" onClick={doLogin} disabled={busy}>{busy ? t('login_busy') : t('login_go')}</button>
      {register && <p className="muted"><Link to="/kayit">{t('login_no_account')}</Link></p>}
    </>
  )
}

export function PatientLogin() {
  const { t } = useTranslation()
  return (
    <AuthShell
      tone="tone-patient"
      title={`👤 ${t('login_patient_t')}`}
      sub={t('login_patient_s')}
      footer={<Link to="/hekim-girisi">👨‍⚕️ {t('login_doctor_btn')}</Link>}
    >
      <LoginForm roles={['hasta', 'ebeveyn']} to="/hastam" register />
    </AuthShell>
  )
}

export function DoctorLogin() {
  const { t } = useTranslation()
  return (
    <AuthShell
      tone="tone-doctor"
      title={`👨‍⚕️ ${t('login_doctor_t')}`}
      sub={t('login_doctor_s')}
      footer={<Link to="/danisan-girisi">👤 {t('login_patient_btn')}</Link>}
    >
      <LoginForm roles={['hekim']} to="/hekim" />
    </AuthShell>
  )
}

export function AdminLogin() {
  const { t } = useTranslation()
  return (
    <AuthShell
      tone="tone-admin"
      title="🛡️ Süper Admin"
      sub="Bu sayfa yalnızca sistem yöneticisi içindir."
      footer={<Link to="/hekim-girisi">👨‍⚕️ {t('login_doctor_btn')}</Link>}
    >
      <LoginForm roles={['admin']} to="/admin/panel" />
    </AuthShell>
  )
}

export function RegisterRequest() {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [role, setRole] = useState('hasta')
  const [childEmail, setChildEmail] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const submit = async () => {
    setErr(''); setMsg('')
    const r = await registerRequest({ name, email, pass, role, childEmail })
    if (r.error) return setErr(r.error)
    setMsg(t('reg_ok'))
  }
  return (
    <AuthShell title={`📝 ${t('reg_t')}`} sub={t('reg_s')} footer={<Link to="/danisan-girisi">← {t('reg_back')}</Link>}>
      <input placeholder={t('reg_name')} value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder={t('login_email')} value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder={t('login_pass')} type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="hasta">{t('reg_role_h')}</option>
        <option value="ebeveyn">{t('reg_role_p')}</option>
      </select>
      {role === 'ebeveyn' && <input placeholder={t('reg_child')} value={childEmail} onChange={(e) => setChildEmail(e.target.value)} />}
      {err && <p className="auth-err">⚠️ {err}</p>}
      {msg && <p className="auth-ok">✅ {msg}</p>}
      <button className="btn-full" onClick={submit}>{t('reg_send')}</button>
    </AuthShell>
  )
}