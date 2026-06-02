import React, { useState } from 'react'
import { Outlet, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import AIFab from './AIFab'
import MobileNav, { Drawer } from './MobileNav'
import { useStore } from '../store/useStore'
import { useInactivityLogout } from '../hooks/useInactivityLogout'
import { useTheme } from '../hooks/useTheme'

function InactivityWarning() {
  const [show, setShow] = useState(false)
  const [secs, setSecs] = useState(60)
  React.useEffect(() => {
    const h = (e) => { setSecs(e.detail?.remaining || 60); setShow(true) }
    window.addEventListener('inactivity-warning', h)
    return () => window.removeEventListener('inactivity-warning', h)
  }, [])
  if (!show) return null
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      background: 'var(--copper-600)', color: 'white', padding: '12px 20px', borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,59,122,.4)', zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 12, fontSize: 13,
    }}>
      ⏱️ Déconnexion dans <b>{secs}s</b>
      <button onClick={() => { setShow(false); document.dispatchEvent(new Event('mousemove')) }}
        style={{ background: 'var(--gold-500)', color: 'var(--copper-900)', border: 'none', padding: '5px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>
        Rester
      </button>
    </div>
  )
}

function PrivateRoute({ children }) {
  const token = useStore((s) => s.token)
  const location = useLocation()
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />
  return children
}

function RoleHome() {
  const role = useStore((s) => s.role)
  const mapRoles = ['agent', 'restauration', 'technicien', 'menage']
  if (mapRoles.includes(role)) return <Navigate to="/jumeau" replace />
  return <Outlet />
}

export default function Layout() {
  useInactivityLogout()
  useTheme()
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const token = useStore((s) => s.token)
  if (!token) return <Navigate to="/login" replace />

  // Extraire la "view" courante depuis le pathname
  const currentView = location.pathname.replace(/^\//, '') || 'dashboard'

  const handleNavigate = (viewId) => {
    navigate(`/${viewId}`)
    setDrawerOpen(false)
  }

  return (
    <div className="app">
      <Sidebar />
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Sidebar inDrawer onNavigate={handleNavigate} currentView={currentView} />
      </Drawer>
      <div className="main">
        <Topbar onToggleCopilot={() => setCopilotOpen(!copilotOpen)} onMenu={() => setDrawerOpen(true)} />
        <PrivateRoute>
          <RoleHome />
        </PrivateRoute>
        <InactivityWarning />
        <AIFab open={copilotOpen} onToggle={() => setCopilotOpen(!copilotOpen)} />
      </div>
      <MobileNav current={currentView} onNavigate={handleNavigate} onMenu={() => setDrawerOpen(true)} />

      <style>{`
        .app { display: grid; grid-template-columns: 248px 1fr; min-height: 100dvh; }
        .main { display: flex; flex-direction: column; min-width: 0; }
        main { flex: 1; padding-bottom: env(safe-area-inset-bottom, 0); }
        @media (max-width: 1024px) {
          .app { grid-template-columns: 1fr; }
          main { padding-bottom: 80px; }
        }
      `}</style>
    </div>
  )
}
