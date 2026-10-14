import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { getSession } from '../services/store.js'
import { logout } from '../services/auth.js'

export function Layout({ children }) {
  const { t, i18n } = useTranslation()
  const nav = useNavigate()
  const session = getSession()
  const out = async () => { await logout(); nav('/') }
  return (
    <div className="layout">
      <div className="topbar">
        <span className="topbar-left"><span className="rosette">★</span> Araştırma Üniversitesi</span>
        <span className="spacer" />
        <a href="https://www.ktu.edu.tr" target="_blank" rel="noreferrer">KTÜ Anasayfa</a>
        <Link to="/randevu">İletişim</Link>
        <span className="lang">
          <button className="ghost" onClick={() => i18n.changeLanguage('tr')}>TR</button>
          <button className="ghost" onClick={() => i18n.changeLanguage('en')}>EN</button>
        </span>
      </div>
      <header className="faculty-header">
        <div className="faculty-brand">
          <img src="/ktu-logo.png" alt="KTÜ" className="ktu-logo-xl" />
          <div>
            <div className="faculty-name">KARADENİZ<br />TEKNİK ÜNİVERSİTESİ</div>
            <div className="faculty-sub">Diş Hekimliği Fakültesi</div>
          </div>
          <div className="dhf-badge">DHF</div>
        </div>
        <nav className="faculty-nav">
          <Link to="/e-randevu">E-RANDEVU</Link>
          <Link to="/egitim">EĞİTİM</Link>
          <Link to="/sss">SSS</Link>
          <Link to="/randevu">İLETİŞİM</Link>
        </nav>
      </header>
      <nav className="nav appnav">
        <span className="brand"><span className="brand-mark">TD</span> {t('brand')}</span>
        <Link to="/">{t('nav_home')}</Link>
        <Link to="/teledentistry">{t('nav_about')}</Link>
        <Link to="/e-randevu">E-Randevu</Link>
        <Link to="/egitim">Eğitim</Link>
        <Link to="/sss">SSS</Link>
        <span className="spacer" />
        {session ? (
          <span className="toolbar">
            <Link to={session.role === 'hekim' ? '/hekim' : '/hastam'}>{session.name}</Link>
            <button className="ghost" onClick={out}>Çıkış</button>
          </span>
        ) : (
          <Link to="/giris">{t('nav_login')}</Link>
        )}
      </nav>
      <main>{children}</main>
      <footer className="footer">
        <div><img src="/ktu-logo.png" alt="KTÜ" className="ktu-logo-lg" /></div>
        <div>{t('footer_rights')}</div>
        <div style={{ opacity: 0.8 }}>{t('footer_tubitak')}</div>
      </footer>
    </div>
  )
}
