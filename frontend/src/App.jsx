import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { useInactivityLogout } from './hooks/useInactivityLogout'
import { auth } from './api'
import Login from './pages/Login'
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
  const token = useStore(s=>s.token)
  return token ? children : <Navigate to="/login" replace/>
}

function RoleHome() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  if (['agent','technicien','restauration'].includes(role)) return <Navigate to="/carte" replace/>
  return <Dashboard/>
}

// Inactivity warning component
function InactivityWarning() {
  const [show, setShow] = useState(false)
  const [remaining, setRemaining] = useState(60)
  useEffect(() => {
    const handler = (e) => {
      setRemaining(e.detail.remaining)
      setShow(true)
      setTimeout(() => setShow(false), 30000)
    }
    window.addEventListener('inactivity-warning', handler)
    return () => window.removeEventListener('inactivity-warning', handler)
  }, [])
  if (!show) return null
  return (
    <div style={{
      position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
      background:'#1e3a8a', color:'#fff', padding:'12px 20px', borderRadius:12,
      boxShadow:'0 8px 32px rgba(30,58,138,.4)', zIndex:9999,
      display:'flex', alignItems:'center', gap:12, fontSize:13, maxWidth:'90vw'
    }}>
      <span>⏱️ Déconnexion dans <b>{remaining}s</b></span>
      <button onClick={() => { setShow(false); window.dispatchEvent(new Event('mousemove')) }}
        style={{ background:'#f0a500', color:'#000', border:'none', padding:'4px 12px', borderRadius:6, cursor:'pointer', fontWeight:700, fontSize:12 }}>
        Rester
      </button>
    </div>
  )
}

// Hook wrapper component
function InactivityGuard() {
  useInactivityLogout()
  return null
}

export default function App() {
  const { token, setUser, logout } = useStore()
  useEffect(() => {
    if (token) auth.me().then(r=>setUser(r.data)).catch(()=>logout())
  }, [token])

  return (
    <>
      <InactivityWarning/>
      <InactivityGuard/>
      <Routes>
        <Route path="/login" element={<Login/>}/>
        <Route path="/" element={<PrivateRoute><Layout/></PrivateRoute>}>
          <Route index element={<RoleHome/>}/>
          <Route path="carte" element={<MapPage/>}/>
          <Route path="residences" element={<Residences/>}/>
          <Route path="personnel" element={<Personnel/>}/>
          <Route path="evenements" element={<Evenements/>}/>
          <Route path="historique" element={<Historique/>}/>
          <Route path="voyages" element={<Voyages/>}/>
          <Route path="restauration" element={<Restauration/>}/>
          <Route path="maintenance" element={<Maintenance/>}/>
          <Route path="analytics" element={<Analytics/>}/>
          <Route path="audit" element={<AuditPage/>}/>
        </Route>
        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </>
  )
}
