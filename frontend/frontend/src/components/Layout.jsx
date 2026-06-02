import GlobalSearch from './GlobalSearch'
import { useOffline } from '../hooks/useOffline'
import { useSessionGuard } from '../hooks/useSessionGuard'
import React, { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../store'
import { useNotifications } from '../hooks/useNotifications'

/* REFONTE: logo migré du base64 inline vers le fichier PNG du design system */

const ROLE_NAV = {
  admin: [
    // ── Vue principale
    { to:'/', label:'📊 Dashboard', exact:true },
    { to:'/carte', label:'🗺️ Carte GIS' },
    { to:'/operations', label:'🖥️ Centre Opérationnel' },
    // ── Personnel & Conformité
    { group:'Personnel & Conformité' },
    { to:'/personnel', label:'👤 Personnel' },
    { to:'/induction', label:'🎓 Induction QHSE' },
    { to:'/annuaire', label:'📋 Annuaire' },
    // ── Hébergement & Mobilité
    { group:'Hébergement & Mobilité' },
    { to:'/residences', label:'🏠 Résidences' },
    { to:'/voyages', label:'✈️ Voyages' },
    { to:'/rotations', label:'🔄 Rotations' },
    // ── Services
    { group:'Services aux Résidents' },
    { to:'/restauration', label:'🍽️ Restauration' },
    { to:'/boutique', label:'🛒 Bar & Boutique' },
    { to:'/reservations', label:'📅 Réservations' },
    // ── Exploitation
    { group:'Exploitation' },
    { to:'/maintenance', label:'🛠️ Maintenance' },
    { to:'/evenements', label:'📡 Événements' },
    { to:'/demandes', label:'📝 Demandes' },
    // ── Pilotage
    { group:'Pilotage & Analyse' },
    { to:'/analytics', label:'📈 Analytics' },
    { to:'/rapports', label:'📄 Rapports' },
    { to:'/historique', label:'📋 Historique' },
    { to:'/audit', label:'🔍 Audit' },
    { to:'/assistant', label:'🤖 Assistant IA' },
    { to:'/status', label:'🔧 Diagnostic' },
  ],
  agent: [
    { to:'/mon-compte', label:'👤 Mon compte' },
    { to:'/carte', label:'🗺️ Carte GIS' },
    { to:'/demandes', label:'📝 Mes demandes' },
    { to:'/evenements', label:'📅 Événements' },
    { to:'/voyages', label:'✈️ Voyages' },
    { to:'/restauration', label:'🍽️ Restauration' },
    { to:'/maintenance', label:'🛠️ Signaler Incident' },
  ],
  restauration: [
    { to:'/carte', label:'🗺️ Carte GIS' },
    { to:'/evenements', label:'📅 Événements' },
    { to:'/restauration', label:'🍽️ Restauration' },
  ],
  technicien: [
    { to:'/carte', label:'🗺️ Carte GIS' },
    { to:'/evenements', label:'📅 Événements' },
    { to:'/maintenance', label:'🛠️ Maintenance' },
    { to:'/induction', label:'🎓 Induction QHSE' },
  ],
  menage: [
    { to:'/carte', label:'🗺️ Carte GIS' },
    { to:'/evenements', label:'📅 Événements' },
    { to:'/maintenance', label:'🛠️ Signaler' },
  ],
}

const ROLE_LABELS = {
  admin: 'Administrateur',
  agent: 'Agent',
  restauration: 'Restauration',
  technicien: 'Technicien',
  menage: 'Ménage',
}

function NotifPanel({ items, count, onClose, onMarkAll, navigate }) {
  return (
    <div style={{
      position: 'fixed', top: 58, right: 8, width: 350, maxWidth: 'calc(100vw - 16px)',
      background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16,
      boxShadow: '0 12px 40px rgba(30,58,138,.25)', zIndex: 1000, overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px', background: '#1e3a8a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
          🔔 Notifications {count > 0 && <span style={{ background: '#dc2626', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 10, marginLeft: 8 }}>{count}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {count > 0 && <button onClick={onMarkAll} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', padding: '3px 10px', borderRadius: 20, cursor: 'pointer', fontSize: 11 }}>✓ Tout lire</button>}
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#fff', width: 26, height: 26, borderRadius: 8, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      </div>
      <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
        {items.length === 0
          ? <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)' }}><div style={{ fontSize: 40, marginBottom: 8 }}>🔔</div>Aucune notification</div>
          : items.map(n => (
            <div key={n.id}
              onClick={() => { onClose(); navigate('/evenements') }}
              style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: n.lu ? '#ffffff' : 'rgba(37,99,235,.04)', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = n.lu ? '#ffffff' : 'rgba(37,99,235,.04)'}>
              <div style={{ fontSize: 22, flexShrink: 0 }}>📅</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: n.lu ? 500 : 700, fontSize: 13, color: '#1e3a8a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{n.evenement_titre}</div>
                {n.evenement_lieu && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 1 }}>📍 {n.evenement_lieu}</div>}
                {n.evenement_date && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>📅 {new Date(n.evenement_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
              </div>
              {!n.lu && <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#1e3a8a', flexShrink: 0, marginTop: 4 }} />}
            </div>
          ))
        }
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <button onClick={() => { onClose(); navigate('/evenements') }}
          style={{ width: '100%', background: '#1e3a8a', color: '#fff', border: 'none', padding: '9px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Voir tous les événements →
        </button>
      </div>
    </div>
  )
}


function WelcomeToast({ user, onClose }) {
  const role = user?.profile?.role || 'agent'
  const ROLE_ICONS = { admin:'👑', agent:'🏗️', restauration:'🍽️', technicien:'🔧', menage:'🧹' }
  const name = user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username || ''
  return (
    <div style={{
      position: 'fixed', top: 72, right: 16, zIndex: 9999,
      width: 'min(320px, calc(100vw - 32px))',
      background: '#fff', border: '1px solid #e2e8f0',
      borderLeft: '4px solid #1e3a8ar(--rzi-blue)',
      borderRadius: 14, padding: '14px 16px',
      boxShadow: '0 8px 30px rgba(30,58,138,.2)',
      animation: 'fadeIn .3s ease',
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <div style={{ fontSize: 32 }}>{ROLE_ICONS[role] || '👤'}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: '#1e3a8a', fontSize: 14, marginBottom: 2 }}>
          Bienvenue, {name} 👋
        </div>
        <div style={{ fontSize: 11, color: '#64748b' }}>
          Connecté en tant que <b>{ROLE_LABELS[role] || role}</b> · {new Date().toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'})}
        </div>
      </div>
      <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:16, padding:0, flexShrink:0 }}>✕</button>
    </div>
  )
}

export default function Layout() {
  useSessionGuard()
  const { user, logout } = useStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [showWelcome, setShowWelcome] = useState(sessionStorage.getItem("just_logged_in") === "1")
  React.useEffect(() => {
    if (showWelcome) {
      sessionStorage.removeItem("just_logged_in")
      const t = setTimeout(() => setShowWelcome(false), 4000)
      return () => clearTimeout(t)
    }
  }, [showWelcome])
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 768)
  const [notifOpen, setNotifOpen] = useState(false)
  const { isOffline, syncMsg } = useOffline()
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'auto')
  const notifRef = useRef(null)
  const { count: notifCount, items: notifItems, alertes, marquerToutLu } = useNotifications()

  // Apply theme
  useEffect(() => {
    const t = theme === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('theme', theme)
  }, [theme])

  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')
  const isAdmin = user?.is_staff || user?.is_superuser || role === 'admin'
  const nav = ROLE_NAV[isAdmin ? 'admin' : role] || ROLE_NAV.agent

  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false)
    setNotifOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const h = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const isMobile = window.innerWidth < 768

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: '#f1f5f9', colorScheme: theme === 'dark' ? 'dark' : 'light' }}>
      {/* Bannière offline */}
      {isOffline && (
        <div style={{background:'#f59e0b',color:'#1c1917',padding:'8px 16px',
          textAlign:'center',fontSize:13,fontWeight:700,zIndex:9999,
          display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          📵 Vous êtes hors ligne — Les modifications seront synchronisées au retour de la connexion
        </div>
      )}
      {syncMsg && !isOffline && (
        <div style={{background: syncMsg.startsWith('✅') ? '#16a34a' : '#f59e0b',
          color:'#fff',padding:'8px 16px',textAlign:'center',fontSize:13,fontWeight:700,zIndex:9999}}>
          {syncMsg}
        </div>
      )}
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        *{-webkit-font-smoothing:antialiased;box-sizing:border-box}
        button{transition:all .15s ease}
        button:active{transform:scale(.97)}
      `}</style>

      <header style={{
        height: 54,
        background: 'linear-gradient(135deg, #0a1628, #1e3a8a)',
        borderBottom: '3px solid #f0a500',
        display: 'flex', alignItems: 'center',
        padding: '0 10px', gap: 10,
        flexShrink: 0, zIndex: 500,
        boxShadow: '0 2px 16px rgba(30,58,138,.35)',
      }}>
        <button onClick={() => setSidebarOpen(o => !o)}
          style={{ background: 'rgba(255,255,255,.12)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: 8, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {sidebarOpen ? '✕' : '☰'}
        </button>

        <div style={{ background: '#fff', borderRadius: 8, padding: '3px 9px', flexShrink: 0 }}>
          <img src="/roxgold-logo.png" alt="Roxgold Sango" style={{ height: 30, objectFit: "contain" }}/>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.9)', letterSpacing: 1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          RÉSIDENCE ROXGOLD SANGO
        </div>

        {/* ── Recherche globale ── */}
        {!isMobile && <GlobalSearch />}

        {alertes.length > 0 && !isMobile && (
          <div style={{ background: 'rgba(220,38,38,.25)', border: '1px solid rgba(220,38,38,.5)', borderRadius: 20, padding: '3px 12px', fontSize: 11, color: '#fca5a5', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>
            ⚠️ {alertes[0]?.message}
          </div>
        )}

        {/* Bascule thème */}
          <button
            onClick={() => { const t = theme === 'dark' ? 'light' : 'dark'; setTheme(t); localStorage.setItem('theme', t) }}
            title="Basculer thème"
            style={{ background:'rgba(255,255,255,.12)', border:'none', color:'#fff',
              width:38, height:38, borderRadius:8, cursor:'pointer', flexShrink:0,
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:17 }}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <div ref={notifRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => setNotifOpen(o => !o)}
            style={{ background: notifOpen ? 'rgba(255,255,255,.25)' : 'rgba(255,255,255,.12)', border: 'none', color: '#fff', width: 38, height: 38, borderRadius: 8, cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
            🔔
            {notifCount > 0 && (
              <span style={{ position: 'absolute', top: 4, right: 4, background: '#dc2626', color: '#fff', borderRadius: '50%', width: 17, height: 17, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>
    {showWelcome && <WelcomeToast user={user} onClose={() => setShowWelcome(false)} />}
      {notifOpen && <NotifPanel items={notifItems} count={notifCount} onClose={() => setNotifOpen(false)} onMarkAll={() => { marquerToutLu(); setNotifOpen(false) }} navigate={navigate} />}
        </div>

        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, maxWidth: 140 }}>
          <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, lineHeight: 1.2, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 130 }}>
            {(user?.first_name && user?.last_name) ? `${user.first_name} ${user.last_name}` : user?.username || ''}
          </span>
          <span style={{ background: 'rgba(240,165,0,.9)', color: '#000', padding: '2px 8px', borderRadius: 20, fontSize: 9, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {ROLE_LABELS[role] || role}
          </span>
        </div>

        <button onClick={() => { logout(); navigate('/login') }}
          style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.2)', color: '#fff', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
          ⎋
        </button>

      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Backdrop mobile */}
        {sidebarOpen && isMobile && (
          <div onClick={() => setSidebarOpen(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:90 }} />
        )}
        {sidebarOpen && (
          <nav style={{
            width: 240,
            background: '#0a1628',
            borderRight: 'none',
            overflowY: 'auto',
            overflowX: 'hidden',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            ...(isMobile ? {
              position: 'fixed',
              top: 54,
              left: 0,
              bottom: 0,
              zIndex: 95,
              boxShadow: '4px 0 20px rgba(0,0,0,.25)',
            } : {}),
          }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', letterSpacing: 1, textTransform: 'uppercase' }}>
                Navigation
              </div>
            </div>
            <div style={{ padding: 8, flex: 1 }}>
              {nav.map((item, i) => item.group ? (
                <div key={`g${i}`} style={{ margin: i===0 ? '8px 8px 4px' : '18px 8px 4px' }}>
                  <div style={{
                    fontSize:10, fontWeight:800, letterSpacing:1.5,
                    textTransform:'uppercase', color:'#f0a500',
                    padding:'4px 10px', display:'flex', alignItems:'center', gap:6,
                    borderBottom:'1px solid rgba(240,165,0,.25)', paddingBottom:6,
                  }}>
                    <span style={{display:'inline-block',width:3,height:10,
                      background:'#f0a500',borderRadius:99}}/>
                    {item.group}
                  </div>
                </div>
              ) : (
                <NavLink key={item.to} to={item.to} end={item.exact}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '9px 12px 9px 16px',
                    margin: '1px 8px',
                    borderRadius: 9,
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 400,
                    background: isActive ? 'rgba(240,165,0,.18)' : 'transparent',
                    color: isActive ? '#f0a500' : 'rgba(255,255,255,.8)',
                    borderLeft: isActive ? '3px solid #f0a500' : '3px solid transparent',
                    transition: 'all .15s',
                  })}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}

        <main className="main-scroll" style={{ flex:1, minWidth:0, background: '#f1f5f9', overflowY:'auto' }}>
            <Outlet />
          </main>
      </div>
    </div>
  )
}
