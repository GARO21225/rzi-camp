
import React, { lazy, Suspense, Component, useState, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useStore } from './store'
import { useInactivityLogout } from './hooks/useInactivityLogout'
import { auth } from './api'
import Login from './pages/Login'
import Layout from './components/Layout'
const Dashboard = lazy(() => import('./pages/Dashboard'))
const MapPage = lazy(() => import('./pages/MapPage'))
const MissionControl = lazy(() => import('./pages/MissionControl'))
const AssistantIA    = lazy(() => import('./pages/AssistantIA'))
const InductionCamp  = lazy(() => import('./pages/InductionCamp'))
const CentreOperationnel = lazy(() => import('./pages/CentreOperationnel'))
const AnnuairePage = lazy(() => import('./pages/AnnuairePage'))
const ReservationsPage = lazy(() => import('./pages/ReservationsPage'))
const Residences = lazy(() => import('./pages/Residences'))
const Personnel = lazy(() => import('./pages/Personnel'))
const Evenements = lazy(() => import('./pages/Evenements'))
const Historique = lazy(() => import('./pages/Historique'))
const Voyages = lazy(() => import('./pages/Voyages'))
const Restauration = lazy(() => import('./pages/Restauration'))
const Maintenance = lazy(() => import('./pages/Maintenance'))
const MonCompte = lazy(() => import('./pages/MonCompte'))
const Analytics   = lazy(() => import('./pages/Analytics'))
const RapportsPage = lazy(() => import('./pages/RapportsPage'))
const Boutique = lazy(() => import('./pages/Boutique'))
const AuditPage = lazy(() => import('./pages/AuditPage'))
const StatusPage = lazy(() => import('./pages/StatusPage'))
const InductionPage = lazy(() => import('./pages/InductionPage'))
const WorkflowHub = lazy(() => import('./pages/WorkflowHub'))
const BoutiquePOS = lazy(() => import('./pages/BoutiquePOS'))
import Presences   from './pages/Presences'

const Demandes = lazy(() => import('./pages/Demandes'))
import { OfflineBanner, PWAInstallButton } from './components/OfflineBanner'
import EventNotifBanner from './components/EventNotifBanner'

// ── Enregistrement Service Worker (offline mode) ──────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        // Sync au retour du réseau
        window.addEventListener('online', () => {
          if (reg.sync) reg.sync.register('rzi-sync').catch(() => {})
          reg.active?.postMessage({ type: 'SYNC_NOW' })
        })
      })
      .catch(() => {})
  })
}


// ── Global Error Boundary ─────────────────────────────────────
class GlobalErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error, info) { console.error('[RZI ErrorBoundary]', error, info) }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding:40,textAlign:'center',fontFamily:'sans-serif'}}>
          <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
          <div style={{fontSize:20,fontWeight:700,color:'#dc2626',marginBottom:8}}>
            Une erreur s'est produite
          </div>
          <div style={{fontSize:13,color:'#64748b',marginBottom:24}}>
            {this.state.error?.message || 'Erreur inattendue'}
          </div>
          <button onClick={()=>{ this.setState({hasError:false,error:null}); window.location.href='/' }}
            style={{background:'#1e3a8a',color:'#fff',border:'none',borderRadius:10,
              padding:'10px 24px',cursor:'pointer',fontSize:14,fontWeight:700}}>
            🔄 Retour au tableau de bord
          </button>
        </div>
      )
    }
    return this.props.children
  }
}


// Handle 404.html redirect for SPA routing
const urlParams = new URLSearchParams(window.location.search)
const redirect = urlParams.get('redirect')
if (redirect && redirect !== '/') {
  window.history.replaceState(null, '', redirect)
}

function PrivateRoute({ children }) {
  const token = useStore(s => s.token)
  return token ? children : <Navigate to="/login" replace />
}

function RoleHome() {
  const { user } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const mapRoles = ['agent', 'restauration', 'technicien', 'menage']
  if (mapRoles.includes(role)) return <Navigate to="/carte" replace />
  return <Suspense fallback={<div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>Chargement...</div>}><Dashboard /></Suspense>
}

function InactivityWarning() {
  const [show, setShow] = useState(false)
  const [secs, setSecs] = useState(60)
  useEffect(() => {
    const h = (e) => { setSecs(e.detail?.remaining || 60); setShow(true) }
    window.addEventListener('inactivity-warning', h)
    return () => window.removeEventListener('inactivity-warning', h)
  }, [])
  if (!show) return null
  return (
    <div style={{
      position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)',
      background:'#1e3a8a', color:'#fff', padding:'12px 20px', borderRadius:12,
      boxShadow:'0 8px 32px rgba(30,58,138,.4)', zIndex:9999,
      display:'flex', alignItems:'center', gap:12, fontSize:13, maxWidth:'calc(100vw - 32px)'
    }}>
      ⏱️ Déconnexion dans <b>{secs}s</b>
      <button onClick={()=>{setShow(false);document.dispatchEvent(new Event('mousemove'))}}
        style={{background:'#f0a500',color:'#000',border:'none',padding:'5px 14px',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:12}}>
        Rester
      </button>
    </div>
  )
}

function InactivityGuard() {
  useInactivityLogout()
  return null
}

