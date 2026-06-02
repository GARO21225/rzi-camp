import React from 'react'
import {
  LayoutDashboard, Map, Wrench, Users, Menu, X, Bot,
} from 'lucide-react'

/**
 * MobileNav — Bottom navigation bar visible uniquement sur mobile
 */
export default function MobileNav({ current, onNavigate, onMenu }) {
  const items = [
    { id: 'dashboard', label: 'Accueil', icon: LayoutDashboard },
    { id: 'jumeau', label: 'Jumeau', icon: Map },
    { id: 'maintenance', label: 'Tickets', icon: Wrench, badge: 7 },
    { id: 'personnel', label: 'Équipe', icon: Users },
    { id: 'copilote', label: 'IA', icon: Bot, badge: 3 },
  ]
  return (
    <>
      <nav className="mobile-nav">
        {items.map((it) => {
          const Icon = it.icon
          const active = current === it.id
          return (
            <button
              key={it.id}
              className={`mobile-nav-item ${active ? 'active' : ''}`}
              onClick={() => onNavigate(it.id)}
            >
              <div className="mobile-nav-icon">
                <Icon size={20} />
                {it.badge && <span className="mobile-nav-badge">{it.badge}</span>}
              </div>
              <span className="mobile-nav-label">{it.label}</span>
            </button>
          )
        })}
        <button className="mobile-nav-item" onClick={onMenu}>
          <div className="mobile-nav-icon"><Menu size={20} /></div>
          <span className="mobile-nav-label">Plus</span>
        </button>
      </nav>
      <style>{`
        .mobile-nav {
          display: none;
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
          background: var(--surface);
          border-top: 1px solid var(--border);
          box-shadow: 0 -4px 20px rgba(0,30,66,.08);
          padding: 6px 4px calc(6px + env(safe-area-inset-bottom, 0px));
          justify-content: space-around;
        }
        .mobile-nav-item {
          flex: 1;
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          background: none; border: none; cursor: pointer;
          padding: 6px 4px; border-radius: 8px;
          color: var(--text-3);
          transition: all .15s;
        }
        .mobile-nav-item.active { color: var(--copper-600); }
        .mobile-nav-icon { position: relative; }
        .mobile-nav-badge {
          position: absolute; top: -4px; right: -8px;
          background: var(--status-alert); color: white;
          font-size: 9px; font-weight: 700;
          padding: 1px 5px; border-radius: 999px;
          min-width: 16px; text-align: center;
        }
        .mobile-nav-label { font-size: 10px; font-weight: 600; }
        @media (max-width: 1024px) {
          .mobile-nav { display: flex; }
        }
      `}</style>
    </>
  )
}

/**
 * Drawer — Menu latéral mobile qui slide depuis la gauche
 */
export function Drawer({ open, onClose, children }) {
  return (
    <>
      {open && <div className="drawer-overlay" onClick={onClose} />}
      <aside className={`drawer ${open ? 'open' : ''}`}>
        <button className="drawer-close" onClick={onClose} aria-label="Fermer">
          <X size={20} />
        </button>
        <div className="drawer-content">
          {children}
        </div>
      </aside>
      <style>{`
        .drawer-overlay {
          position: fixed; inset: 0; background: rgba(10,14,21,.5);
          backdrop-filter: blur(4px);
          z-index: 60;
          animation: fadeIn .2s;
        }
        .drawer {
          position: fixed; top: 0; left: 0; bottom: 0;
          width: 280px; max-width: 85vw;
          background: var(--ink-950);
          z-index: 70;
          transform: translateX(-100%);
          transition: transform .3s cubic-bezier(.16,1,.3,1);
          overflow-y: auto;
          box-shadow: 0 0 40px rgba(0,0,0,.3);
        }
        .drawer.open { transform: translateX(0); }
        .drawer-close {
          position: absolute; top: 16px; right: 16px;
          width: 36px; height: 36px; border-radius: 10px;
          background: rgba(255,255,255,.1); border: 1px solid rgba(255,255,255,.15);
          color: white; cursor: pointer;
          display: grid; place-items: center;
        }
        .drawer-content { padding: 70px 0 80px; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @media (min-width: 1025px) { .drawer { display: none; } }
      `}</style>
    </>
  )
}
