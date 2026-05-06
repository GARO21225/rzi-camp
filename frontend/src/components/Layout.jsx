import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useStore } from '../store'

const NAV = [
  { to:'/', label:'📊 Dashboard', exact:true },
  { to:'/carte', label:'🗺️ Carte GIS' },
  { to:'/residences', label:'🏠 Résidences' },
  { to:'/restauration', label:'🍽️ Restauration' },
  { to:'/maintenance', label:'🛠️ Maintenance' },
  { to:'/audit', label:'📋 Audit Trail' },
]

export default function Layout() {
  const { user, logout } = useStore()
  const navigate = useNavigate()

  const doLogout = () => { logout(); navigate('/login') }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', overflow:'hidden' }}>
      {/* HEADER */}
      <header style={{ height:56, background:'var(--surface)', borderBottom:'1px solid var(--border)',
        display:'flex', alignItems:'center', padding:'0 20px', gap:16, flexShrink:0, zIndex:100 }}>
        <div style={{ fontFamily:'monospace', fontSize:15, fontWeight:700, color:'var(--accent)', letterSpacing:2 }}>
          🏔 RZI CAMP
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:13 }}>{user?.first_name} {user?.last_name}</span>
          <span style={{ background:'rgba(240,165,0,.15)', color:'var(--accent)', border:'1px solid rgba(240,165,0,.3)',
            padding:'3px 10px', borderRadius:20, fontSize:11, fontFamily:'monospace', textTransform:'uppercase' }}>
            {user?.profile?.role || '—'}
          </span>
          <button onClick={doLogout} style={{ background:'none', border:'1px solid var(--border)',
            color:'var(--text-dim)', padding:'5px 12px', borderRadius:6, cursor:'pointer', fontSize:12 }}>
            ↩ Déconnexion
          </button>
        </div>
      </header>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {/* SIDEBAR */}
        <nav style={{ width:240, background:'var(--surface)', borderRight:'1px solid var(--border)',
          display:'flex', flexDirection:'column', flexShrink:0, overflowY:'auto' }}>
          <div style={{ padding:'12px 12px 4px', fontSize:10, fontFamily:'monospace',
            color:'var(--text-dim)', letterSpacing:2, textTransform:'uppercase' }}>Navigation</div>
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.exact}
              style={({ isActive }) => ({
                display:'flex', alignItems:'center', padding:'10px 16px', textDecoration:'none',
                fontSize:13.5, color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                background: isActive ? 'rgba(240,165,0,.08)' : 'transparent',
                transition:'.15s'
              })}>
              {n.label}
            </NavLink>
          ))}
        </nav>

        {/* CONTENT */}
        <main style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