// Keep Render awake — ping every 14 minutes
const BACKEND = (import.meta.env.VITE_API_URL||'')
if (BACKEND) {
  setInterval(() => {
    fetch(`${BACKEND}/api/auth/me/`, {headers:{Authorization:`Bearer ${localStorage.getItem('access_token')||''}`}}).catch(()=>{})
  }, 14 * 60 * 1000)
}


// ── Keep-alive Render: ping toutes les 13 minutes pour éviter le sleep ──
function useKeepAlive() {
  React.useEffect(() => {
    const BACKEND = (() => {
      const v = import.meta.env.VITE_API_URL
      if (v) return v.replace(/\/+$/, '')
      const h = window.location.hostname
      if (h.includes('frontend')) return 'https://' + h.replace('frontend', 'backend')
      return 'http://localhost:8000'
    })()
    const ping = () => fetch(`${BACKEND}/api/ping/`, { method: 'GET', mode: 'no-cors' }).catch(() => {})
    ping() // ping immédiat au démarrage
    const id = setInterval(ping, 13 * 60 * 1000) // toutes les 13 min
    return () => clearInterval(id)
  }, [])
}

export default function App() {
  const { token, setUser, logout } = useStore()
  useEffect(() => {
    if (token) {
      auth.me().then(r => {
        setUser(r.data)
      }).catch(() => {
        logout() // Nettoie le store et localStorage
        // Pas de redirect ici: le Router redirige vers /login via ProtectedRoute
      })
    }
  }, [token])

  return (
    <>
      <InactivityWarning />
      <OfflineBanner />
      {token && <EventNotifBanner />}
      <InactivityGuard />
      <PWAInstallButton />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<RoleHome />} />
          <Route path="carte" element={<Suspense fallback={<div style={{padding:40,textAlign:'center',color:'#64748b'}}>⏳ Chargement...</div>}><MapPage /></Suspense>} />
          <Route path="residences" element={<Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>⏳ Chargement...</div>}><Residences /></Suspense>} />
          <Route path="personnel" element={<Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>⏳ Chargement...</div>}><Personnel /></Suspense>} />
          <Route path="evenements" element={<Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>⏳ Chargement...</div>}><Evenements /></Suspense>} />
          <Route path="historique" element={<Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>⏳ Chargement...</div>}><Historique /></Suspense>} />
          <Route path="voyages" element={<Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>⏳ Chargement...</div>}><Voyages /></Suspense>} />
          <Route path="restauration" element={<Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>⏳ Chargement...</div>}><Restauration /></Suspense>} />
          <Route path="maintenance" element={<Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>⏳ Chargement...</div>}><Maintenance /></Suspense>} />
          <Route path="analytics" element={<Suspense fallback={<div style={{padding:40,textAlign:'center',color:'#64748b'}}>⏳ Chargement...</div>}><Analytics /></Suspense>} />
          <Route path="demandes" element={<Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>⏳ Chargement...</div>}><Demandes /></Suspense>}/>
          <Route path="audit" element={<Suspense fallback={<div style={{padding:40,textAlign:'center',color:'#64748b'}}>⏳ Chargement...</div>}><AuditPage /></Suspense>} />
          <Route path="boutique" element={<Suspense fallback={<div style={{padding:40,textAlign:'center',color:'#64748b'}}>⏳ Chargement...</div>}><Boutique /></Suspense>} />
          <Route path="mon-compte" element={<Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>⏳ Chargement...</div>}><MonCompte /></Suspense>} />
          <Route path="status"     element={<Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>⏳ Chargement...</div>}><StatusPage /></Suspense>} />
          <Route path="presences"  element={<Presences />} />
          <Route path="rapports" element={<Suspense fallback={<div style={{padding:40,textAlign:'center',color:'#64748b'}}>⏳</div>}><RapportsPage /></Suspense>} />
          <Route path="workflows" element={<Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>⏳ Chargement...</div>}><WorkflowHub /></Suspense>} />
          <Route path="induction-camp" element={<Suspense fallback={<div style={{padding:40,textAlign:'center',color:'#94a3b8'}}>⏳</div>}><InductionCamp /></Suspense>} />
              <Route path="induction" element={<Suspense fallback={<div style={{padding:40,textAlign:'center',color:'#64748b'}}>⏳ Chargement...</div>}><InductionPage /></Suspense>} />
          <Route path="boutique-pos" element={<Suspense fallback={<div style={{padding:40,textAlign:"center",color:"#94a3b8"}}>⏳ Chargement...</div>}><BoutiquePOS /></Suspense>} />
          <Route path="rotations" element={<Suspense fallback={<div style={{background:'#060d1f',minHeight:'100vh'}}/>}><MissionControl /></Suspense>} />
          <Route path="annuaire" element={<Suspense fallback={<div style={{padding:40,textAlign:'center',color:'#64748b'}}>⏳ Chargement...</div>}><AnnuairePage /></Suspense>} />
          <Route path="reservations" element={<Suspense fallback={<div style={{padding:40,textAlign:'center',color:'#64748b'}}>⏳ Chargement...</div>}><ReservationsPage /></Suspense>} />
          <Route path="assistant" element={<Suspense fallback={<div style={{padding:40,textAlign:'center',color:'#64748b'}}>⏳ Chargement...</div>}><AssistantIA /></Suspense>}/>
          <Route path="operations" element={<Suspense fallback={<div style={{padding:40,textAlign:'center',color:'#64748b'}}>⏳ Chargement...</div>}><CentreOperationnel /></Suspense>}/>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
