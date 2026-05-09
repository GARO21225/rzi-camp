
import React, { useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { auth } from './api'
import Login from './pages/Login'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import MapPage from './pages/MapPage'
import Residences from './pages/Residences'
import Personnel from './pages/Personnel'
import Historique from './pages/Historique'
import Voyages from './pages/Voyages'
import Restauration from './pages/Restauration'
import Maintenance from './pages/Maintenance'
import AuditPage from './pages/AuditPage'
import Evenements from './pages/Evenements'
import Analytics from './pages/Analytics'

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

export default function App() {
  const { token, setUser, logout } = useStore()
  useEffect(() => {
    if (token) auth.me().then(r=>setUser(r.data)).catch(()=>logout())
  },[token])
  return (
    <Routes>
      <Route path="/login" element={<Login/>}/>
      <Route path="/" element={<PrivateRoute><Layout/></PrivateRoute>}>
        <Route index element={<RoleHome/>}/>
        <Route path="carte" element={<MapPage/>}/>
        <Route path="residences" element={<Residences/>}/>
        <Route path="personnel" element={<Personnel/>}/>
        <Route path="historique" element={<Historique/>}/>
        <Route path="voyages" element={<Voyages/>}/>
        <Route path="restauration" element={<Restauration/>}/>
        <Route path="maintenance" element={<Maintenance/>}/>
        <Route path="evenements" element={<Evenements/>}/>
        <Route path="analytics" element={<Analytics/>}/>
        <Route path="audit" element={<AuditPage/>}/>
      </Route>
    </Routes>
  )
}
