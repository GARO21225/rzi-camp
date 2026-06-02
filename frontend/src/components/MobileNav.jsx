// MobileNav — Bottom navigation + Drawer pour mobile
// Ajouté en V2, ne remplace aucun composant du V1.
// Le Layout.jsx peut importer ces helpers optionnellement.
import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

// Bottom navigation : 5 items clés sur mobile
const BOTTOM_NAV = [
  { to: '/',             label: 'Accueil',   icon: '🏠' },
  { to: '/carte',        label: 'Carte',     icon: '🗺️' },
  { to: '/maintenance',  label: 'Tickets',   icon: '🛠️' },
  { to: '/personnel',    label: 'Équipe',    icon: '👥' },
  { to: '/assistant',    label: 'IA',        icon: '🤖' },
]

export default function MobileNav({ onMenu }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (!isMobile) return null

  return (
    <>
      <nav style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--topbar-bg,#0a1628)',
        borderTop: '1px solid rgba(255,255,255,.08)',
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
        zIndex: 499,
        paddingBottom: 'env(safe-area-inset-bottom, 0)',
        boxShadow: '0 -4px 12px rgba(0,0,0,.3)',
      }}>
        {BOTTOM_NAV.map((item) => {
          const active = location.pathname === item.to
          return (
            <button key={item.to} onClick={() => navigate(item.to)}
              style={{
                background: 'none', border: 'none',
                color: active ? 'var(--gold,#f0a500)' : 'rgba(255,255,255,.7)',
                padding: '8px 4px', display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 2, cursor: 'pointer',
                fontSize: 10, fontWeight: active ? 700 : 500,
              }}>
              <span style={{ fontSize: 20 }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}

// Drawer — wrapper qui slide depuis la gauche
// Utilisé en option par Layout pour afficher la sidebar en mobile.
export function Drawer({ open, onClose, children }) {
  if (!open) return null
  return (
    <>
      <div onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
          zIndex: 998, animation: 'fadeIn .2s ease',
        }} />
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 280, maxWidth: '85vw',
        background: 'var(--sidebar-bg,#0a1628)',
        zIndex: 999, overflowY: 'auto',
        boxShadow: '4px 0 24px rgba(0,0,0,.4)',
        animation: 'slideInLeft .25s ease',
      }}>
        {children}
      </div>
      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  )
}
