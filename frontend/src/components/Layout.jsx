import React from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { LOGO_B64 } from '../logo_b64'

const NAV = [
  { to:'/', label:'📊 Dashboard', exact:true },
  { to:'/carte', label:'🗺️ Carte GIS' },
  { to:'/residences', label:'🏠 Résidences' },
  { to:'/personnel', label:'👤 Personnel' },
  { to:'/voyages', label:'✈️ Voyages' },
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
      <header style={{
        height:64, background:'var(--blue)', borderBottom:'3px solid var(--accent)',
        display:'flex', alignItems:'center', padding:'0 20px', gap:16, flexShrink:0, zIndex:100,
        boxShadow:'0 2px 12px rgba(30,58,138,.3)'
      }}>
        <img src={LOGO_B64} alt="Roxgold Sango" style={{ height:46, objectFit:'contain', filter:'brightness(0) invert(1)' }}/>
        <div style={{ width:1, height:32, background:'rgba(255,255,255,.2)' }}/>
        <div style={{ fontFamily:'monospace', fontSize:13, fontWeight:700, color:'#fff', letterSpacing:1 }}>
          RÉSIDENCE ROXGOLD SANGO
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:13, color:'rgba(255,255,255,.9)' }}>{user?.first_name} {user?.last_name}</span>
          <span style={{
            background:'var(--accent)', color:'#000', padding:'3px 10px',
            borderRadius:20, fontSize:11, fontFamily:'monospace', textTransform:'uppercase', fontWeight:700
          }}>{user?.profile?.role || '—'}</span>
          <button onClick={doLogout} style={{
            background:'rgba(255,255,255,.1)', border:'1px solid rgba(255,255,255,.3)',
            color:'#fff', padding:'5px 12px', borderRadius:6, cursor:'pointer', fontSize:12
          }}>↩ Déconnexion</button>
        </div>
      </header>
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <nav style={{ width:220, background:'var(--blue)', display:'flex', flexDirection:'column', flexShrink:0, overflowY:'auto' }}>
          <div style={{ padding:'16px 16px 6px', fontSize:10, fontFamily:'monospace', color:'rgba(255,255,255,.4)', letterSpacing:2, textTransform:'uppercase' }}>Navigation</div>
          {NAV.map(n => (
            <NavLink key={n.to} to={n.to} end={n.exact}
              style={({ isActive }) => ({
                display:'flex', alignItems:'center', padding:'10px 18px', textDecoration:'none',
                fontSize:13, fontWeight: isActive ? 600 : 400,
                color: isActive ? '#fff' : 'rgba(255,255,255,.6)',
                borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                background: isActive ? 'rgba(255,255,255,.12)' : 'transparent',
                transition:'.15s'
              })}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <main style={{ flex:1, overflow:'auto', background:'var(--bg)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
