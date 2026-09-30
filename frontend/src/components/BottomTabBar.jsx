import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'

// Barre de navigation mobile en bas d'ecran, style application native —
// les destinations les plus utilisees restent accessibles en un tap
// permanent, plutot que caches derriere le tiroir lateral (qui reste
// disponible via "Plus" pour tout le reste). C'est l'element le plus
// visible qui differencie une app mobile d'un site web retreci.
//
// Design "flottant" : barre en verre depoli (blur) detachee des bords,
// coins tres arrondis, onglet actif surligne d'un halo dore, et
// l'onglet central (index 2) elevé en bouton circulaire doré avec un
// leger glow — cible la plus utilisee du role (Résidences pour l'admin,
// Demandes pour l'agent) sans changer la structure TABS existante.
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

const CENTER_INDEX = 2

function isTabActive(tab, pathname) {
  return tab.exact ? pathname === tab.to : pathname.startsWith(tab.to)
}

export default function BottomTabBar({ role, onOpenMenu }) {
  const tabs = TABS[role] || TABS.agent
  const { pathname } = useLocation()

  return (
    <nav style={{
      position:'fixed', left:14, right:14, bottom:'calc(16px + env(safe-area-inset-bottom, 0px))',
      zIndex:100, height:66, display:'flex', alignItems:'stretch', padding:'0 6px',
      background:'rgba(11,15,20,.78)',
      backdropFilter:'blur(18px)', WebkitBackdropFilter:'blur(18px)',
      border:'1px solid rgba(255,255,255,.09)', borderRadius:26,
      boxShadow:'0 14px 34px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.06)',
    }}>
      {tabs.map((t, i) => {
        const active = isTabActive(t, pathname)

        if (i === CENTER_INDEX) {
          return (
            <NavLink key={t.to} to={t.to} end={t.exact}
              style={{
                flex:1, display:'flex', alignItems:'center', justifyContent:'center',
                position:'relative', textDecoration:'none',
              }}>
              <span style={{
                position:'absolute', top:-26, width:58, height:58, borderRadius:'50%',
                background:'radial-gradient(circle at 32% 28%, #F4D26B, #C9972B 65%, #A9791E)',
                display:'flex', alignItems:'center', justifyContent:'center',
                border:'4px solid #0B1628',
                boxShadow: active
                  ? '0 0 0 6px rgba(212,160,23,.28), 0 8px 18px rgba(201,151,43,.45)'
                  : '0 8px 18px rgba(201,151,43,.35)',
                transition:'box-shadow .2s',
              }}>
                <span style={{ fontSize:22 }}>{t.icon}</span>
              </span>
              <span style={{
                position:'absolute', bottom:9, fontSize:9, fontWeight:700,
                color: active ? '#F0C445' : '#D8B45A', whiteSpace:'nowrap',
              }}>{t.label}</span>
            </NavLink>
          )
        }

        return (
          <NavLink key={t.to} to={t.to} end={t.exact}
            style={{
              flex:1, display:'flex', flexDirection:'column', alignItems:'center',
              justifyContent:'center', gap:3, textDecoration:'none', position:'relative',
            }}>
            {active && (
              <span style={{
                position:'absolute', top:2, width:38, height:38, borderRadius:14,
                background:'linear-gradient(180deg, rgba(240,196,69,.18), rgba(240,196,69,.05))',
                border:'1px solid rgba(240,196,69,.35)', zIndex:0,
              }} />
            )}
            <span style={{
              position:'relative', zIndex:1, fontSize:20, lineHeight:1,
              filter: active ? 'none' : 'grayscale(.15) opacity(.75)',
              transform: active ? 'translateY(-1px)' : 'none',
              transition:'.2s',
            }}>{t.icon}</span>
            <span style={{
              position:'relative', zIndex:1, fontSize:9, fontWeight: active ? 700 : 600,
              letterSpacing:.2, color: active ? '#F0C445' : '#7E8AA3',
            }}>{t.label}</span>
          </NavLink>
        )
      })}
      <button onClick={onOpenMenu}
        style={{
          flex:1, display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', gap:3, background:'none', border:'none',
          cursor:'pointer', color:'#7E8AA3', position:'relative',
        }}>
        <span style={{ fontSize:20, lineHeight:1 }}>☰</span>
        <span style={{ fontSize:9, fontWeight:600, letterSpacing:.2 }}>Plus</span>
      </button>
    </nav>
  )
}
