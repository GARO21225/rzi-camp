import React, { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { iconeEtLibelle } from '../constants/roleNav'
import Icon, { iconeRoute } from './Icon'
import ChoixLangue from './ChoixLangue'

// En-tête et tiroir de navigation propres au TÉLÉPHONE (direction « Filon
// d'or », même langage visuel que l'Accueil résident). La version
// ordinateur de Layout n'est pas touchée.

// Styles dans index.css (section « Coque mobile ») : les états :active,
// les transitions et les media queries ne s'écrivent pas en style inline.

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

export function MobileHeader({ user, logoUrl, nav, notifRef, notifOpen, onNotif, notifCount, notifPanel, searchOpen, onSearch, onMenu }) {
  const { pathname } = useLocation()
  const titre = titrePage(pathname, nav)
  const surAccueil = pathname === '/accueil'
  // L'en-tête se détache (ombre + filet doré) dès que la page défile,
  // comme une barre de navigation iOS ; à plat tant qu'on est en haut.
  const [defile, setDefile] = useState(false)
  useEffect(() => {
    const zone = document.querySelector('.main-scroll')
    if (!zone) return
    const maj = () => setDefile(zone.scrollTop > 4)
    maj()
    zone.addEventListener('scroll', maj, { passive: true })
    return () => zone.removeEventListener('scroll', maj)
  }, [pathname])
  const detache = defile || !surAccueil

  return (
    <header className="mh" data-detache={detache || undefined}>
      <div className="mh-logo">
        <img src={logoUrl || '/roxgold-logo.png'} alt="Roxgold" />
      </div>
      <div className="mh-titre">
        {/* key = titre : le libellé se fond (léger flou) à chaque changement de page */}
        {titre ? (
          <div key={titre} className="mh-titre-page">{titre}</div>
        ) : (
          <div key="accueil" className="mh-titre-site">
            Résidence<br /><span>Roxgold Sango</span>
          </div>
        )}
      </div>
      <button type="button" onClick={onSearch} aria-label="Rechercher" aria-pressed={searchOpen} className="mh-bouton" data-actif={searchOpen || undefined}>
        <Icon name={searchOpen ? 'close' : 'search'} size={19} />
      </button>
      <div ref={notifRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button type="button" onClick={onNotif} aria-label={`Notifications${notifCount ? ` (${notifCount} non lues)` : ''}`} className="mh-bouton" data-actif={notifOpen || undefined}>
          <Icon name="bell" size={19} />
          {notifCount > 0 && <span key={notifCount} className="mh-pastille">{notifCount > 9 ? '9+' : notifCount}</span>}
        </button>
        {notifPanel}
      </div>
      <button type="button" onClick={onMenu} aria-label="Menu et profil" className="mh-avatar">
        {initiales(user)}
      </button>
    </header>
  )
}

// Durée de sortie du tiroir — doit rester égale à la transition de
// .md:not([data-ouvert]) dans index.css (entrée 420 ms, sortie 260 ms :
// l'utilisateur n'attend jamais la fermeture).
const SORTIE_MS = 260

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

  // Monté tant que l'animation de sortie n'est pas finie.
  const [monte, setMonte] = useState(open)
  const [visible, setVisible] = useState(false)
  const feuille = useRef(null)
  const voile = useRef(null)
  const glisse = useRef(null)

  useEffect(() => {
    if (open) {
      setMonte(true)
      // deux frames : le navigateur peint la position fermée avant la transition
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      return () => cancelAnimationFrame(r)
    }
    setVisible(false)
    const t = setTimeout(() => setMonte(false), SORTIE_MS)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const k = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])

  // ── Glisser pour fermer : la feuille suit le doigt (transform posé
  // directement, sans re-rendu React), freinée vers le haut ; un geste
  // rapide suffit, inutile de tirer jusqu'au bout.
  const debut = e => {
    if (glisse.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    glisse.current = { y0: e.clientY, t0: performance.now(), dy: 0, id: e.pointerId }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    feuille.current.style.transition = 'none'
    voile.current.style.transition = 'none'
  }
  const bouge = e => {
    const g = glisse.current
    if (!g || e.pointerId !== g.id) return
    const brut = e.clientY - g.y0
    g.dy = brut > 0 ? brut : -Math.sqrt(-brut) * 2.5
    const h = feuille.current.offsetHeight || 1
    feuille.current.style.transform = `translate3d(0, ${g.dy}px, 0)`
    voile.current.style.opacity = String(Math.max(0, 1 - Math.max(0, g.dy) / h))
  }
  const fin = e => {
    const g = glisse.current
    if (!g || e.pointerId !== g.id) return
    glisse.current = null
    const vitesse = g.dy / Math.max(1, performance.now() - g.t0)
    feuille.current.style.transition = ''
    voile.current.style.transition = ''
    feuille.current.style.transform = ''
    voile.current.style.opacity = ''
    if (g.dy > (feuille.current.offsetHeight || 0) * 0.28 || (g.dy > 12 && vitesse > 0.11)) onClose()
  }
  const poignee = { onPointerDown: debut, onPointerMove: bouge, onPointerUp: fin, onPointerCancel: fin }

  if (!monte) return null
  let n = 0 // index global des tuiles, pour la cascade d'entrée

  return (
    <div className="md" data-ouvert={visible || undefined} role="dialog" aria-modal="true" aria-label="Menu">
      <div ref={voile} className="md-voile" onClick={onClose} />
      <div ref={feuille} className="md-feuille">
        {/* Carte profil — zone de prise du geste */}
        <div className="md-profil" {...poignee}>
          <div className="md-poignee" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="md-avatar">{initiales(user)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="md-nom">{nomAffiche(user)}</div>
              <div className="md-role">{roleLabel}</div>
            </div>
            <span onPointerDown={e => e.stopPropagation()}><ChoixLangue sombre /></span>
            <button type="button" onClick={onClose} onPointerDown={e => e.stopPropagation()} aria-label="Fermer" className="mh-bouton" style={{ borderRadius: '50%' }}>
              <Icon name="close" size={17} />
            </button>
          </div>
        </div>

        {/* Tuiles */}
        <div className="md-corps">
          {groupes.map((g, gi) => (
            <div key={g.titre || gi} style={{ marginBottom: 18 }}>
              {g.titre && <div className="md-groupe"><span />{g.titre}</div>}
              <div className="md-grille">
                {g.items.map(item => {
                  const { icon, label } = iconeEtLibelle(item)
                  const svg = iconeRoute(item.to)
                  const rang = n++
                  return (
                    <NavLink key={item.to} to={item.to} end={item.exact || item.to === '/'} onClick={onClose}
                      className="md-tuile" style={{ '--rang': Math.min(rang, 14) }}>
                      <span className="md-tuile-ico">{svg ? <Icon name={svg} size={21} /> : <span style={{ fontSize: 19, lineHeight: 1 }}>{icon}</span>}</span>
                      <span className="md-tuile-label">{label}</span>
                    </NavLink>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Pied : compte + déconnexion */}
        <div className="md-pied">
          <button type="button" onClick={onCompte} className="md-action"><Icon name="user" size={18} />Mon compte</button>
          <button type="button" onClick={onLogout} className="md-action md-action-sortie"><Icon name="logout" size={18} />Déconnexion</button>
        </div>
      </div>
    </div>
  )
}
