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
import Voyages from './pages/Voyages'
import Restauration from './pages/Restauration'
import Maintenance from './pages/Maintenance'
import AuditPage from './pages/AuditPage'

function PrivateRoute({ children }) {
  const token = useStore(s=>s.token)
  return token ? children : <Navigate to="/login" replace/>
}

export default function App() {
  const { token, setUser, logout } = useStore()
  useEffect(()=>{
    if (token) auth.me().then(r=>setUser(r.data)).catch(()=>logout())
  },[token])
  return (
    <Routes>
      <Route path="/login" element={<Login/>}/>
      <Route path="/" element={<PrivateRoute><Layout/></PrivateRoute>}>
        <Route index element={<Dashboard/>}/>
        <Route path="carte" element={<MapPage/>}/>
        <Route path="residences" element={<Residences/>}/>
        <Route path="personnel" element={<Personnel/>}/>
        <Route path="voyages" element={<Voyages/>}/>
        <Route path="restauration" element={<Restauration/>}/>
        <Route path="maintenance" element={<Maintenance/>}/>
        <Route path="audit" element={<AuditPage/>}/>
      </Route>
    </Routes>
  )
}
