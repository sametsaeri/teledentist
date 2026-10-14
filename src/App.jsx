import { BrowserRouter, Routes, Route, useParams, Navigate } from 'react-router-dom'
import { Layout } from './components/Layout.jsx'
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

function ReportWrapper() {
  const { id } = useParams()
  return <Report patientId={id} />
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/teledentistry" element={<About />} />
          <Route path="/randevu" element={<Appointment />} />
          <Route path="/giris" element={<Login />} />
          <Route path="/panel" element={<Require roles={['hekim']}><Dashboard /></Require>} />
          <Route path="/hastam" element={<Require roles={['hasta', 'ebeveyn']}><PatientPanel /></Require>} />
          <Route path="/hekim" element={<Require roles={['hekim']}><DoctorList /></Require>} />
          <Route path="/hekim/hasta/:id" element={<Require roles={['hekim']}><DoctorPatient /></Require>} />
          <Route path="/triyaj" element={<Triage />} />
          <Route path="/hijyen" element={<Hygiene />} />
          <Route path="/anksiyete" element={<Anxiety />} />
          <Route path="/on-degerlendirme" element={<PhotoReview />} />
          <Route path="/rapor/:id" element={<ReportWrapper />} />
          <Route path="/memnuniyet" element={<Satisfaction />} />
          <Route path="/egitim" element={<Education />} />
          <Route path="/video" element={<VideoVisit />} />
          <Route path="/hatirlatma" element={<Reminders />} />
          <Route path="/kampanya" element={<Campaigns />} />
          <Route path="/konsultasyon" element={<Consultation />} />
          <Route path="/sss" element={<Faq />} />
          <Route path="/e-randevu" element={<ERandevu />} />
          <Route path="/admin" element={<Require roles={['admin']}><AdminPanel /></Require>} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
