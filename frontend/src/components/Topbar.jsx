import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Bell, Sun, Moon, Mic } from 'lucide-react'
import { useStore } from '../store/useStore'

const TITLES = {
  '/': 'Tableau de bord',
  '/jumeau': 'Jumeau Numérique',
  '/analytics': 'Analytics IA',
  '/copilote': 'Copilote IA',
  '/residences': 'Résidences',
  '/maintenance': 'Maintenance',
  '/restauration': 'Restauration',
  '/qr': 'QR Anti-Fraude',
  '/personnel': 'Personnel',
  '/evenements': 'Événements',
  '/induction': 'Induction',
  '/presences': 'Présences',
  '/boutique': 'Boutique',
  '/pos': 'Point de Vente',
  '/voyages': 'Voyages',
  '/rotations': 'Rotations',
  '/reservations': 'Réservations',
  '/audit': 'Audit Trail',
  '/workflows': 'Workflow Hub',
  '/centre': 'Centre Opérationnel',
  '/status': 'Status Système',
  '/demandes': 'Demandes',
  '/annuaire': 'Annuaire',
  '/rapports': 'Rapports',
  '/historique': 'Historique',
  '/compte': 'Mon Compte',
}

export default function Topbar({ onToggleCopilot, onMenu }) {
  const location = useLocation()
  const { theme, setTheme, lang, setLang } = useStore()
  const title = TITLES[location.pathname] || 'RZI Camp'
  const navigate = useNavigate()
  const [notifOpen, setNotifOpen] = useState(false)

  // ⌘K shortcut to focus search
  useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        document.querySelector('.topbar-search input')?.focus()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div className="topbar">
      {onMenu && (
        <button className="topbar-hamburger" onClick={onMenu} aria-label="Menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
        </button>
      )}
      <div className="topbar-title">
        <span className="crumb">RZI Camp</span>
        <span>{title}</span>
      </div>

      <div className="topbar-search">
        <Search size={18} />
        <input placeholder="Rechercher un bâtiment, un employé, un incident…" />
        <span className="kbd">⌘K</span>
      </div>

      <div className="lang-switch">
        {['FR', 'EN', 'RU'].map((l) => (
          <button key={l} className={lang.toUpperCase() === l ? 'active' : ''} onClick={() => setLang(l.toLowerCase())}>
            {l}
          </button>
        ))}
      </div>

      <button className="topbar-action" title="Commande vocale">
        <Mic size={18} />
      </button>

      <button className="topbar-action" title="Thème" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>

      <button className="topbar-action" title="Notifications" onClick={() => setNotifOpen(!notifOpen)}>
        <Bell size={18} />
        <span className="dot dot-alert" />
      </button>

      <button className="topbar-action" title="Copilote IA" onClick={onToggleCopilot} style={{ color: 'var(--gold-600)' }}>
        🤖
      </button>

      <style>{`
        .topbar {
          display: flex; align-items: center; gap: 14px;
          height: 64px;
          padding: 0 28px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          position: sticky; top: 0; z-index: 10;
        }
        .topbar-title { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; color: var(--text); }
        .topbar-title .crumb { color: var(--text-3); font-weight: 500; margin-right: 6px; }
        .topbar-search { flex: 1; max-width: 480px; margin: 0 auto; position: relative; }
        .topbar-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-3); }
        .topbar-search input {
          width: 100%; height: 40px;
          background: var(--bg-2);
          border: 1.5px solid transparent;
          border-radius: 12px;
          padding: 0 14px 0 40px;
          font-family: inherit; font-size: 13.5px;
          color: var(--text);
          outline: none;
          transition: all .15s;
        }
        .topbar-search input:focus { background: var(--surface); border-color: var(--copper-500); }
        .kbd {
          position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
          background: var(--surface); border: 1px solid var(--border-2);
          padding: 2px 7px; border-radius: 6px; font-size: 11px; font-weight: 600;
          color: var(--text-3); font-family: var(--font-mono);
        }
        .lang-switch { display: flex; gap: 2px; padding: 3px; background: var(--bg-2); border-radius: 9px; }
        .lang-switch button {
          border: none; background: transparent;
          padding: 4px 9px; border-radius: 6px;
          font-size: 11.5px; font-weight: 700; cursor: pointer;
          color: var(--text-3); font-family: inherit;
        }
        .lang-switch button.active { background: var(--surface); color: var(--text); box-shadow: var(--shadow-xs); }
        .topbar-action {
          width: 40px; height: 40px;
          border-radius: 10px;
          background: var(--bg-2);
          color: var(--text-2);
          display: grid; place-items: center;
          cursor: pointer;
          transition: all .15s;
          position: relative;
          border: 1.5px solid transparent;
        }
        .topbar-action:hover { background: var(--surface); border-color: var(--border-2); color: var(--text); }
        .topbar-action .dot { position: absolute; top: 9px; right: 9px; }
        @media (max-width: 768px) { .topbar { padding: 0 16px; } .topbar-search { display: none; } }
        .topbar-hamburger { display: none; width: 40px; height: 40px; border-radius: 10px; background: var(--bg-2); border: 1.5px solid transparent; color: var(--text-2); cursor: pointer; align-items: center; justify-content: center; }
        .topbar-hamburger:hover { background: var(--surface); border-color: var(--border-2); color: var(--text); }
        @media (max-width: 1024px) { .topbar-hamburger { display: inline-flex; } }
      `}</style>
    </div>
  )
}
