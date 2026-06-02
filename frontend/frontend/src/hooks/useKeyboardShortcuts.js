/**
 * Keyboard shortcuts hook for quick navigation
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export function useKeyboardShortcuts(enabled = true) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!enabled) return

    const handler = (e) => {
      // Ctrl/Cmd + key shortcuts
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case '1': e.preventDefault(); navigate('/'); break
          case '2': e.preventDefault(); navigate('/carte'); break
          case '3': e.preventDefault(); navigate('/residences'); break
          case '4': e.preventDefault(); navigate('/personnel'); break
          case '5': e.preventDefault(); navigate('/voyages'); break
          case '6': e.preventDefault(); navigate('/restauration'); break
          case '7': e.preventDefault(); navigate('/maintenance'); break
          case '8': e.preventDefault(); navigate('/demandes'); break
          case 'd': e.preventDefault(); navigate('/dashboard'); break
          case 'a': e.preventDefault(); navigate('/analytics'); break
          case 'h': e.preventDefault(); navigate('/historique'); break
        }
      }

      // Escape to close modals (handled by components)
      if (e.key === 'Escape') {
        document.dispatchEvent(new CustomEvent('keyboard-escape'))
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, enabled])
}

/**
 * Quick actions FAB component
 */
export function QuickActionsFAB({ isAdmin }) {
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)

  if (!isAdmin) return null

  const actions = [
    { icon: '🏠', label: 'Nouvelle chambre', action: () => navigate('/residences') },
    { icon: '👤', label: 'Ajouter personnel', action: () => navigate('/personnel') },
    { icon: '📅', label: 'Nouvel événement', action: () => navigate('/evenements') },
    { icon: '✈️', label: 'Déclarer voyage', action: () => navigate('/voyages') },
    { icon: '🛠️', label: 'Signaler incident', action: () => navigate('/maintenance') },
    { icon: '📝', label: 'Nouvelle demande', action: () => navigate('/demandes') },
  ]

  return React.createElement('div', { style: { position: 'fixed', bottom: 24, right: 24, zIndex: 999 } },
    open && React.createElement('div', { style: { position: 'absolute', bottom: 64, right: 0, background: 'var(--surface)', borderRadius: 16, boxShadow: 'var(--shadow-md)', border: '1px solid var(--border)', overflow: 'hidden', minWidth: 180, animation: 'slideUp .2s ease' } },
      ...actions.map((a, i) =>
        React.createElement('button', { key: i, onClick: () => { a.action(); setOpen(false) }, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'transparent', border: 'none', color: 'var(--text)', cursor: 'pointer', width: '100%', fontSize: 13, textAlign: 'left', borderBottom: i < actions.length - 1 ? '1px solid var(--border)' : 'none' } },
          React.createElement('span', { style: { fontSize: 18 } }, a.icon),
          a.label
        )
      )
    ),
    React.createElement('button', { onClick: () => setOpen(o => !o), style: { width: 56, height: 56, borderRadius: '50%', background: 'var(--rzi-blue)', color: '#fff', border: 'none', fontSize: 24, cursor: 'pointer', boxShadow: '0 4px 20px rgba(30,58,138,.4)', transition: 'transform .2s' } },
      open ? '✕' : '+'
    )
  )
}

// Need React import for FAB
import React from 'react'