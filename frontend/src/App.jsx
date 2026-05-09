import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { useInactivityLogout } from './hooks/useInactivityLogout'
import { auth } from './api'
import Login from './pages/Login'
import { PWAInstallButton } from './components/PWAInstall'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import MapPage from './pages/MapPage'
import Residences from './pages/Residences'
import Personnel from './pages/Personnel'
import Evenements from './pages/Evenements'
import Historique from './pages/Historique'
import Voyages from './pages/Voyages'
import Restauration from './pages/Restauration'
import Maintenance from './pages/Maintenance'
import Analytics from './pages/Analytics'
import AuditPage from './pages/AuditPage'

function PrivateRoute({ children }) {
  const token = useStore(s => s.token)
  return token ? children : <Navigate to="/login" replace />
}

function RoleHome() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  if (['agent', 'technicien', 'restauration', 'resto_voyages'].includes(role)) {
    return <Navigate to="/carte" replace />
  }
  return <Dashboard />
}

function InactivityWarning() {
  const [show, setShow] = useState(false)
  const [secs, setSecs] = useState(60)

  useEffect(() => {
    const handler = (e) => {
      setSecs(e.detail?.remaining || 60)
      setShow(true)
    }
    window.addEventListener('inactivity-warning', handler)
    return () => window.removeEventListener('inactivity-warning', handler)
  }, [])

  if (!show) return null
  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      background: '#1e3a8a', color: '#fff', padding: '12px 20px', borderRadius: 12,
      boxShadow: '0 8px 32px rgba(30,58,138,.4)', zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 12, fontSize: 13,
      maxWidth: 'calc(100vw - 32px)', animation: 'slideUp .3s ease'
    }}>
      <span>⏱️ Session expire dans <b>{secs}s</b></span>
      <button
        onClick={() => { setShow(false); document.dispatchEvent(new Event('mousemove')) }}
        style={{ background: '#f0a500', color: '#000', border: 'none', padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
        Rester connecté
      </button>
    </div>
  )
}

function InactivityGuard() {
  useInactivityLogout()
  return null
}

export default function App() {
  const { token, setUser, logout } = useStore()

  useEffect(() => {
    if (token) auth.me().then(r => setUser(r.data)).catch(() => logout())
  }, [token])

  return (
    <>
      <InactivityWarning />
      <PWAInstallButton />
      <InactivityGuard />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<RoleHome />} />
          <Route path="carte" element={<MapPage />} />
          <Route path="residences" element={<Residences />} />
          <Route path="personnel" element={<Personnel />} />
          <Route path="evenements" element={<Evenements />} />
          <Route path="historique" element={<Historique />} />
          <Route path="voyages" element={<Voyages />} />
          <Route path="restauration" element={<Restauration />} />
          <Route path="maintenance" element={<Maintenance />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="audit" element={<AuditPage />} />
        </Route>
        {/* Catch-all: redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
