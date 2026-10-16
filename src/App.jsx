import { BrowserRouter, Routes, Route, useParams, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout.jsx'
import { PanelLayout } from './components/PanelLayout.jsx'
import { Home, About, Appointment, PatientLogin, DoctorLogin, AdminLogin, StaffLogin, RegisterRequest } from './pages/Pages.jsx'
import { DoctorList, DoctorPatient } from './pages/Portal.jsx'
import { PatientPanel } from './pages/PatientPanel.jsx'
import { Triage, Hygiene, Anxiety, PhotoReview, Report } from './pages/Clinical.jsx'
import { Satisfaction, Education, Reminders, Campaigns, Consultation, Faq } from './pages/Extra.jsx'
import { VideoVisit } from './pages/VideoVisit.jsx'
import { ERandevu } from './pages/ERandevu.jsx'
import { AdminPanel } from './pages/Admin.jsx'
import { AccountSettings } from './pages/Account.jsx'
import { StaffPanel } from './pages/StaffPanel.jsx'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { currentUser } from './services/auth.js'

// Hangi rol hangi giriş ekranına gitsin
function loginFor(roles) {
  if (roles?.includes('admin')) return '/admin'
  if (roles?.includes('hekim')) return '/hekim-girisi'
  if (roles?.includes('sekreter') || roles?.includes('teknisyen')) return '/personel-girisi'
  return '/danisan-girisi'
}

function Require({ roles, children }) {
  const u = currentUser()
  if (!u) return <Navigate to={loginFor(roles)} replace />
  if (u.role !== 'admin' && roles && !roles.includes(u.role)) {
    return (
      <div className="card auth-card">
        <h1>Yetkisiz</h1>
        <p className="muted">Bu bölüm {roles.join(' / ')} rolüne özeldir.</p>
        <a className="btn btn-primary" href="/">Siteye Dön</a>
      </div>
    )
  }
  return children
}

function Public({ children }) {
  return <Layout>{children}</Layout>
}

function Panel({ roles, children }) {
  return (
    <Require roles={roles}>
      <PanelLayout>{children}</PanelLayout>
    </Require>
  )
}

function ReportWrapper() {
  const { id } = useParams()
  return <Report patientId={id} />
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
        {/* --- Tanıtım sitesi --- */}
        <Route path="/" element={<Public><Home /></Public>} />
        <Route path="/teledentistry" element={<Public><About /></Public>} />
        <Route path="/e-randevu" element={<Public><ERandevu /></Public>} />
        <Route path="/randevu" element={<Public><Appointment /></Public>} />
        <Route path="/egitim" element={<Public><Education /></Public>} />
        <Route path="/sss" element={<Public><Faq /></Public>} />

        {/* --- Giriş ekranları (herkese açık, panel menüsü yok) --- */}
        <Route path="/danisan-girisi" element={<PatientLogin />} />
        <Route path="/hekim-girisi" element={<DoctorLogin />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/personel-girisi" element={<StaffLogin />} />
        <Route path="/kayit" element={<RegisterRequest />} />
        <Route path="/giris" element={<Navigate to="/danisan-girisi" replace />} />

        {/* --- Danışan paneli --- */}
        <Route path="/hastam" element={<Panel roles={['hasta', 'ebeveyn', 'hekim', 'admin']}><PatientPanel /></Panel>} />

        {/* --- Hekim paneli --- */}
        <Route path="/hekim" element={<Panel roles={['hekim']}><DoctorList /></Panel>} />
        <Route path="/hekim/hasta/:id" element={<Panel roles={['hekim']}><DoctorPatient /></Panel>} />
        <Route path="/rapor/:id" element={<Panel roles={['hekim']}><ReportWrapper /></Panel>} />
        <Route path="/konsultasyon" element={<Panel roles={['hekim']}><Consultation /></Panel>} />

        {/* --- Süper admin paneli --- */}
        <Route path="/admin/panel" element={<Panel roles={['admin']}><AdminPanel /></Panel>} />
        <Route path="/sekreter" element={<Panel roles={['sekreter', 'teknisyen']}><StaffPanel /></Panel>} />
        <Route path="/hesap" element={<Panel roles={['admin', 'hekim', 'hasta', 'ebeveyn', 'sekreter', 'teknisyen']}><AccountSettings /></Panel>} />

        {/* --- Yalnızca hasta formları (hekim bunları doldurmaz) --- */}
        <Route path="/triyaj" element={<Panel roles={['hasta', 'ebeveyn']}><Triage /></Panel>} />
        <Route path="/hijyen" element={<Panel roles={['hasta', 'ebeveyn']}><Hygiene /></Panel>} />
        <Route path="/anksiyete" element={<Panel roles={['hasta', 'ebeveyn']}><Anxiety /></Panel>} />
        <Route path="/on-degerlendirme" element={<Panel roles={['hasta', 'ebeveyn']}><PhotoReview /></Panel>} />
        <Route path="/kampanya" element={<Panel roles={['hasta', 'ebeveyn']}><Campaigns /></Panel>} />
        <Route path="/memnuniyet" element={<Panel roles={['hasta', 'ebeveyn']}><Satisfaction /></Panel>} />

        {/* --- Ortak --- */}
        <Route path="/video" element={<Panel roles={['hasta', 'ebeveyn', 'hekim']}><VideoVisit /></Panel>} />
        <Route path="/hatirlatma" element={<Panel roles={['hekim', 'sekreter']}><Reminders /></Panel>} />

        <Route path="*" element={<Public><Home /></Public>} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}