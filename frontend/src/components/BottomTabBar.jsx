import React, { useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { iconeEtLibelle } from '../constants/roleNav'
import Icon, { iconeRoute } from './Icon'

// Barre de navigation mobile en bas d'ecran, style application native —
// les destinations les plus utilisees restent accessibles en un tap
// permanent, plutot que caches derriere le tiroir lateral (qui reste
// disponible via "Plus" pour tout le reste). C'est l'element le plus
// visible qui differencie une app mobile d'un site web retreci.
//
// Design "flottant" : barre en verre depoli (blur) detachee des bords,
// coins tres arrondis, une pastille doree unique qui GLISSE d'un onglet
// a l'autre (on voit d'ou l'on vient et ou l'on va), et l'onglet central
// (index 2) elevé en bouton circulaire doré — cible la plus utilisee du
// role (Résidences pour l'admin, Demandes pour l'agent). Styles dans
// index.css (section « Coque mobile ») : :active et media queries
// impossibles en style inline.
const TABS = {
  admin: [
    { to:'/', label:'Accueil', icon:'📊', exact:true },
    { to:'/rotations', label:'Mobilité', icon:'🧭' },
    { to:'/residences', label:'Résidences', icon:'🏠' },
    { to:'/personnel', label:'Personnel', icon:'👤' },
    { to:'/demandes', label:'Demandes', icon:'📝' },
  ],
  agent: [
    { to:'/accueil', label:'Accueil', icon:'🏠', exact:true },
    { to:'/voyages', label:'Voyages', icon:'✈️' },
    { to:'/demandes', label:'Demandes', icon:'📝' },
    { to:'/restauration', label:'Repas', icon:'🍽️' },
    { to:'/maintenance', label:'Signaler', icon:'🛠️' },
  ],
}

const CENTER_INDEX = 2

// Onglets d'un non-admin : la liste "curated" si toutes ses pages sont
// dans son menu (cas agent), sinon construite a partir de SON menu reel
// - "Moi" en premier, puis ses premieres pages. Avant, tout non-admin
// recevait les onglets agent (Voyages, Repas, Signaler...) meme quand
// ces pages n'etaient pas les siennes.
function tabsUtilisateur(nav) {
  const autorises = new Set(nav.filter(i => i.to).map(i => i.to))
  autorises.add('/mon-compte')
  autorises.add('/accueil')
  if (TABS.agent.every(t => autorises.has(t.to))) return avecConduite(TABS.agent, autorises)
  const pages = nav
    .filter(i => i.to && i.to !== '/' && i.to !== '/mon-compte' && i.to !== '/accueil')
    .slice(0, 4)
    .map(i => ({ to: i.to, ...iconeEtLibelle(i) }))
  return avecConduite([{ to:'/accueil', label:'Accueil', icon:'🏠', exact:true }, ...pages.filter(p => p.to !== '/conduite')], autorises)
}

// Conducteur : "Conduite" prend le bouton central (le plus visible), c'est
// là qu'il appuie sur PARTIR puis signale ses arrêts.
const ONGLET_CONDUITE = { to:'/conduite', label:'Conduite', icon:'🚐' }
function avecConduite(tabs, autorises) {
  if (!autorises.has('/conduite')) return tabs
  const t = tabs.filter(x => x.to !== '/conduite')
  if (t.length >= 5) t.splice(CENTER_INDEX, 1, ONGLET_CONDUITE)
  else t.splice(Math.min(CENTER_INDEX, t.length), 0, ONGLET_CONDUITE)
  return t
}

function isTabActive(tab, pathname) {
  return tab.exact ? pathname === tab.to : pathname.startsWith(tab.to)
}

// Icône d'onglet : trait vectoriel si la page en a un, sinon son emoji.
function IconeOnglet({ tab, size }) {
  const nom = iconeRoute(tab.to)
  return nom ? <Icon name={nom} size={size} /> : <span style={{ fontSize: size - 1, lineHeight: 1 }}>{tab.icon}</span>
}

export default function BottomTabBar({ isAdmin, nav = [], onOpenMenu, menuOpen = false }) {
  const tabs = isAdmin ? TABS.admin : tabsUtilisateur(nav)
  // Le bouton central eleve n'a de sens qu'avec un nombre impair d'onglets
  // (sinon il n'est pas au centre visuel de la barre).
  const centre = tabs.length === 5 ? CENTER_INDEX : -1
  const { pathname } = useLocation()
  const slots = tabs.length + 1 // + « Plus »
  const iActif = menuOpen ? tabs.length : tabs.findIndex(t => isTabActive(t, pathname))
  // La pastille garde sa dernière position quand elle disparaît (onglet
  // central ou page hors barre) : elle réapparaît sur place au lieu de
  // traverser la barre depuis la gauche.
  const dernier = useRef(iActif >= 0 ? iActif : 0)
  if (iActif >= 0 && iActif !== centre) dernier.current = iActif
  const pastilleVisible = iActif >= 0 && iActif !== centre

  return (
    <nav className="bottom-tab-bar" aria-label="Navigation principale">
      <span aria-hidden="true" className="tb-pastille" style={{
        width: `calc((100% - 12px) / ${slots})`,
        transform: `translateX(${dernier.current * 100}%)`,
        opacity: pastilleVisible ? 1 : 0,
      }}><span /></span>
      {tabs.map((t, i) => {
        const active = i === iActif

        if (i === centre) {
          return (
            <NavLink key={t.to} to={t.to} end={t.exact} className="tb-item tb-centre" data-active={active || undefined}>
              <span className="tb-centre-bouton"><IconeOnglet tab={t} size={24} /></span>
              <span className="tb-label">{t.label}</span>
            </NavLink>
          )
        }

        return (
          <NavLink key={t.to} to={t.to} end={t.exact} className="tb-item" data-active={active || undefined}>
            <span className="tb-ico"><IconeOnglet tab={t} size={22} /></span>
            <span className="tb-label">{t.label}</span>
          </NavLink>
        )
      })}
      <button type="button" onClick={onOpenMenu} className="tb-item" data-active={menuOpen || undefined}
        aria-label="Plus de pages" aria-expanded={menuOpen}>
        <span className="tb-ico"><Icon name="grid" size={22} /></span>
        <span className="tb-label">Plus</span>
      </button>
    </nav>
  )
}
