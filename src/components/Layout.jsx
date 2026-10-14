import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

export function Layout({ children }) {
  const { t, i18n } = useTranslation()
  return (
    <div className="layout">
      {/* Üst şerit: logo + KTÜ anasayfa + dil */}
      <div className="topbar">
        <span className="brand topbrand">
          <span className="brand-mark">🦷</span>
          <span>TeleDentist</span>
        </span>
        <span className="spacer" />
        <a className="ktu-btn" href="https://dentistry.ktu.edu.tr" target="_blank" rel="noreferrer">
          🎓 {t('nav_ktu')}
        </a>
        <span className="lang">
          <button className={i18n.language === 'tr' ? 'lang-on' : 'ghost'} onClick={() => i18n.changeLanguage('tr')}>TR</button>
          <button className={i18n.language === 'en' ? 'lang-on' : 'ghost'} onClick={() => i18n.changeLanguage('en')}>EN</button>
        </span>
      </div>

      {/* Ana menü */}
      <nav className="nav appnav">
        <Link to="/" className="brand-link"><span className="brand-mark">🦷</span> <b>{t('brand')}</b></Link>
        <Link to="/">{t('nav_home')}</Link>
        <div className="dropdown">
          <span className="drop-btn">📅 {t('nav_randevu')}</span>
          <div className="dropdown-menu">
            <Link to="/e-randevu">📆 {t('nav_erandevu')}</Link>
            <Link to="/randevu">☎️ {t('nav_appointment')}</Link>
          </div>
        </div>
        <div className="dropdown">
          <span className="drop-btn">📚 {t('nav_resources')}</span>
          <div className="dropdown-menu">
            <Link to="/teledentistry">🔬 {t('nav_about')}</Link>
            <Link to="/egitim">🎓 {t('nav_education')}</Link>
            <Link to="/sss">❓ {t('nav_faq')}</Link>
          </div>
        </div>
        <span className="spacer" />
        <span className="toolbar">
          <Link to="/hekim-girisi"><button className="btn-enter btn-enter-doc">👨‍⚕️ {t('nav_login_doctor')}</button></Link>
          <Link to="/danisan-girisi"><button className="btn-enter">👤 {t('nav_login_patient')}</button></Link>
        </span>
      </nav>

      <main>{children}</main>

      <footer className="footer">
        <div className="footer-brand"><span className="brand-mark">🦷</span> TeleDentist</div>
        <div>{t('footer_rights')}</div>
        <div className="footer-note">{t('footer_tubitak')}</div>
      </footer>
    </div>
  )
}