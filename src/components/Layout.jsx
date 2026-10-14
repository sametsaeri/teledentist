import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Logo, Home, Calendar, Phone, Book, Help, Cap, User, Stethoscope } from './Icons.jsx'

export function Layout({ children }) {
  const { t, i18n } = useTranslation()
  return (
    <div className="layout">
      {/* Üst şerit: logo + KTÜ anasayfa + dil */}
      <div className="topbar">
        <span className="brand topbrand">
          <Logo size={26} />
          <span>TeleDentist</span>
        </span>
        <span className="spacer" />
        <a className="ktu-btn" href="https://dentistry.ktu.edu.tr" target="_blank" rel="noreferrer">
          <Cap size={15} /> {t('nav_ktu')}
        </a>
        <span className="lang">
          <button className={i18n.language === 'tr' ? 'lang-on' : 'ghost'} onClick={() => i18n.changeLanguage('tr')}>TR</button>
          <button className={i18n.language === 'en' ? 'lang-on' : 'ghost'} onClick={() => i18n.changeLanguage('en')}>EN</button>
        </span>
      </div>

      {/* Ana menü */}
      <nav className="nav appnav">
        <Link to="/" className="brand-link"><Logo size={26} /> <b>{t('brand')}</b></Link>
        <Link to="/"><Home size={16} /> {t('nav_home')}</Link>
        <div className="dropdown">
          <span className="drop-btn"><Calendar size={16} /> {t('nav_randevu')}</span>
          <div className="dropdown-menu">
            <Link to="/e-randevu"><Calendar size={15} /> {t('nav_erandevu')}</Link>
            <Link to="/randevu"><Phone size={15} /> {t('nav_appointment')}</Link>
          </div>
        </div>
        <div className="dropdown">
          <span className="drop-btn"><Book size={16} /> {t('nav_resources')}</span>
          <div className="dropdown-menu">
            <Link to="/teledentistry"><Book size={15} /> {t('nav_about')}</Link>
            <Link to="/egitim"><Cap size={15} /> {t('nav_education')}</Link>
            <Link to="/sss"><Help size={15} /> {t('nav_faq')}</Link>
          </div>
        </div>
        <span className="spacer" />
        <span className="toolbar">
          <Link to="/hekim-girisi"><button className="btn-enter btn-enter-doc"><Stethoscope size={16} /> {t('nav_login_doctor')}</button></Link>
          <Link to="/danisan-girisi"><button className="btn-enter"><User size={16} /> {t('nav_login_patient')}</button></Link>
        </span>
      </nav>

      <main>{children}</main>

      <footer className="footer">
        <div className="footer-brand"><Logo size={22} /> TeleDentist</div>
        <div>{t('footer_rights')}</div>
        <div className="footer-note">{t('footer_tubitak')}</div>
      </footer>
    </div>
  )
}