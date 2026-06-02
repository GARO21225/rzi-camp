// Sidebar V2 — Navigation latérale groupée et lisible
// Fidèle à la V1 : utilise les VRAIS noms des pages (Boutique, Reservations, etc.)
// AUCUN renommage, AUCUNE page supprimée.
// Couleurs avec contraste élevé pour rester lisible dans tous les modes.
import React from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from '../store'

// ── TOUTES les 26 pages V1, groupées (noms fidèles au V1) ─────────
const NAV_GROUPS = [
  {
    label: 'OPÉRATIONS',
    items: [
      { to: '/',          label: 'Dashboard',          icon: '📊', exact: true },
      { to: '/carte',     label: 'Carte GIS',          icon: '🗺️' },
      { to: '/operations',label: 'Centre Opérationnel',icon: '🖥️' },
    ],
  },
  {
    label: 'PERSONNES',
    items: [
      { to: '/personnel', label: 'Personnel',     icon: '👥' },
      { to: '/annuaire',  label: 'Annuaire',      icon: '📋' },
      { to: '/induction', label: 'Induction QHSE',icon: '🎓' },
    ],
  },
  {
    label: 'HÉBERGEMENT & MOBILITÉ',
    items: [
      { to: '/residences', label: 'Résidences',  icon: '🏠' },
      { to: '/voyages',    label: 'Voyages',     icon: '✈️' },
      { to: '/rotations',  label: 'Rotations',   icon: '🔄' },
    ],
  },
  {
    label: 'SERVICES AUX RÉSIDENTS',
    items: [
      { to: '/restauration', label: 'Restauration',  icon: '🍽️' },
      { to: '/boutique',     label: 'Bar & Boutique',icon: '🛒' },
      { to: '/boutique-pos', label: 'Boutique POS',  icon: '💳' },
      { to: '/reservations', label: 'Réservations',  icon: '📅' },
    ],
  },
  {
    label: 'EXPLOITATION',
    items: [
      { to: '/maintenance', label: 'Maintenance',  icon: '🛠️' },
      { to: '/evenements',  label: 'Événements',   icon: '📡' },
      { to: '/demandes',    label: 'Demandes',     icon: '📝' },
      { to: '/presences',   label: 'Présences',    icon: '✅' },
      { to: '/workflows',   label: 'Workflow Hub', icon: '⚙️' },
    ],
  },
  {
    label: 'PILOTAGE & ANALYSE',
    items: [
      { to: '/analytics',  label: 'Analytics',    icon: '📈' },
      { to: '/rapports',   label: 'Rapports',     icon: '📄' },
      { to: '/historique', label: 'Historique',   icon: '📋' },
      { to: '/audit',      label: 'Audit',        icon: '🔍' },
      { to: '/assistant',  label: 'Assistant IA', icon: '🤖' },
      { to: '/status',     label: 'Diagnostic',   icon: '🔧' },
    ],
  },
  {
    label: 'COMPTE',
    items: [
      { to: '/mon-compte', label: 'Mon Compte', icon: '👤' },
    ],
  },
]

// Couleurs avec CONTRASTE ÉLEVÉ — toujours lisible
const COLORS = {
  bg:        '#0a1628',          // dark navy (forcé, peu importe le thème)
  bgAlt:     '#0f2044',
  text:      '#ffffff',          // BLANC PUR pour les items
  textDim:   '#cbd5e1',          // gris clair pour les items inactifs
  textGroup: '#94a3b8',          // gris pour les titres de groupe
  active:    '#f0a500',          // or Roxgold pour l'item actif
  activeBg:  'rgba(240,165,0,.12)',
  border:    'rgba(255,255,255,.08)',
  hover:     'rgba(255,255,255,.06)',
}

export default function Sidebar({ onNavigate, currentPath, badges = {} }) {
  const navigate = useNavigate()
  const { user, logout } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')

  const handleClick = (to, e) => {
    if (onNavigate) {
      e.preventDefault()
      onNavigate(to)
    }
  }

  return (
    <aside style={{
      width: 240, height: '100%',
      background: COLORS.bg,
      color: COLORS.text,
      display: 'flex', flexDirection: 'column',
      flexShrink: 0,
      overflowY: 'auto', overflowX: 'hidden',
      borderRight: `1px solid ${COLORS.border}`,
      fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
    }}>
      {/* Brand */}
      <div style={{
        padding: '16px 14px 14px',
        background: COLORS.bgAlt,
        borderBottom: `3px solid #f0a500`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 36, height: 36, background: 'white',
          borderRadius: 8, padding: 4, display: 'grid', placeItems: 'center',
        }}>
          <img src="/roxgold-logo.png" alt="Roxgold" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        <div>
          <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 800, letterSpacing: '-.01em' }}>RZI CAMP</div>
          <div style={{ color: '#f0a500', fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 700 }}>Roxgold · Côte d'Ivoire</div>
        </div>
      </div>

      {/* Nav items groupés */}
      <nav style={{ flex: 1, padding: '8px 6px 20px' }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} style={{ marginBottom: 8 }}>
            {/* Titre de groupe — TRÈS LISIBLE */}
            <div style={{
              fontSize: 10, fontWeight: 800,
              color: COLORS.textGroup,                // contraste fort
              letterSpacing: '1.4px', textTransform: 'uppercase',
              padding: '10px 12px 6px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{
                flex: 1, height: 1,
                background: COLORS.border,
                marginRight: 4,
              }} />
              {group.label}
              <span style={{
                flex: 1, height: 1,
                background: COLORS.border,
                marginLeft: 4,
              }} />
            </div>

            {/* Items */}
            {group.items.map((item) => {
              const isActive = currentPath === item.to || (currentPath === '/' && item.to === '/')
              return (
                <NavLink key={item.to} to={item.to} end={item.exact}
                  onClick={(e) => handleClick(item.to, e)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px',
                    margin: '1px 4px',
                    borderRadius: 8,
                    textDecoration: 'none',
                    fontSize: 13.5,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? COLORS.active : COLORS.text,  // BLANC ou OR — TRÈS LISIBLE
                    background: isActive ? COLORS.activeBg : 'transparent',
                    borderLeft: isActive ? `3px solid ${COLORS.active}` : '3px solid transparent',
                    transition: 'all .15s ease',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = COLORS.hover }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0, width: 20, textAlign: 'center' }}>{item.icon}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.label}
                  </span>
                  {badges[item.to] != null && badges[item.to] > 0 && (
                    <span style={{
                      background: '#dc2626', color: 'white',
                      fontSize: 10, fontWeight: 800,
                      padding: '2px 7px', borderRadius: 99,
                      minWidth: 20, textAlign: 'center',
                    }}>
                      {badges[item.to]}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div style={{
        padding: '12px 14px',
        borderTop: `1px solid ${COLORS.border}`,
        background: COLORS.bgAlt,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: 'linear-gradient(135deg, #f0a500, #b07800)',
          color: '#1a0e00', display: 'grid', placeItems: 'center',
          fontWeight: 800, fontSize: 14, flexShrink: 0,
        }}>
          {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: COLORS.text, fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : (user?.username || 'Utilisateur')}
          </div>
          <div style={{ color: '#f0a500', fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            {role}
          </div>
        </div>
        <button onClick={() => { logout(); navigate('/login') }} title="Déconnexion"
          style={{
            background: 'rgba(255,255,255,.1)', border: 'none', color: 'white',
            width: 30, height: 30, borderRadius: 6, cursor: 'pointer',
            fontSize: 14, flexShrink: 0,
          }}>
          ⎋
        </button>
      </div>
    </aside>
  )
}
