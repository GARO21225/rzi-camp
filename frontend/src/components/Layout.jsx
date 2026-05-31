import GlobalSearch from './GlobalSearch'
import { useSessionGuard } from '../hooks/useSessionGuard'
import React, { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../store'
import { useNotifications } from '../hooks/useNotifications'

/* REFONTE: logo migré du base64 inline vers le fichier PNG du design system */

const ROLE_NAV = {
  admin: [
    { to:'/', label:'📊 Dashboard', exact:true },
    { to:'/carte', label:'🗺️ Carte GIS' },
    { to:'/residences', label:'🏠 Résidences' },
    { to:'/personnel', label:'👤 Personnel' },
    { to:'/evenements', label:'📅 Événements' },
    { to:'/voyages', label:'✈️ Voyages' },
    { to:'/restauration', label:'🍽️ Restauration' },
    { to:'/boutique',     label:'🛒 Bar & Boutique' },
    { to:'/maintenance', label:'🛠️ Maintenance' },
    { to:'/induction', label:'🎓 Induction QHSE' },
    { to:'/demandes', label:'📝 Demandes & Workflows' },
    { to:'/historique', label:'📋 Historique' },
    { to:'/analytics', label:'📈 Analytics' },
    { to:'/rapports', label:'📑 Rapports' },
    { to:'/audit', label:'🔍 Audit' },
    { to:'/status', label:'🔧 Diagnostic' },
  { to:'/mon-compte', label:'👤 Mon compte' },
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
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
      boxShadow: '0 12px 40px rgba(30,58,138,.25)', zIndex: 1000, overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px', background: 'var(--rzi-blue)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
              style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', background: n.lu ? 'var(--surface)' : 'rgba(37,99,235,.04)', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface2)'}
              onMouseLeave={e => e.currentTarget.style.background = n.lu ? 'var(--surface)' : 'rgba(37,99,235,.04)'}>
              <div style={{ fontSize: 22, flexShrink: 0 }}>📅</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: n.lu ? 500 : 700, fontSize: 13, color: 'var(--rzi-blue)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{n.evenement_titre}</div>
                {n.evenement_lieu && <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 1 }}>📍 {n.evenement_lieu}</div>}
                {n.evenement_date && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>📅 {new Date(n.evenement_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
              </div>
              {!n.lu && <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--rzi-blue)', flexShrink: 0, marginTop: 4 }} />}
            </div>
          ))
        }
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface2)' }}>
        <button onClick={() => { onClose(); navigate('/evenements') }}
          style={{ width: '100%', background: 'var(--rzi-blue)', color: '#fff', border: 'none', padding: '9px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
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
      borderLeft: '4px solid var(--rzi-blue)',
      borderRadius: 14, padding: '14px 16px',
      boxShadow: '0 8px 30px rgba(30,58,138,.2)',
      animation: 'fadeIn .3s ease',
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <div style={{ fontSize: 32 }}>{ROLE_ICONS[role] || '👤'}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: 'var(--rzi-blue)', fontSize: 14, marginBottom: 2 }}>
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', background: 'var(--bg)', colorScheme: theme === 'dark' ? 'dark' : 'light' }}>
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
        background: 'var(--rzi-blue)',
        borderBottom: '3px solid var(--rzi-gold)',
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
          <img src="data:image/png;base64,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" alt="Roxgold Sango" style={{ height: 32, objectFit: "contain", filter:"brightness(0) invert(1)" }}/>
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
            background: 'var(--surface)',
            borderRight: '1px solid var(--border)',
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
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', letterSpacing: 1, textTransform: 'uppercase' }}>
                Navigation
              </div>
            </div>
            <div style={{ padding: 8, flex: 1 }}>
              {nav.map(item => (
                <NavLink key={item.to} to={item.to} end={item.exact}
                  style={({ isActive }) => ({
                    display: 'block',
                    padding: '10px 12px',
                    margin: '2px 0',
                    borderRadius: 'var(--radius)',
                    textDecoration: 'none',
                    fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    background: isActive ? 'var(--rzi-blue)' : 'transparent',
                    color: isActive ? '#fff' : 'var(--text)',
                    transition: 'all .15s',
                  })}>
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        )}

        <main className="main-scroll" style={{ flex:1, minWidth:0, background: 'var(--bg)', overflowY:'auto' }}>
            <Outlet />
          </main>
      </div>
    </div>
  )
}
