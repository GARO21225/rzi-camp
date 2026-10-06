import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import Icon from './Icon'

// Barre de navigation mobile en bas d'ecran, style application native —
// les destinations les plus utilisees restent accessibles en un tap
// permanent, plutot que caches derriere le tiroir lateral (qui reste
// disponible via "Plus" pour tout le reste).
//
// Design "flottant" conserve : barre sombre detachee des bords, onglet
// central (index 2) eleve en bouton circulaire dore — cible la plus
// utilisee du role (Résidences pour l'admin, Demandes pour l'agent).
//
// Passe de lisibilite : les emoji (couleurs propres, impossibles a teinter,
// rendu different selon le telephone) sont remplaces par des icones au
// trait qui prennent la couleur de l'etat. L'onglet actif est donc dore
// (icone + libelle + trait), les autres gris clair, et les libelles passent
// de 9 a 10,5 px.
const TABS = {
  admin: [
    { to:'/', label:'Accueil', icon:'dashboard', exact:true },
    { to:'/rotations', label:'Mobilité', icon:'compass' },
    { to:'/residences', label:'Résidences', icon:'home' },
    { to:'/personnel', label:'Personnel', icon:'users' },
    { to:'/demandes', label:'Demandes', icon:'file' },
  ],
  agent: [
    { to:'/mon-compte', label:'Accueil', icon:'user', exact:true },
    { to:'/voyages', label:'Voyages', icon:'bus' },
    { to:'/demandes', label:'Demandes', icon:'file' },
    { to:'/restauration', label:'Repas', icon:'utensils' },
    { to:'/maintenance', label:'Signaler', icon:'wrench' },
  ],
}

const CENTER_INDEX = 2
const OR = 'var(--rzc-ore-gold, #C9972B)'
const OR_CLAIR = '#F0C445'   // or eclairci : seul lisible en texte sur la barre sombre
const INACTIF = '#B4BED0'

function isTabActive(tab, pathname) {
  return tab.exact ? pathname === tab.to : pathname.startsWith(tab.to)
}

const tabStyle = {
  flex:1, minWidth:0, display:'flex', flexDirection:'column', alignItems:'center',
  justifyContent:'center', gap:4, textDecoration:'none', position:'relative',
  WebkitTapHighlightColor:'transparent',
}
const labelStyle = (active) => ({
  fontSize:10.5, lineHeight:1.15, fontWeight: active ? 700 : 500,
  color: active ? OR_CLAIR : INACTIF, whiteSpace:'nowrap',
  maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis',
})

export default function BottomTabBar({ role, onOpenMenu }) {
  const tabs = TABS[role] || TABS.agent
  const { pathname } = useLocation()

  return (
    <nav aria-label="Navigation principale" style={{
      position:'fixed', left:10, right:10, bottom:'calc(10px + env(safe-area-inset-bottom, 0px))',
      zIndex:100, height:64, display:'flex', alignItems:'stretch', padding:'0 4px',
      background:'rgba(8,27,61,.94)',
      backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)',
      border:'1px solid rgba(255,255,255,.10)', borderRadius:20,
      boxShadow:'0 10px 28px rgba(8,27,61,.35)',
    }}>
      {tabs.map((t, i) => {
        const active = isTabActive(t, pathname)

        if (i === CENTER_INDEX) {
          return (
            <NavLink key={t.to} to={t.to} end={t.exact} style={{ ...tabStyle, justifyContent:'flex-end', paddingBottom:9 }}>
              <span style={{
                position:'absolute', top:-22, width:54, height:54, borderRadius:'50%',
                background: OR, color:'var(--rzc-navy-dark, #081B3D)',
                display:'flex', alignItems:'center', justifyContent:'center',
                border:'4px solid var(--rzc-fond-app, #f1f5f9)',
                boxShadow: active
                  ? '0 0 0 3px rgba(240,196,69,.55), 0 6px 14px rgba(8,27,61,.35)'
                  : '0 6px 14px rgba(8,27,61,.35)',
                transition:'box-shadow .2s',
              }}>
                <Icon name={t.icon} size={24} />
              </span>
              {/* le libellé central peut déborder de 1-2 px sur un écran de 360 px : mieux que « Résiden… » */}
              <span style={{ ...labelStyle(active), maxWidth:'none', overflow:'visible' }}>{t.label}</span>
            </NavLink>
          )
        }

        return (
          <NavLink key={t.to} to={t.to} end={t.exact} style={tabStyle}>
            {active && (
              <span style={{ position:'absolute', top:0, width:28, height:3, borderRadius:'0 0 3px 3px', background:OR_CLAIR }} />
            )}
            <span style={{ color: active ? OR_CLAIR : INACTIF, display:'flex' }}>
              <Icon name={t.icon} size={22} />
            </span>
            <span style={labelStyle(active)}>{t.label}</span>
          </NavLink>
        )
      })}
      <button onClick={onOpenMenu} aria-label="Ouvrir le menu complet"
        style={{ ...tabStyle, background:'none', border:'none', cursor:'pointer', padding:0, fontFamily:'inherit' }}>
        <span style={{ color:INACTIF, display:'flex' }}><Icon name="menu" size={22} /></span>
        <span style={labelStyle(false)}>Plus</span>
      </button>
    </nav>
  )
}
