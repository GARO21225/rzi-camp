import React from 'react'
import { NavLink } from 'react-router-dom'

// Barre de navigation mobile en bas d'ecran, style application native —
// les destinations les plus utilisees restent accessibles en un tap
// permanent, plutot que caches derriere le tiroir lateral (qui reste
// disponible via "Plus" pour tout le reste). C'est l'element le plus
// visible qui differencie une app mobile d'un site web retreci.
const TABS = {
  admin: [
    { to:'/', label:'Accueil', icon:'📊', exact:true },
    { to:'/rotations', label:'Mobilité', icon:'🧭' },
    { to:'/residences', label:'Résidences', icon:'🏠' },
    { to:'/personnel', label:'Personnel', icon:'👤' },
    { to:'/demandes', label:'Demandes', icon:'📝' },
  ],
  agent: [
    { to:'/mon-compte', label:'Accueil', icon:'👤', exact:true },
    { to:'/voyages', label:'Voyages', icon:'✈️' },
    { to:'/demandes', label:'Demandes', icon:'📝' },
    { to:'/restauration', label:'Repas', icon:'🍽️' },
    { to:'/maintenance', label:'Signaler', icon:'🛠️' },
  ],
}

export default function BottomTabBar({ role, onOpenMenu }) {
  const tabs = TABS[role] || TABS.agent
  return (
    <nav style={{
      position:'fixed', left:0, right:0, bottom:0, zIndex:100,
      display:'flex', background:'var(--rzc-navy-dark)',
      borderTop:'1px solid rgba(255,255,255,.08)',
      boxShadow:'0 -4px 16px rgba(0,0,0,.25)',
      paddingBottom:'env(safe-area-inset-bottom, 0px)',
    }}>
      {tabs.map(t => (
        <NavLink key={t.to} to={t.to} end={t.exact}
          style={({isActive}) => ({
            flex:1, display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center', gap:2, padding:'8px 4px 7px',
            textDecoration:'none', minHeight:52,
            color: isActive ? '#F0A500' : '#94A3B8',
            transition:'color .15s',
          })}>
          <span style={{fontSize:20, lineHeight:1}}>{t.icon}</span>
          <span style={{fontSize:10, fontWeight:700}}>{t.label}</span>
        </NavLink>
      ))}
      <button onClick={onOpenMenu}
        style={{
          flex:1, display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', gap:2, padding:'8px 4px 7px',
          background:'none', border:'none', minHeight:52, cursor:'pointer',
          color:'#94A3B8',
        }}>
        <span style={{fontSize:20, lineHeight:1}}>☰</span>
        <span style={{fontSize:10, fontWeight:700}}>Plus</span>
      </button>
    </nav>
  )
}
