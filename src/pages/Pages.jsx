import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Reveal } from '../components/Reveal.jsx'
import { login, registerRequest } from '../services/auth.js'
import { KvkkOnay } from '../components/KvkkOnay.jsx'
import { insertAppointment } from '../services/db.js'
import {
  Logo, User, Stethoscope, Shield, Calendar, Phone, Book, Help, Cap,
  CheckCircle, Alert, Clipboard, FileText, Bell, Clock, Camera, Video,
  DeptRestorative, DeptEndo, DeptPerio, DeptPedo
} from '../components/Icons.jsx'

export function Home() {
  const { t } = useTranslation()

  // Başlık kelimeleri sırayla belirir
  const titleWords = String(t('home_title')).split(' ')
  const features = [
    { Icon: Stethoscope, t: 'Online muayene', d: 'Kamera ve sesli görüşme ile uzak hasta desteği' },
    { Icon: Calendar, t: 'Randevu ve takvim', d: 'Onaylanan randevu hekim takvimine düşer' },
    { Icon: Bell, t: 'Akıllı hatırlatma', d: 'Hastanın seçtiği gün sayısı kadar önceden uyarı' },
    { Icon: Shield, t: 'KVKK uyumlu', d: 'Rol bazlı erişim, veri silinmez, kayıt altında' }
  ]
  const photos = [
    { src: '/img/clinic-smile.jpg', t: 'Klinik ortamında hasta ve hekim', s: 'Dijital ortamda da güvenli iletişim' },
    { src: '/img/clinic-prep.jpg', t: 'Hazırlık ve hijyen', s: 'Her adım kayıt altında' },
    { src: '/img/modern-dentistry.jpg', t: 'Modern diş hekimliği', s: 'Uzaktan değerlendirme desteği' },
    { src: '/img/dental-team.jpg', t: 'Diş hekimliği ekibi', s: 'Kırsal kesimde göçer klinik modeli' }
  ]

  return (
    <div className="landing">
      <div className="landing-inner">
        {/* ---------- GİRİŞ ---------- */}
        <div className="landing-hero">
          <div>
            <div className="landing-badge"><Cap size={15} /> KTÜ Diş Hekimliği Fakültesi</div>
            <h1 className="landing-title">
              {titleWords.map((w, i) => (
                <span className="word" key={i} style={{ animationDelay: `${i * 90}ms` }}>{w}&nbsp;</span>
              ))}
            </h1>
            <p className="landing-sub">{t('home_desc')}</p>

            <div className="landing-cta">
              <Link to="/e-randevu"><span className="btn btn-primary"><Calendar size={17} /> {t('home_cta1')}</span></Link>
              <Link to="/teledentistry"><span className="btn btn-ghost"><Book size={17} /> {t('home_cta2')}</span></Link>
            </div>

            <div className="stat-row">
              <div className="stat"><b>{t('stat1_n')}</b>{t('stat1_l')}</div>
              <div className="stat"><b>{t('stat2_n')}</b>{t('stat2_l')}</div>
              <div className="stat"><b>{t('stat3_n')}</b>{t('stat3_l')}</div>
            </div>

            <span className="scroll-cue"><span className="dot" /> Kaydırarak keşfedin</span>
          </div>

          <div className="collage">
            <div className="collage-main">
              <img src="/img/clinic-smile.jpg" alt="Diş kliniğinde hasta ve hekim" width="1280" height="960" />
            </div>
            <div className="collage-card c1"><Video size={17} /> Görüntülü görüşme</div>
            <div className="collage-card c2"><Shield size={17} /> Güvenli veri</div>
            <div className="collage-card c3"><Clock size={17} /> 7/24 erişim</div>
          </div>
        </div>

        {/* ---------- ÖNE ÇIKANLAR ---------- */}
        <div className="feature-strip">
          {features.map((f) => (
            <div className="feature-chip" key={f.t}>
              <f.Icon size={20} />
              <div><b>{f.t}</b><span>{f.d}</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- İÇERİK ---------- */}
      <div className="landing-inner">
        <Reveal>
          <div className="card">
            <h2><CheckCircle size={20} /> {t('aim_title')}</h2>
            <p>{t('aim_desc')}</p>
          </div>
        </Reveal>

        <Reveal>
          <div className="card">
            <h2><Calendar size={20} /> {t('steps_title')}</h2>
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
            <h2><Stethoscope size={22} /> {t('dept_title')}</h2>
            <div className="grid">
              <div className="dept-mini"><DeptRestorative size={20} /><b>{t('dept_rest')}</b><p className="muted">{t('dept_rest_d')}</p></div>
              <div className="dept-mini"><DeptEndo size={20} /><b>{t('dept_endo')}</b><p className="muted">{t('dept_endo_d')}</p></div>
              <div className="dept-mini"><DeptPerio size={20} /><b>{t('dept_perio')}</b><p className="muted">{t('dept_perio_d')}</p></div>
              <div className="dept-mini"><DeptPedo size={20} /><b>{t('dept_pedo')}</b><p className="muted">{t('dept_pedo_d')}</p></div>
            </div>
            <p><Link to="/e-randevu"><button><Calendar size={16} /> {t('dept_cta')}</button></Link></p>
          </div>
        </Reveal>

        {/* ---------- FOTOĞRAFLAR ---------- */}
        <Reveal>
          <div className="card">
            <h2><Camera size={20} /> Kliniğimizden</h2>
            <div className="photo-grid">
              {photos.map((p) => (
                <figure className="photo-card" key={p.src}>
                  <img src={p.src} alt={p.t} loading="lazy" width="1280" height="853" />
                  <figcaption>{p.t}<small>{p.s}</small></figcaption>
                </figure>
              ))}
            </div>

            <details className="credits">
              <summary>Görsel Kaynakları ve Lisanslar</summary>
              <ul>
                <li>Klinik ve ekip fotoğrafları: ABD Hava/Deniz Kuvvetleri — <b>Kamu Malı (Public Domain)</b></li>
                <li>“Modern Dentistry in Practice”: Jameswasswa — <b>CC BY-SA 4.0</b></li>
                <li>Tüm görseller Wikimedia Commons’tan alınmıştır; künyeler <code>public/img/CREDITS.txt</code> dosyasındadır.</li>
              </ul>
            </details>
          </div>
        </Reveal>
      </div>
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
          <Link to="/triyaj"><button><Clipboard size={16} /> {t('about_try')}</button></Link>
          <Link to="/egitim"><button className="ghost"><Cap size={16} /> {t('about_edu')}</button></Link>
          <Link to="/e-randevu"><button className="ghost"><Calendar size={16} /> {t('about_erd')}</button></Link>
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
  const [online, setOnline] = useState(false)
  const [kvkk, setKvkk] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setErr('')
    if (!name || !contact || !complaint) return setErr('Ad, iletişim ve şikayet zorunlu.')
    if (!kvkk) return setErr('KVKK onayı gerekli.')
    const r = await insertAppointment({ name, contact, dept, complaint, apptDate, online })
    if (r.error) return setErr(r.error)
    setDone(true)
  }

  if (done) return (
    <div className="card">
      <h1><CheckCircle size={24} /> {t('appt_sent_t')}</h1>
      <p>{t('appt_sent_d')}</p>
    </div>
  )

  return (
    <div>
      <h1><FileText size={24} /> {t('appt_title')}</h1>
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
        <label><input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> Online (görüntülü) görüşme istiyorum — kırsal/uzak hastalar için</label><br /><br />
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

function AuthShell({ title, sub, children, footer, tone, icon }) {
  const { t, i18n } = useTranslation()
  const I = icon || User
  return (
    <div className={`auth-wrap ${tone || ''}`}>
      <div className="auth-card">
        <div className="auth-logo"><Logo size={54} /></div>
        <h1><I size={22} /> {title}</h1>
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
  // Kullanıcı adıyla giriş çözümlenemediğinde: alanı e-posta için serbest bırak
  const ePostaIcin = err && !email.includes('@')
  return (
    <>
      <input
        placeholder={ePostaIcin ? 'E-posta adresiniz (örn. ad.soyad@ornek.com)' : 'Kullanıcı adı veya e-posta'}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="username"
        inputMode="email"
      />
      <input placeholder={t('login_pass')} type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
      {err && <p className="auth-err"><Alert size={15} /> {err}</p>}
      <button className="btn-full" onClick={doLogin} disabled={busy}>{busy ? t('login_busy') : t('login_go')}</button>
      {register && <p className="muted"><Link to="/kayit">{t('login_no_account')}</Link></p>}
    </>
  )
}

export function PatientLogin() {
  const { t } = useTranslation()
  const [yardim, setYardim] = useState(false)
  return (
    <AuthShell
      tone="tone-patient"
      icon={User}
      title={t('login_patient_t')}
      sub={t('login_patient_s')}
      footer={<Link to="/hekim-girisi"><Stethoscope size={16} /> {t('login_doctor_btn')}</Link>}
    >
      <LoginForm roles={['hasta', 'ebeveyn']} to="/hastam" register />
      <button
        className="ghost tiny"
        onClick={() => setYardim(!yardim)}
        style={{ marginTop: 10 }}
      >
        {yardim ? 'Yardımı kapat' : 'Giriş yapamıyorum'}
      </button>
      {yardim && (
        <div className="kurulum-notu" style={{ marginTop: 10 }}>
          <Alert size={15} />
          <div>
            <p><b>"Bu kullanıcı adı bulunamadı" hatası alıyorsanız:</b></p>
            <p>
              Kayıt talebiniz gönderilmiş ama henüz onaylanmamış olabilir.
              Hekiminiz onayladığında hesabınız açılır ve giriş yapabilirsiniz.
            </p>
            <p>
              Onaylandıysa ve yine giremiyorsanız, klinikten <b>e-posta adresinizi ve
              geçici şifrenizi</b> isteyin. Hekiminiz giriş bilgilerinizi yenileyebilir.
            </p>
            <p className="muted">E-posta adresinizi hatırlamıyorsanız hekiminize başvurun.</p>
          </div>
        </div>
      )}
    </AuthShell>
  )
}

export function DoctorLogin() {
  const { t } = useTranslation()
  return (
    <AuthShell
      tone="tone-doctor"
      icon={Stethoscope}
      title={t('login_doctor_t')}
      sub={t('login_doctor_s')}
      footer={<Link to="/danisan-girisi"><User size={16} /> {t('login_patient_btn')}</Link>}
    >
      <LoginForm roles={['hekim', 'admin']} to="/hekim" />
    </AuthShell>
  )
}

export function AdminLogin() {
  const { t } = useTranslation()
  return (
    <AuthShell
      tone="tone-admin"
      icon={Shield}
      title="Süper Admin"
      sub="Bu sayfa yalnızca sistem yöneticisi içindir."
      footer={<Link to="/hekim-girisi"><Stethoscope size={16} /> {t('login_doctor_btn')}</Link>}
    >
      <LoginForm roles={['admin']} to="/admin/panel" />
    </AuthShell>
  )
}

// Sekreter / diş teknisyeni girişi
export function StaffLogin() {
  const { t } = useTranslation()
  return (
    <AuthShell
      tone="tone-doctor"
      icon={Stethoscope}
      title="Sekreter / Diş Teknisyeni Girişi"
      sub="Randevu ve hasta işlemleri için personel girişi."
      footer={<Link to="/hekim-girisi"><Stethoscope size={16} /> {t('login_doctor_btn')}</Link>}
    >
      <LoginForm roles={['sekreter', 'teknisyen']} to="/sekreter" />
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
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [kvkk, setKvkk] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [mesajEk, setMesajEk] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)

  const submit = async () => {
    setErr(''); setMsg('')
    // Düğme zaten pasif ama Enter tuşuyla atlatılmasın diye tekrar doğrulanır
    if (!kvkk) {
      setErr('KVKK aydınlatma metnini okuduğunuzu onaylamadan kayıt talebi gönderemezsiniz.')
      return
    }
    setGonderiliyor(true)
    try {
      const r = await registerRequest({ name, email, pass, role, childEmail, phone, note, kvkkOnay: kvkk })
      if (r.error) { setErr(r.error); return }
      // Sunucuya ulaşılmadıysa "başarı" gibi görünmemeli — uyarı gösterilir
      if (r.local) { setMsg(r.uyari || 'Talebiniz kaydedildi ancak klinik paneline ulaşmadı.'); return }
      setMsg(t('reg_ok'))
      // Kullanıcı adını hemen göster: sonradan arayıp bulamamasın
      if (r.username) setMesajEk(`Giriş için kullanıcı adınız: ${r.username} (e-posta: ${email})`)
    } catch {
      setErr('Bağlantı sorunu oluştu. İnternetinizi kontrol edip tekrar deneyin.')
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <AuthShell icon={FileText} title={t('reg_t')} sub={t('reg_s')} footer={<Link to="/danisan-girisi">← {t('reg_back')}</Link>}>
      <input placeholder={t('reg_name')} value={name} onChange={(e) => setName(e.target.value)} />
      <input placeholder={t('login_email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Telefon (isteğe bağlı)" value={phone} onChange={(e) => setPhone(e.target.value)} />
      <input placeholder={t('login_pass')} type="password" value={pass} onChange={(e) => setPass(e.target.value)} />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="hasta">{t('reg_role_h')}</option>
        <option value="ebeveyn">{t('reg_role_p')}</option>
      </select>
      {role === 'ebeveyn' && (
        <input
          placeholder="Çocuğunuzun e-posta adresi (varsa)"
          type="email"
          value={childEmail}
          onChange={(e) => setChildEmail(e.target.value)}
        />
      )}
      <textarea
        rows={2}
        placeholder="Şikâyetiniz veya eklemek istedikleriniz (isteğe bağlı)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      {/* KVKK: metin okunmadan ve onaylanmadan talep gönderilemez */}
      <KvkkOnay onayli={kvkk} degis={setKvkk} />

      {err && <p className="auth-err"><Alert size={15} /> {err}</p>}
      {msg && <p className="auth-ok"><CheckCircle size={15} /> {msg}</p>}
      {mesajEk && <p className="auth-ok"><CheckCircle size={15} /> {mesajEk}</p>}
      <p className="muted auth-not">
        Hesabınız talebiniz üzerine hekiminiz tarafından açılır. Şifrenizi kimseyle paylaşmayın.
      </p>
      <button className="btn-full" onClick={submit} disabled={gonderiliyor || !kvkk}>
        {gonderiliyor ? 'Gönderiliyor...' : kvkk ? t('reg_send') : 'Önce KVKK metnini onaylayın'}
      </button>
    </AuthShell>
  )
}