import { BrowserRouter, Routes, Route, useParams, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout.jsx'
import { PanelLayout } from './components/PanelLayout.jsx'
import { Home, About, Appointment, Login, Dashboard } from './pages/Pages.jsx'
import { DoctorList, DoctorPatient, PatientPanel } from './pages/Portal.jsx'
import { Triage, Hygiene, Anxiety, PhotoReview, Report } from './pages/Clinical.jsx'
import { Satisfaction, Education, VideoVisit, Reminders, Campaigns, Consultation, Faq } from './pages/Extra.jsx'
import { ERandevu } from './pages/ERandevu.jsx'
import { AdminPanel } from './pages/Admin.jsx'
import { currentUser } from './services/auth.js'

function Require({ roles, children }) {
  const u = currentUser()
  if (!u) return <Navigate to="/giris" replace />
  if (u.role !== 'admin' && roles && !roles.includes(u.role)) return <div className="card"><h1>Yetkisiz</h1><p>Bu panel {roles.join('/')} rolüne özeldir.</p></div>
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
    <BrowserRouter>
      <Routes>
        <Route path="/giris" element={<Login />} />
        <Route path="/" element={<Public><Home /></Public>} />
        <Route path="/teledentistry" element={<Public><About /></Public>} />
        <Route path="/e-randevu" element={<Public><ERandevu /></Public>} />
        <Route path="/randevu" element={<Public><Appointment /></Public>} />
        <Route path="/egitim" element={<Public><Education /></Public>} />
        <Route path="/sss" element={<Public><Faq /></Public>} />
        <Route path="/panel" element={<Panel roles={['hekim']}><Dashboard /></Panel>} />
        <Route path="/hastam" element={<Panel roles={['hasta', 'ebeveyn']}><PatientPanel /></Panel>} />
        <Route path="/hekim" element={<Panel roles={['hekim']}><DoctorList /></Panel>} />
        <Route path="/hekim/hasta/:id" element={<Panel roles={['hekim']}><DoctorPatient /></Panel>} />
        <Route path="/triyaj" element={<Panel roles={['hasta', 'ebeveyn', 'hekim']}><Triage /></Panel>} />
        <Route path="/hijyen" element={<Panel roles={['hasta', 'ebeveyn', 'hekim']}><Hygiene /></Panel>} />
        <Route path="/anksiyete" element={<Panel roles={['hasta', 'ebeveyn', 'hekim']}><Anxiety /></Panel>} />
        <Route path="/on-degerlendirme" element={<Panel roles={['hasta', 'ebeveyn', 'hekim']}><PhotoReview /></Panel>} />
        <Route path="/rapor/:id" element={<Panel roles={['hekim']}><ReportWrapper /></Panel>} />
        <Route path="/memnuniyet" element={<Panel roles={['hasta', 'ebeveyn']}><Satisfaction /></Panel>} />
        <Route path="/video" element={<Panel roles={['hasta', 'ebeveyn', 'hekim']}><VideoVisit /></Panel>} />
        <Route path="/hatirlatma" element={<Panel roles={['hekim']}><Reminders /></Panel>} />
        <Route path="/kampanya" element={<Panel roles={['hasta', 'ebeveyn']}><Campaigns /></Panel>} />
        <Route path="/konsultasyon" element={<Panel roles={['hekim']}><Consultation /></Panel>} />
        <Route path="/admin" element={<Panel roles={['admin']}><AdminPanel /></Panel>} />
      </Routes>
    </BrowserRouter>
  )
}
