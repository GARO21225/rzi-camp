import GlobalSearch from './GlobalSearch'
import BottomTabBar from './BottomTabBar'
import { useOffline } from '../hooks/useOffline'
import { useSessionGuard } from '../hooks/useSessionGuard'
import { useIsMobile } from '../hooks/useIsMobile'
import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Outlet, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../store'
import { useNotifications } from '../hooks/useNotifications'
import ConfirmDialogContainer from './ConfirmDialogContainer'
import { rolesAPI, batiments, suiviConvois } from '../api'

/* REFONTE: logo migré du base64 inline vers le fichier PNG du design system */

import { ROLE_LABELS, getRole, isAdminUser, buildNav, isPathAllowed, homePathFor } from '../constants/roleNav'

function NotifPanel({ items, count, onClose, onMarkAll, navigate }) {
  return (
    <div style={{
      position: 'fixed', top: 58, right: 8, width: 350, maxWidth: 'calc(100vw - 16px)',
      background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16,
      boxShadow: '0 12px 40px rgba(30,58,138,.25)', zIndex: 1000, overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 16px', background: 'var(--rzc-navy)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#ffffff', fontWeight: 700, fontSize: 15 }}>
          🔔 Notifications {count > 0 && <span style={{ background: '#dc2626', color: '#ffffff', borderRadius: 20, padding: '1px 8px', fontSize: 10, marginLeft: 8 }}>{count}</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {count > 0 && <button onClick={onMarkAll} style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#ffffff', padding: '3px 10px', borderRadius: 20, cursor: 'pointer', fontSize: 11 }}>✓ Tout lire</button>}
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: '#ffffff', width: 26, height: 26, borderRadius: 8, cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      </div>
      <div style={{ maxHeight: '55vh', overflowY: 'auto' }}>
        {items.length === 0
          ? <div style={{ padding: '32px 16px', textAlign: 'center', color: '#525252' }}><div style={{ fontSize: 40, marginBottom: 8 }}>🔔</div>Aucune notification</div>
          : items.map(n => (
            <div key={n.id}
              onClick={() => { onClose(); navigate('/evenements') }}
              style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: n.lu ? '#ffffff' : 'rgba(37,99,235,.04)', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = n.lu ? '#ffffff' : 'rgba(37,99,235,.04)'}>
              <div style={{ fontSize: 22, flexShrink: 0 }}>📅</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: n.lu ? 500 : 700, fontSize: 13, color: 'var(--rzc-navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{n.evenement_titre}</div>
                {n.evenement_lieu && <div style={{ fontSize: 11, color: '#525252', marginBottom: 1 }}>📍 {n.evenement_lieu}</div>}
                {n.evenement_date && <div style={{ fontSize: 11, color: '#525252' }}>📅 {new Date(n.evenement_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>}
              </div>
              {!n.lu && <div style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--rzc-navy)', flexShrink: 0, marginTop: 4 }} />}
            </div>
          ))
        }
      </div>
      <div style={{ padding: '10px 14px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <button onClick={() => { onClose(); navigate('/evenements') }}
          style={{ width: '100%', background: 'var(--rzc-navy)', color: '#ffffff', border: 'none', padding: '9px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          Voir tous les événements →
        </button>
      </div>
    </div>
  )
}


function WelcomeToast({ user, roleCustomLabel, onClose }) {
  const role = (user?.is_staff || user?.is_superuser) ? 'admin' : (user?.profile?.role || 'agent')
  const ROLE_ICONS = { admin:'👑', agent:'🏗️', restauration:'🍽️', technicien:'🔧', menage:'🧹' }
  const name = user?.first_name ? `${user.first_name} ${user.last_name}` : user?.username || ''
  return (
    <div style={{
      position: 'fixed', top: 72, right: 16, zIndex: 9999,
      width: 'min(320px, calc(100vw - 32px))',
      background: '#fff', border: '1px solid #e2e8f0',
      borderLeft: '4px solid #1e3a8a',
      borderRadius: 14, padding: '14px 16px',
      boxShadow: '0 8px 30px rgba(30,58,138,.2)',
      animation: 'fadeIn .3s ease',
      display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <div style={{ fontSize: 32 }}>{ROLE_ICONS[role] || '👤'}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: 'var(--rzc-navy)', fontSize: 14, marginBottom: 2 }}>
          Bienvenue, {name} 👋
        </div>
        <div style={{ fontSize: 11, color: '#64748b' }}>
          Connecté en tant que <b>{roleCustomLabel || ROLE_LABELS[role] || role}</b> · {new Date().toLocaleDateString('fr-FR', {weekday:'long', day:'numeric', month:'long'})}
        </div>
      </div>
      <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#94a3b8', fontSize:16, padding:0, flexShrink:0 }}>✕</button>
    </div>
  )
}

// BUG REEL CORRIGE ICI : la carte "Mon départ" (confirmer/reporter son
// propre départ depuis l'app) n'existait que sur Dashboard.jsx - or
// RoleHome() (App.jsx) redirige TOUT utilisateur dont le role est
// agent/restauration/technicien/menage vers /carte, JAMAIS vers Dashboard,
// et aucune autre route n'affiche ce composant. Un résident avec un de ces
// roles (cas d'Edgar : role "agent") ne pouvait donc STRUCTURELLEMENT
// jamais voir ni utiliser cette carte, quel que soit l'etat des donnees
// cote backend (deja verifie correct) - "Edgar ne voit rien" avait donc
// raison depuis le debut, sur TOUTES les iterations precedentes de ce
// correctif cote Dashboard.jsx/backend, qui ne pouvaient mecaniquement
// jamais s'appliquer a lui. Remonte ici, dans Layout (rendu pour TOUTE
// page, tout role), pour que ce genre de role la voie enfin, peu importe
// sur quelle page il atterrit.
const ROLES_SANS_DASHBOARD = ['agent', 'restauration', 'technicien', 'menage']

// Points de descente courants pour le trajet Camp -> Abidjan - évite de
// laisser "Abidjan" fige en dur (demande explicite : le résident doit
// pouvoir dire où il descend, pour que le Centre de Mobilité organise la
// suite). Simple liste editable ici en attendant un catalogue dedie
// (ItineraireModele existe deja pour les villes INTERMEDIAIRES d'un
// trajet, pas pour le point de descente final du passager - portee
// volontairement limitee a ce qui est demande).
const POINTS_DESCENTE_ABIDJAN = [
  'Adjamé', 'Plateau', 'Cocody', 'Yopougon', 'Marcory', 'Treichville',
  'Abobo', 'Koumassi', 'Gare routière Abidjan', 'Autre (préciser)',
]

function MonDepartBanner({ role, isMobile }) {
  const [monDepart, setMonDepart] = useState(null)
  const [busy, setBusy] = useState(false)
  const [date, setDate] = useState('')
  const [destination, setDestination] = useState(POINTS_DESCENTE_ABIDJAN[0])
  const [destinationAutre, setDestinationAutre] = useState('')

  useEffect(() => {
    if (!ROLES_SANS_DASHBOARD.includes(role)) return // admin: déjà vu via Dashboard, pas de doublon
    let cancelled = false
    batiments.monDepart().then(r => { if (!cancelled) setMonDepart(r.data?.depart || null) }).catch(() => {})
    return () => { cancelled = true }
  }, [role])

  if (!monDepart) return null

  const confirmer = async () => {
    const dest = destination === 'Autre (préciser)' ? (destinationAutre.trim() || 'Abidjan') : destination
    setBusy(true)
    try {
      await batiments.confirmerDepart(monDepart.batiment_id, { action: 'confirme', destination: dest })
      setMonDepart(null)
    } catch (e) { alert(e?.response?.data?.error || 'Erreur') } finally { setBusy(false) }
  }
  const reporter = async () => {
    if (!date) return
    setBusy(true)
    try {
      await batiments.confirmerDepart(monDepart.batiment_id, { action: 'reporte', nouvelle_date: date })
      setMonDepart(null)
    } catch (e) { alert(e?.response?.data?.error || 'Erreur') } finally { setBusy(false) }
  }

  // Sur mobile : chaque controle prend toute la largeur (cibles tactiles
  // de 44px) au lieu d'une ligne de 5 elements qui deborde.
  const mob = isMobile ? { flex: '1 1 100%', minHeight: 44, fontSize: 15 } : {}

  return (
    <div style={{ background: monDepart.en_retard ? '#fef2f2' : '#fffbeb',
      border: `1px solid ${monDepart.en_retard ? '#fecaca' : '#fde68a'}`,
      borderRadius: 10, padding: '10px 14px', margin: isMobile ? '10px 10px 0' : '12px 16px 0',
      display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <div style={{ flex: 1, minWidth: 220, fontSize: 13, fontWeight: 600, color: '#0F1A2E' }}>
        {monDepart.en_retard
          ? `🧳 Votre départ était prévu le ${new Date(monDepart.date_depart).toLocaleDateString('fr-FR')} — vous êtes toujours logé, confirmez-vous ?`
          : monDepart.aujourdhui
          ? `🧳 Vous partez aujourd'hui (${new Date(monDepart.date_depart).toLocaleDateString('fr-FR')}) ?`
          : `🧳 Vous partez demain (${new Date(monDepart.date_depart).toLocaleDateString('fr-FR')}) ?`}
      </div>
      <select value={destination} onChange={e => setDestination(e.target.value)}
        title="Où descendez-vous à Abidjan ?"
        style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 8px', fontSize: 12.5, ...mob }}>
        {POINTS_DESCENTE_ABIDJAN.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      {destination === 'Autre (préciser)' && (
        <input type="text" value={destinationAutre} onChange={e => setDestinationAutre(e.target.value)}
          placeholder="Précisez le lieu" style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 8px', fontSize: 12.5, ...mob }} />
      )}
      <button onClick={confirmer} disabled={busy}
        style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, padding: '7px 14px',
          fontSize: 12.5, fontWeight: 700, cursor: busy ? 'wait' : 'pointer', ...mob }}>
        ✅ Je confirme mon départ
      </button>
      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 8px', fontSize: 12.5, ...mob }} />
      <button onClick={reporter} disabled={busy || !date}
        style={{ background: (!date || busy) ? '#e2e8f0' : '#0F2A5C', color: '#fff', border: 'none',
          borderRadius: 8, padding: '7px 14px', fontSize: 12.5, fontWeight: 700,
          cursor: (!date || busy) ? 'not-allowed' : 'pointer', ...mob }}>
        📅 Je reste — nouvelle date
      </button>
    </div>
  )
}

export default function Layout() {
  useSessionGuard()
  const { user, logout, logoUrl } = useStore()
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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const { isOffline, syncMsg, retry } = useOffline()
  // Thème forcé en clair : la quasi-totalité des pages est en CSS-in-JS
  // inline avec des fonds clairs codés en dur (#fff, #f8fafc, etc.) sans
  // `color` explicite. Le mode sombre ne couvrait que quelques classes CSS
  // (.card, .table, .badge-*, modals) dans theme.css, alors que `--text`
  // passait à #FAFAFA globalement (héritage CSS normal) -> texte blanc sur
  // fond clair partout ailleurs, et ce dès que l'OS/navigateur préfère le
  // mode sombre (theme 'auto' par défaut, sans action de l'utilisateur).
  // Tant que les pages ne sont pas toutes auditées pour le dark mode, on
  // neutralise le mode sombre pour éviter ce bug d'illisibilité.
  const theme = 'light'
  const notifRef = useRef(null)
  const { count: notifCount, items: notifItems, alertes, marquerToutLu } = useNotifications()
  const isMobile = useIsMobile()

  // Applique toujours le thème clair, quoi qu'il y ait en localStorage
  // (anciens réglages 'dark'/'auto' d'utilisateurs qui avaient basculé).
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light')
    try { localStorage.removeItem('theme') } catch {}
  }, [])

  // is_staff/is_superuser (verite Django) prime TOUJOURS sur profile.role
  // (simple champ metier, qui vaut 'agent' par defaut et peut ne jamais
  // avoir ete mis a jour) - un compte reellement admin ne doit jamais
  // pouvoir s'afficher comme 'Agent Terrain' a cause d'un profil oublie.
  const role = getRole(user)
  const isAdmin = isAdminUser(user)

  // Menu par role configurable depuis Parametrage (sans toucher au code) -
  // repli sur ROLE_NAV code en dur si le role custom est absent/invalide,
  // pour ne jamais casser l'affichage meme en cas de donnee corrompue.
  const [roleMenuOverride, setRoleMenuOverride] = useState(null)
  const [roleCustomLabel, setRoleCustomLabel] = useState(null)
  // Role pour lequel la config Parametrage a fini de charger (succes OU
  // echec) - la garde de routes attend ce signal, sinon un menu custom
  // plus large que le menu par defaut ferait rediriger a tort pendant
  // le chargement.
  const [roleMenuChargePour, setRoleMenuChargePour] = useState(null)
  const userCharge = !!user
  useEffect(() => {
    let annule = false
    if (isAdmin) {
      // Reinitialise tout etat potentiellement fige par un rendu
      // anterieur ou isAdmin etait momentanement faux (ex: user pas
      // encore charge lors d'un changement de page) - un admin ne doit
      // JAMAIS rester coince sur un libelle/menu de role errone.
      setRoleMenuOverride(null); setRoleCustomLabel(null)
      return
    }
    if (!userCharge) return
    setRoleMenuOverride(null); setRoleCustomLabel(null)
    rolesAPI.list().then(r => {
      // 'annule' capture l'etat isAdmin du moment ou CETTE requete a ete
      // lancee - si isAdmin est repasse a true entre-temps (ex: user
      // charge juste apres un premier rendu ou il etait encore absent),
      // cette reponse tardive ne doit PLUS pouvoir ecraser le reset fait
      // ci-dessus : sans cette garde, une reponse en retard restaure
      // silencieusement un libelle de role errone pour un admin.
      if (annule) return
      const liste = r.data?.results || r.data || []
      const roleCustom = liste.find(x => x.code === role)
      if (roleCustom?.menu_pages?.length) setRoleMenuOverride(roleCustom.menu_pages)
      if (roleCustom?.label) setRoleCustomLabel(roleCustom.label)
    }).catch(() => {}).finally(() => { if (!annule) setRoleMenuChargePour(role) })
    return () => { annule = true }
  }, [isAdmin, role, userCharge])

  // Conducteur d'un convoi (hier -> demain) : "Ma conduite" en tête de son
  // menu, quel que soit son rôle - c'est là qu'il clique sur PARTIR.
  const [estConducteur, setEstConducteur] = useState(false)
  useEffect(() => {
    if (!userCharge || isAdmin) return
    suiviConvois.mesConvois().then(r => setEstConducteur((r.data || []).length > 0)).catch(() => {})
  }, [userCharge, isAdmin])

  const navRole = buildNav(role, isAdmin, roleMenuOverride)
  const nav = estConducteur && !navRole.some(i => i.to === '/conduite')
    ? [{ to:'/conduite', label:'🚐 Ma conduite' }, ...navRole]
    : navRole

  // Separation admin / utilisateur : avant, seul le MENU differait selon
  // le role - n'importe quel utilisateur pouvait ouvrir /parametrage,
  // /personnel, /audit... en tapant l'URL (ou via la recherche globale).
  // Un non-admin est maintenant renvoye vers sa page d'accueil s'il ouvre
  // une page absente de son menu. (Rappel : la vraie protection des
  // DONNEES reste cote API Django - ceci protege l'interface.)
  const accesPret = !!user && (isAdmin || roleMenuChargePour === role)
  const pageAutorisee = isAdmin || isPathAllowed(location.pathname, nav)

  // Groupes de menu réductibles — mémorisés localement, avec ouverture
  // automatique du groupe contenant la page active pour ne jamais perdre
  // de vue où l'on se trouve.
  const [collapsedGroups, setCollapsedGroups] = useState(() => {
    try { return JSON.parse(localStorage.getItem('rzc_collapsed_groups') || '{}') } catch { return {} }
  })
  useEffect(() => {
    localStorage.setItem('rzc_collapsed_groups', JSON.stringify(collapsedGroups))
  }, [collapsedGroups])
  const toggleGroup = (name) => setCollapsedGroups(prev => ({ ...prev, [name]: !prev[name] }))

  // Groupe contenant la page active — toujours visible même s'il était replié
  const activeGroup = (() => {
    let current = null
    for (const item of nav) {
      if (item.group) { current = item.group; continue }
      if (item.to === location.pathname || (item.exact ? item.to === location.pathname : location.pathname.startsWith(item.to) && item.to !== '/')) {
        return current
      }
    }
    return null
  })()

  useEffect(() => {
    if (window.innerWidth < 768) { setSidebarOpen(false) }
    setNotifOpen(false)
  }, [location.pathname])

  // Bloque le défilement de la page derrière le menu mobile — sans ça, un
  // geste de scroll qui commence sur le menu peut "traverser" et faire
  // défiler <main> en dessous, ce qui donnait l'impression d'un menu qui
  // scrolle bizarrement et rendait les taps sur les groupes peu fiables
  // (le navigateur interprète parfois le tap comme un scroll raté).
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [isMobile, sidebarOpen])

  useEffect(() => {
    const h = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden', overflowX: 'hidden', maxWidth: '100vw', background: 'var(--rzc-fond-app, #f1f5f9)', colorScheme: theme === 'dark' ? 'dark' : 'light' }}>
      {/* Bannière offline */}
      {isOffline && (
        <div style={{background:'#f59e0b',color:'#1c1917',padding:'8px 16px',
          textAlign:'center',fontSize:13,fontWeight:700,zIndex:9999,
          display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
          📵 Vous êtes hors ligne — Les modifications seront synchronisées au retour de la connexion
          <button onClick={retry} style={{background:'rgba(0,0,0,.15)',border:'none',color:'#1c1917',
            padding:'3px 10px',borderRadius:6,cursor:'pointer',fontSize:12,fontWeight:700}}>
            🔄 Réessayer
          </button>
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
        height: 56,
        background: 'var(--rzc-navy-dark)',
        borderBottom: '3px solid var(--rzc-ore-gold)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: isMobile ? 6 : 12,
        flexShrink: 0, zIndex: 500,
        boxShadow: '0 1px 0 rgba(255,212,0,.15)',
        overflow: 'hidden', maxWidth: '100vw',
      }}>
        <button onClick={() => setSidebarOpen(o => !o)}
          style={{ background: 'transparent', border: 'none', color: '#F5F5F5', width: 36, height: 36, borderRadius: 6, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 150ms' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.08)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          {sidebarOpen ? '✕' : '☰'}
        </button>

        <div style={{ background: '#fff', borderRadius: 6, padding: '5px 10px', flexShrink: 0, height: 36, display: 'flex', alignItems: 'center' }}>
          <img src={logoUrl || "/roxgold-logo.png"} alt="Logo" style={{ height: 26, objectFit: "contain", display: 'block' }}/>
        </div>

        {!isMobile && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#A3A3A3', letterSpacing: '0.08em', textTransform: 'uppercase', flexShrink: 0 }}>
          RÉSIDENCE <span style={{ color: 'var(--rzc-bright-gold)' }}>ROXGOLD SANGO</span>
        </div>
        )}

        {/* ── Recherche globale ── */}
        {!isMobile && <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}><GlobalSearch /></div>}
        {isMobile && <div style={{ flex: 1 }} />}

        {isMobile && (
          <button onClick={() => setMobileSearchOpen(o => !o)}
            style={{ background: mobileSearchOpen ? 'rgba(255,255,255,.15)' : 'transparent', border: 'none', color: '#F5F5F5', width: 36, height: 36, borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, transition: 'all 150ms' }}>
            🔍
          </button>
        )}

        {alertes.length > 0 && !isMobile && (
          <div style={{ background: 'rgba(220,38,38,.18)', border: '1px solid rgba(220,38,38,.35)', borderRadius: 6, padding: '5px 10px', fontSize: 11, color: '#fca5a5', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0, fontWeight: 600 }}>
            ⚠️ {alertes[0]?.message}
          </div>
        )}

          <div ref={notifRef} style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => setNotifOpen(o => !o)}
            style={{ background: notifOpen ? 'rgba(255,255,255,.15)' : 'transparent', border: 'none', color: notifOpen ? '#fff' : '#CBD5E1', width: 36, height: 36, borderRadius: 6, cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, transition: 'all 150ms' }}
            onMouseEnter={e => { if (!notifOpen) { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; e.currentTarget.style.color = '#fff' } }}
            onMouseLeave={e => { if (!notifOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#CBD5E1' } }}>
            🔔
            {notifCount > 0 && (
              <span style={{ position: 'absolute', top: 4, right: 4, background: 'var(--rzc-bright-gold)', color: 'var(--rzc-navy-dark)', borderRadius: '50%', width: 16, height: 16, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--rzc-navy-dark)' }}>
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>
    {showWelcome && <WelcomeToast user={user} roleCustomLabel={roleCustomLabel} onClose={() => setShowWelcome(false)} />}
      {notifOpen && <NotifPanel items={notifItems} count={notifCount} onClose={() => setNotifOpen(false)} onMarkAll={() => { marquerToutLu(); setNotifOpen(false) }} navigate={navigate} />}
        </div>

        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: isMobile ? 3 : '3px 10px 3px 3px', background: 'rgba(255,255,255,.06)', borderRadius: 99, cursor: 'pointer', transition: 'all 150ms' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,.12)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,.06)'}
          title={`${user?.first_name||''} ${user?.last_name||''} — ${roleCustomLabel || ROLE_LABELS[role] || role}`}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--rzc-bright-gold)', color: 'var(--rzc-navy-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 11 }}>
            {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}{(user?.last_name?.[0] || '').toUpperCase()}
          </div>
          {!isMobile && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ color: '#F1F5F9', fontSize: 12, fontWeight: 600, lineHeight: 1.2, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(user?.first_name && user?.last_name) ? `${user.first_name}` : user?.username || ''}
            </span>
            <span style={{ color: 'var(--rzc-bright-gold)', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {roleCustomLabel || ROLE_LABELS[role] || role}
            </span>
          </div>
          )}
        </div>

        <button onClick={() => { logout(); navigate('/login') }}
          style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.15)', color: '#CBD5E1', padding: isMobile ? '6px 8px' : '6px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, flexShrink: 0, transition: 'all 150ms' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.3)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#CBD5E1'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.15)' }}
          title="Déconnexion">
          {isMobile ? '⎋' : '⎋ Déconnexion'}
        </button>

      </header>

      {isMobile && mobileSearchOpen && (
        <div style={{ background: 'var(--rzc-navy-dark)', borderBottom: '1px solid rgba(255,255,255,.1)', padding: '10px 16px', zIndex: 499 }}>
          <GlobalSearch onNavigate={() => setMobileSearchOpen(false)} />
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Backdrop mobile */}
        {sidebarOpen && isMobile && (
          <div onClick={() => setSidebarOpen(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)', zIndex:90 }} />
        )}

        <nav style={{
            width: isMobile ? 'min(300px, 86vw)' : 240,
            background: 'var(--rzc-navy-dark)',
            borderRight: 'none',
            overflowY: 'auto',
            overflowX: 'hidden',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            transition: 'transform 0.25s ease',
            ...(isMobile ? {
              position: 'fixed',
              top: 56,
              left: 0,
              bottom: 0,
              zIndex: 95,
              boxShadow: '4px 0 20px rgba(0,0,0,.25)',
              transform: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
              pointerEvents: sidebarOpen ? 'auto' : 'none',
            } : {}),
          }}>
            {isMobile && (
              <div style={{ padding: '14px 14px 12px', borderBottom: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'var(--rzc-bright-gold)', color: 'var(--rzc-navy-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                  {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}{(user?.last_name?.[0] || '').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(user?.first_name && user?.last_name) ? `${user.first_name} ${user.last_name}` : user?.username || ''}
                  </div>
                  <div style={{ color: 'var(--rzc-bright-gold)', fontSize: 10, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    {roleCustomLabel || ROLE_LABELS[role] || role}
                  </div>
                </div>
                <button onClick={() => setSidebarOpen(false)} aria-label="Fermer le menu"
                  style={{ background: 'rgba(255,255,255,.08)', border: 'none', color: '#F1F5F9', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>
                  ✕
                </button>
              </div>
            )}
            <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
              <div style={{ fontSize: 10, color: '#8A8A8A', fontFamily: 'var(--font-mono)', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
                Navigation
              </div>
            </div>
            <div style={{ padding: 8, paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : 8, flex: 1 }}>
              {(() => {
                let currentGroup = null
                return nav.map((item, i) => {
                  if (item.group) {
                    currentGroup = item.group
                    // Sur mobile, les groupes restent toujours dépliés — le
                    // toggle plier/déplier était peu fiable au tap (confondu
                    // avec un scroll) et donnait l'impression que certains
                    // groupes "refusaient" de s'ouvrir. Sur desktop (souris),
                    // le pli reste disponible, ça fonctionne bien là.
                    const isCollapsed = !isMobile && !!collapsedGroups[item.group] && item.group !== activeGroup
                    return (
                      <div key={`g${i}`} style={{ margin: i===0 ? '8px 8px 4px' : '18px 8px 4px' }}>
                        <div onClick={isMobile ? undefined : () => toggleGroup(item.group)} style={{
                          fontSize:10, fontWeight:800, letterSpacing:1.5,
                          textTransform:'uppercase', color:'#64748b', cursor: isMobile ? 'default' : 'pointer',
                          padding:'4px 10px', display:'flex', alignItems:'center', gap:6, justifyContent:'space-between',
                          borderBottom:'1px solid rgba(240,165,0,.25)', paddingBottom:6,
                        }}>
                          <span style={{display:'flex', alignItems:'center', gap:6}}>
                            <span style={{display:'inline-block',width:3,height:10,
                              background:'#f0a500',borderRadius:99}}/>
                            {item.group}
                          </span>
                          {!isMobile && (
                            <span style={{fontSize:9, transition:'transform .15s', transform: isCollapsed ? 'rotate(-90deg)' : 'none'}}>▼</span>
                          )}
                        </div>
                      </div>
                    )
                  }
                  const isCollapsed = !isMobile && !!collapsedGroups[currentGroup] && currentGroup !== activeGroup
                  if (isCollapsed) return null
                  return (
                    <NavLink key={item.to} to={item.to} end={item.exact}
                      style={({ isActive }) => ({
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: isMobile ? '12px 12px 12px 16px' : '9px 12px 9px 16px',
                        margin: '1px 8px',
                        borderRadius: 9,
                        textDecoration: 'none',
                        fontSize: isMobile ? 14 : 13,
                        fontWeight: isActive ? 700 : 400,
                        background: isActive ? 'rgba(240,165,0,.18)' : 'transparent',
                        color: isActive ? '#ffffff' : '#94a3b8',
                        borderLeft: isActive ? '3px solid #f0a500' : '3px solid transparent',
                        transition: 'all .15s',
                      })}>
                      {item.label}
                    </NavLink>
                  )
                })
              })()}
            </div>
          </nav>

        <main className="main-scroll" style={{ flex:1, minWidth:0, background: 'var(--rzc-fond-app, #f1f5f9)', overflowY:'auto', paddingBottom: isMobile ? 'calc(100px + env(safe-area-inset-bottom, 0px))' : 0 }}>
            <MonDepartBanner role={role} isMobile={isMobile} />
            {!accesPret
              ? <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>⏳ Chargement...</div>
              : pageAutorisee
              ? <Outlet />
              : <Navigate to={homePathFor(nav)} replace />}
          </main>
      </div>
      {/* Rendu via portail dans <body> : la barre est en position:fixed, donc elle doit
          échapper à TOUT ancêtre qui établirait un containing block différent du viewport
          (transform/filter/backdrop-filter/overflow:hidden sur un conteneur en 100dvh comme
          ci-dessus) — sinon elle peut se retrouver clipée/masquée selon le navigateur mobile,
          ce qui masquait la barre (et ce qu'elle devait montrer) chez l'utilisateur. */}
      {isMobile && createPortal(
        <BottomTabBar isAdmin={isAdmin} nav={nav} onOpenMenu={() => setSidebarOpen(true)} />,
        document.body
      )}
      <ConfirmDialogContainer />
    </div>
  )
}
