// Sidebar V2 — Groupé, Roxgold, avec labels V2 + routes V1
// Connexion au backend inchangée (routes V1 utilisées)
import React from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useStore } from '../store'

// ROUTES V1 inchangées (le backend ne bouge pas)
// LABELS V2 affichés dans la sidebar
const NAV_GROUPS = [
  {
    label: 'PILOTAGE',
    items: [
      { to: '/',           label: 'Tableau de bord',     icon: '📊' },
      { to: '/carte',      label: 'Jumeau Numérique',    icon: '🌐', badge: 'NEW' },
      { to: '/analytics',  label: 'Analytics IA',        icon: '📈' },
      { to: '/assistant',  label: 'Copilote IA',         icon: '🤖', badge: 3 },
    ],
  },
  {
    label: 'OPÉRATIONS',
    items: [
      { to: '/residences',   label: 'Résidences',    icon: '🏠', badge: 204 },
      { to: '/maintenance',  label: 'Maintenance',   icon: '🛠️', badge: 7 },
      { to: '/restauration', label: 'Restauration',  icon: '🍽️' },
      { to: '/qr',           label: 'QR Anti-Fraude',icon: '🔒' },
    ],
  },
  {
    label: 'PERSONNES',
    items: [
      { to: '/personnel',  label: 'Personnel',   icon: '👤' },
      { to: '/evenements', label: 'Événements',  icon: '📅' },
      { to: '/induction',  label: 'Induction',   icon: '🎓' },
    ],
  },
  {
    label: 'HÉBERGEMENT & MOBILITÉ',
    items: [
      { to: '/voyages',    label: 'Voyages',    icon: '✈️' },
      { to: '/rotations',  label: 'Rotations',  icon: '🔄' },
    ],
  },
  {
    label: 'SERVICES',
    items: [
      { to: '/boutique',     label: 'Bar & Boutique', icon: '🛒' },
      { to: '/boutique-pos', label: 'Boutique POS',   icon: '💳' },
      { to: '/reservations', label: 'Réservations',   icon: '📋' },
    ],
  },
  {
    label: 'EXPLOITATION',
    items: [
      { to: '/demandes',  label: 'Demandes',    icon: '📝' },
      { to: '/presences', label: 'Présences',   icon: '✅' },
      { to: '/workflows', label: 'Workflow Hub',icon: '⚙️' },
    ],
  },
  {
    label: 'CONFORMITÉ',
    items: [
      { to: '/audit',       label: 'Audit Trail',      icon: '🛡️' },
      { to: '/historique',  label: 'Historique',       icon: '📜' },
      { to: '/rapports',    label: 'Rapports',         icon: '📄' },
      { to: '/status',      label: 'Diagnostic',       icon: '🔧' },
    ],
  },
  {
    label: 'COMPTE',
    items: [
      { to: '/mon-compte',  label: 'Mon Compte',  icon: '👤' },
      { to: '/annuaire',    label: 'Annuaire',    icon: '📇' },
      { to: '/operations',  label: 'Centre Op.',  icon: '🖥️' },
    ],
  },
]

// Palette Roxgold (extraite du logo) + couleurs sémantiques
const COLORS = {
  bg:        '#0a1628',          // Roxgold blue (dark)
  bgAlt:     '#0f2044',          // Roxgold blue alt
  text:      '#ffffff',          // BLANC PUR — items
  textDim:   '#cbd5e1',          // gris clair — items inactifs (suffisamment lisible)
  textGroup: '#94a3b8',          // gris — titres de groupe
  active:    '#e87722',          // Roxgold ORANGE — item actif
  activeBg:  'rgba(232,119,34,.15)',
  border:    'rgba(255,255,255,.08)',
  hover:     'rgba(255,255,255,.06)',
  gold:      '#ffcd00',          // Roxgold GOLD — badges NEW
  red:       '#dc2626',          // alerts
  green:     '#16a34a',          // success
}

function SidebarItem({ to, label, icon, badge, exact, isActive }) {
  // Badge peut être un nombre ou du texte ('NEW')
  const isNewBadge = typeof badge === 'string'
  const isNumberBadge = typeof badge === 'number' && badge > 0

  return (
    <NavLink to={to} end={exact}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', margin: '1px 6px',
        borderRadius: 8, textDecoration: 'none',
        fontSize: 13.5, fontWeight: isActive ? 700 : 500,
        color: isActive ? COLORS.active : COLORS.text,
        background: isActive ? COLORS.activeBg : 'transparent',
        borderLeft: isActive ? `3px solid ${COLORS.active}` : '3px solid transparent',
        transition: 'all .15s ease',
      }}
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = COLORS.hover }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ fontSize: 16, flexShrink: 0, width: 20, textAlign: 'center' }}>{icon}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {isNewBadge && (
        <span style={{
          background: COLORS.gold, color: '#1a0e00',
          fontSize: 9, fontWeight: 800, padding: '2px 7px', borderRadius: 6,
          letterSpacing: '.04em',
        }}>{badge}</span>
      )}
      {isNumberBadge && (
        <span style={{
          background: COLORS.red, color: 'white',
          fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 99,
          minWidth: 20, textAlign: 'center',
        }}>{badge}</span>
      )}
    </NavLink>
  )
}

export default function Sidebar({ currentPath }) {
  const navigate = useNavigate()
  const { user, logout } = useStore()
  const role = user?.profile?.role || (user?.is_superuser ? 'admin' : 'agent')

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
        borderBottom: `3px solid ${COLORS.gold}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 36, height: 36,
          background: `linear-gradient(135deg, ${COLORS.active}, #c25a18)`,
          borderRadius: 8, display: 'grid', placeItems: 'center',
          color: 'white', fontWeight: 800, fontSize: 14,
          boxShadow: '0 2px 8px rgba(232,119,34,.4)',
        }}>
          RZ
        </div>
        <div>
          <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 800, letterSpacing: '-.01em' }}>
            RZI CAMP
          </div>
          <div style={{ color: COLORS.textDim, fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600 }}>
            Roxgold · Côte d'Ivoire
          </div>
        </div>
      </div>

      {/* Nav items groupés */}
      <nav style={{ flex: 1, padding: '8px 6px 20px' }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} style={{ marginBottom: 6 }}>
            {/* Titre de groupe */}
            <div style={{
              fontSize: 10, fontWeight: 800,
              color: COLORS.textGroup,
              letterSpacing: '1.4px', textTransform: 'uppercase',
              padding: '10px 12px 6px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ flex: 1, height: 1, background: COLORS.border, marginRight: 4 }} />
              {group.label}
              <span style={{ flex: 1, height: 1, background: COLORS.border, marginLeft: 4 }} />
            </div>

            {/* Items */}
            {group.items.map((item) => {
              const isActive = currentPath === item.to || (item.to === '/' && (currentPath === '/' || currentPath === ''))
              return (
                <SidebarItem
                  key={item.to}
                  to={item.to}
                  label={item.label}
                  icon={item.icon}
                  badge={item.badge}
                  exact={item.exact}
                  isActive={isActive}
                />
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
          background: `linear-gradient(135deg, ${COLORS.active}, #c25a18)`,
          color: 'white', display: 'grid', placeItems: 'center',
          fontWeight: 800, fontSize: 14, flexShrink: 0,
        }}>
          {(user?.first_name?.[0] || user?.username?.[0] || 'U').toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: COLORS.text, fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : (user?.username || 'Utilisateur')}
          </div>
          <div style={{ color: COLORS.active, fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
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
