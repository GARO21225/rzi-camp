import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { iconeEtLibelle } from '../constants/roleNav'

// En-tête et tiroir de navigation propres au TÉLÉPHONE (direction « Filon
// d'or », même langage visuel que l'Accueil résident). La version
// ordinateur de Layout n'est pas touchée.

const NUIT = '#06142E'
const NUIT_2 = '#0B2350'
const OR = '#E3B23C'
const DISPLAY = "'Archivo', 'IBM Plex Sans', system-ui, sans-serif"

// /api/auth/me/ ne renvoie pas toujours first_name/last_name : le nom
// complet est alors dans profile.nom (« Edgar Kouamé »).
export const nomAffiche = (user) =>
  [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.profile?.nom || user?.username || ''

const initiales = (user) => {
  const mots = nomAffiche(user).split(/\s+/).filter(Boolean)
  return ((mots[0]?.[0] || 'U') + (mots[1]?.[0] || '')).toUpperCase()
}

function titrePage(pathname, nav) {
  if (pathname === '/' || pathname === '/accueil') return null
  const item = nav.find(i => i.to && i.to !== '/' && (pathname === i.to || pathname.startsWith(i.to + '/')))
  if (item) return iconeEtLibelle(item).label
  if (pathname.startsWith('/mon-compte')) return 'Mon compte'
  if (pathname.startsWith('/conduite')) return 'Ma conduite'
  return null
}

const boutonRond = (actif) => ({
  width: 40, height: 40, minWidth: 40, minHeight: 40, borderRadius: 14, border: '1px solid rgba(255,255,255,.08)',
  background: actif ? 'rgba(227,178,60,.18)' : 'rgba(255,255,255,.05)', color: '#F1F5F9',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, cursor: 'pointer', position: 'relative', padding: 0,
})

export function MobileHeader({ user, logoUrl, nav, notifRef, notifOpen, onNotif, notifCount, notifPanel, searchOpen, onSearch, onMenu }) {
  const { pathname } = useLocation()
  const titre = titrePage(pathname, nav)
  const surAccueil = pathname === '/accueil'
  return (
    <header style={{
      height: 60, flexShrink: 0, zIndex: 500, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
      background: surAccueil ? NUIT : `linear-gradient(180deg, ${NUIT_2}, ${NUIT})`,
      borderBottom: surAccueil ? 'none' : '1px solid rgba(227,178,60,.22)',
      boxShadow: surAccueil ? 'none' : '0 6px 20px -12px rgba(0,0,0,.6)',
    }}>
      <div style={{ background: '#fff', borderRadius: 12, height: 38, padding: '0 9px', display: 'flex', alignItems: 'center', flexShrink: 0,
        boxShadow: `0 0 0 1px ${OR}40` }}>
        <img src={logoUrl || '/roxgold-logo.png'} alt="Roxgold" style={{ height: 24, objectFit: 'contain', display: 'block' }} />
      </div>
      <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
        {titre ? (
          <div style={{ fontFamily: DISPLAY, fontStretch: '108%', fontWeight: 800, fontSize: 17, color: '#fff',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: -.2 }}>{titre}</div>
        ) : (
          <div style={{ fontFamily: DISPLAY, fontStretch: '120%', fontWeight: 700, fontSize: 10, letterSpacing: 2, color: OR, textTransform: 'uppercase', lineHeight: 1.3 }}>
            Résidence<br /><span style={{ color: '#fff' }}>Roxgold Sango</span>
          </div>
        )}
      </div>
      <button onClick={onSearch} aria-label="Rechercher" style={boutonRond(searchOpen)}>🔍</button>
      <div ref={notifRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button onClick={onNotif} aria-label="Notifications" style={boutonRond(notifOpen)}>
          🔔
          {notifCount > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 19, height: 19, padding: '0 4px', borderRadius: 10,
              background: OR, color: NUIT, fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2px solid ${NUIT}` }}>{notifCount > 9 ? '9+' : notifCount}</span>
          )}
        </button>
        {notifPanel}
      </div>
      <button onClick={onMenu} aria-label="Menu et profil"
        style={{ width: 40, height: 40, minWidth: 40, minHeight: 40, borderRadius: '50%', border: `2px solid ${OR}`, padding: 0, cursor: 'pointer',
          background: `linear-gradient(140deg, ${OR}, #B9851F)`, color: NUIT, fontWeight: 800, fontSize: 13, fontFamily: DISPLAY, flexShrink: 0 }}>
        {initiales(user)}
      </button>
    </header>
  )
}

export function MobileDrawer({ open, onClose, user, roleLabel, nav, onLogout, onCompte }) {
  // Regroupe les entrées par groupe (menu admin) ; un menu sans groupe
  // (résidents) forme un seul bloc.
  const groupes = []
  let courant = { titre: null, items: [] }
  nav.forEach(item => {
    if (item.group) { if (courant.items.length) groupes.push(courant); courant = { titre: item.group, items: [] }; return }
    courant.items.push(item)
  })
  if (courant.items.length) groupes.push(courant)
  if (!groupes.some(g => g.items.some(i => i.to === '/accueil')) && !nav.some(i => i.to === '/')) {
    groupes.unshift({ titre: null, items: [{ to: '/accueil', label: '🏠 Accueil' }] })
    if (groupes[1] && !groupes[1].titre) { groupes[0].items.push(...groupes[1].items); groupes.splice(1, 1) }
  }

  return (
    <>
      <style>{`
        @keyframes mdUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes mdFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes mdTile { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: none } }
        .md-tile:active { transform: scale(.95); }
      `}</style>
      {open && (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(3,10,24,.55)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', animation: 'mdFade .2s ease both' }}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '92dvh', display: 'flex', flexDirection: 'column',
            background: '#EEF1F6', borderRadius: '28px 28px 0 0', overflow: 'hidden',
            boxShadow: '0 -20px 60px -10px rgba(0,0,0,.5)', animation: 'mdUp .32s cubic-bezier(.2,.9,.25,1) both',
          }}>
            {/* Carte profil */}
            <div style={{ position: 'relative', padding: '12px 18px 20px', color: '#fff', flexShrink: 0,
              background: `radial-gradient(120% 120% at 90% 0%, ${NUIT_2}, ${NUIT} 65%)` }}>
              <div style={{ width: 42, height: 5, borderRadius: 3, background: 'rgba(255,255,255,.25)', margin: '0 auto 14px' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `linear-gradient(140deg, ${OR}, #B9851F)`, color: NUIT, fontWeight: 800, fontSize: 18, fontFamily: DISPLAY,
                  boxShadow: `0 0 0 4px ${OR}30` }}>{initiales(user)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: DISPLAY, fontStretch: '108%', fontWeight: 800, fontSize: 18, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nomAffiche(user)}
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: OR, letterSpacing: 1.2, textTransform: 'uppercase', marginTop: 2 }}>{roleLabel}</div>
                </div>
                <button onClick={onClose} aria-label="Fermer"
                  style={{ ...boutonRond(false), borderRadius: '50%', width: 36, height: 36, minWidth: 36, minHeight: 36, fontSize: 14 }}>✕</button>
              </div>
            </div>

            {/* Tuiles */}
            <div style={{ overflowY: 'auto', overscrollBehavior: 'contain', padding: '16px 14px 8px', flex: 1 }}>
              {groupes.map((g, gi) => (
                <div key={g.titre || gi} style={{ marginBottom: 16 }}>
                  {g.titre && (
                    <div style={{ fontFamily: DISPLAY, fontStretch: '115%', fontSize: 10, fontWeight: 800, letterSpacing: 1.6,
                      textTransform: 'uppercase', color: '#5B6472', margin: '0 4px 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 14, height: 2, background: OR, borderRadius: 2 }} />{g.titre}
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {g.items.map((item, i) => {
                      const { icon, label } = iconeEtLibelle(item)
                      return (
                        <NavLink key={item.to} to={item.to} end={item.exact || item.to === '/'} onClick={onClose} className="md-tile"
                          style={({ isActive }) => ({
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, padding: '13px 4px 11px',
                            borderRadius: 18, textDecoration: 'none', transition: 'transform .15s',
                            animation: `mdTile .35s ease both ${80 + (gi * 4 + i) * 25}ms`,
                            background: isActive ? `linear-gradient(150deg, ${NUIT_2}, ${NUIT})` : '#fff',
                            border: isActive ? `1px solid ${OR}` : '1px solid rgba(15,26,46,.06)',
                            boxShadow: isActive ? `0 8px 20px -10px ${NUIT}` : '0 6px 16px -12px rgba(6,20,46,.4)',
                          })}>
                          {({ isActive }) => (<>
                            <span style={{ fontSize: 23, lineHeight: 1 }}>{icon}</span>
                            <span style={{ fontSize: 11.5, fontWeight: 700, textAlign: 'center', lineHeight: 1.15, fontFamily: DISPLAY, fontStretch: '95%',
                              color: isActive ? OR : '#0F1A2E' }}>{label}</span>
                          </>)}
                        </NavLink>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Pied : compte + déconnexion */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '10px 14px calc(14px + env(safe-area-inset-bottom, 0px))',
              borderTop: '1px solid rgba(15,26,46,.08)', background: '#fff', flexShrink: 0 }}>
              <button onClick={onCompte} style={{ border: '1px solid rgba(15,26,46,.12)', background: '#fff', color: '#0F1A2E', borderRadius: 14,
                padding: '12px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>👤 Mon compte</button>
              <button onClick={onLogout} style={{ border: 'none', background: '#FEF2F2', color: '#B91C1C', borderRadius: 14,
                padding: '12px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>⎋ Déconnexion</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
