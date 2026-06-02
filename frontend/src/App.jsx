import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Login from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const DigitalTwin = lazy(() => import('./pages/DigitalTwin'))
const Residences = lazy(() => import('./pages/Residences'))
const Maintenance = lazy(() => import('./pages/Maintenance'))
const Restauration = lazy(() => import('./pages/Restauration'))
const QRScan = lazy(() => import('./pages/QRScan'))
const Personnel = lazy(() => import('./pages/Personnel'))
const Evenements = lazy(() => import('./pages/Evenements'))
const Induction = lazy(() => import('./pages/Induction'))
const Presences = lazy(() => import('./pages/Presences'))
const Boutique = lazy(() => import('./pages/Boutique'))
const BoutiquePOS = lazy(() => import('./pages/BoutiquePOS'))
const Voyages = lazy(() => import('./pages/Voyages'))
const Rotations = lazy(() => import('./pages/Rotations'))
const Reservations = lazy(() => import('./pages/Reservations'))
const Audit = lazy(() => import('./pages/Audit'))
const Workflows = lazy(() => import('./pages/Workflows'))
const CentreOperationnel = lazy(() => import('./pages/CentreOperationnel'))
const Status = lazy(() => import('./pages/Status'))
const Demandes = lazy(() => import('./pages/Demandes'))
const Annuaire = lazy(() => import('./pages/Annuaire'))
const Rapports = lazy(() => import('./pages/Rapports'))
const Historique = lazy(() => import('./pages/Historique'))
const MonCompte = lazy(() => import('./pages/MonCompte'))
const Analytics = lazy(() => import('./pages/Analytics'))
const CopiloteIA = lazy(() => import('./pages/CopiloteIA'))

const Loader = () => (
  <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-3)', fontSize: 32 }}>⏳</div>
)

export default function App() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/jumeau" element={<DigitalTwin />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/copilote" element={<CopiloteIA />} />
          <Route path="/residences" element={<Residences />} />
          <Route path="/maintenance" element={<Maintenance />} />
          <Route path="/restauration" element={<Restauration />} />
          <Route path="/qr" element={<QRScan />} />
          <Route path="/personnel" element={<Personnel />} />
          <Route path="/evenements" element={<Evenements />} />
          <Route path="/induction" element={<Induction />} />
          <Route path="/presences" element={<Presences />} />
          <Route path="/boutique" element={<Boutique />} />
          <Route path="/pos" element={<BoutiquePOS />} />
          <Route path="/voyages" element={<Voyages />} />
          <Route path="/rotations" element={<Rotations />} />
          <Route path="/reservations" element={<Reservations />} />
          <Route path="/audit" element={<Audit />} />
          <Route path="/workflows" element={<Workflows />} />
          <Route path="/centre" element={<CentreOperationnel />} />
          <Route path="/status" element={<Status />} />
          <Route path="/demandes" element={<Demandes />} />
          <Route path="/annuaire" element={<Annuaire />} />
          <Route path="/rapports" element={<Rapports />} />
          <Route path="/historique" element={<Historique />} />
          <Route path="/compte" element={<MonCompte />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
