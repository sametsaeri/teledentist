import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { getSession } from '../services/store.js'

export function Layout({ children }) {
  const { t, i18n } = useTranslation()
  const session = getSession()
  return (
    <div className="layout">
      <div className="topbar">
        <span className="topbar-left"><span className="rosette">★</span> Araştırma Üniversitesi</span>
        <span className="spacer" />
        <a href="https://www.ktu.edu.tr" target="_blank" rel="noreferrer">KTÜ Anasayfa</a>
        <Link to="/egitim">Sanal Kampüs</Link>
        <Link to="/sss">İletişim</Link>
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
          <Link to="/triyaj">TRİYAJ</Link>
          <Link to="/hastam">DİŞLERİM</Link>
          <Link to="/hekim">HEKİM</Link>
          <Link to="/hijyen">HİJYEN</Link>
          <Link to="/egitim">EĞİTİM</Link>
        </nav>
      </header>
      <nav className="nav appnav">
        <span className="brand"><span className="brand-mark">TD</span> {t('brand')}</span>
        <Link to="/">{t('nav_home')}</Link>
        <Link to="/e-randevu">E-Randevu</Link>
        <Link to="/hastam">Dişlerim</Link>
        <Link to="/hekim">Hekim</Link>
        <Link to="/triyaj">Triyaj</Link>
        <Link to="/video">Video</Link>
        <Link to="/kampanya">Kampanya</Link>
        <span className="spacer" />
        <Link to="/giris">{session ? session.name : t('nav_login')}</Link>
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
