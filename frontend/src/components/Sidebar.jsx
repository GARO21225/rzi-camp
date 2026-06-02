import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Map, BarChart3, Bot, Building2, Wrench, UtensilsCrossed, QrCode,
  Users, Calendar, GraduationCap, ShieldCheck, Plane, Workflow, ShoppingCart,
  ClipboardList, FileText, Activity, ListChecks, History, Clock, Server, User,
  BookOpen, AlertCircle,
} from 'lucide-react'

const NAV_ITEMS = [
  { group: 'Pilotage', items: [
    { to: '/', icon: LayoutDashboard, label: 'Tableau de bord' },
    { to: '/jumeau', icon: Map, label: 'Jumeau Numérique', badge: 'NEW' },
    { to: '/analytics', icon: BarChart3, label: 'Analytics IA' },
    { to: '/copilote', icon: Bot, label: 'Copilote IA', badge: '3' },
  ]},
  { group: 'Opérations', items: [
    { to: '/residences', icon: Building2, label: 'Résidences', badge: '204' },
    { to: '/maintenance', icon: Wrench, label: 'Maintenance', badge: '7', badgeColor: 'red' },
    { to: '/restauration', icon: UtensilsCrossed, label: 'Restauration' },
    { to: '/qr', icon: QrCode, label: 'QR Anti-Fraude' },
  ]},
  { group: 'Personnes', items: [
    { to: '/personnel', icon: Users, label: 'Personnel' },
    { to: '/evenements', icon: Calendar, label: 'Événements' },
    { to: '/induction', icon: GraduationCap, label: 'Induction' },
    { to: '/presences', icon: Clock, label: 'Présences' },
  ]},
  { group: 'Commerce', items: [
    { to: '/boutique', icon: ShoppingCart, label: 'Boutique' },
    { to: '/pos', icon: ClipboardList, label: 'POS' },
  ]},
  { group: 'Mouvements', items: [
    { to: '/voyages', icon: Plane, label: 'Voyages' },
    { to: '/rotations', icon: Workflow, label: 'Rotations' },
    { to: '/reservations', icon: BookOpen, label: 'Réservations' },
  ]},
  { group: 'Conformité', items: [
    { to: '/audit', icon: ShieldCheck, label: 'Audit Trail' },
    { to: '/workflows', icon: Workflow, label: 'Workflow Hub' },
    { to: '/centre', icon: Activity, label: 'Centre Opérationnel' },
    { to: '/status', icon: Server, label: 'Status Système' },
  ]},
  { group: 'Pilotage RH', items: [
    { to: '/demandes', icon: ListChecks, label: 'Demandes' },
    { to: '/annuaire', icon: Users, label: 'Annuaire' },
    { to: '/rapports', icon: FileText, label: 'Rapports' },
    { to: '/historique', icon: History, label: 'Historique' },
  ]},
  { group: 'Compte', items: [
    { to: '/compte', icon: User, label: 'Mon Compte' },
  ]},
]

export default function Sidebar({ inDrawer = false, onNavigate, currentView }) {
  return (
    <aside className={`sidebar ${inDrawer ? 'in-drawer' : ''}`}>
      <div className="sidebar-brand">
        <img src="/roxgold-logo.png" alt="Roxgold" className="brand-img" />
        <div>
          <div className="brand-name">RZI CAMP</div>
          <div className="brand-sub">Roxgold · Côte d'Ivoire</div>
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: 'auto', padding: '0 12px 20px' }}>
        {NAV_ITEMS.map((group) => (
          <div key={group.group} className="nav-group">
            <div className="nav-label">{group.group}</div>
            {group.items.map((item) => {
              const active = currentView ? currentView === item.to.replace(/^\//, '') : false
              if (onNavigate) {
                return (
                  <button
                    key={item.to}
                    onClick={() => onNavigate(item.to.replace(/^\//, ''))}
                    className={`nav-item ${active ? 'active' : ''}`}
                    style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
                  >
                    <item.icon size={18} />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span className={`nav-pill ${item.badgeColor === 'red' ? 'red' : item.badgeColor === 'emerald' ? 'emerald' : ''}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                )
              }
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className={`nav-pill ${item.badgeColor === 'red' ? 'red' : item.badgeColor === 'emerald' ? 'emerald' : ''}`}>
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <div className="user-card">
          <div className="avatar">AO</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: 'white', fontSize: 13, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Aminata Ouédraogo
            </div>
            <div style={{ color: 'var(--gold-400)', fontSize: 11, marginTop: 2 }}>Manager Camp</div>
          </div>
        </div>
      </div>

      <style>{`
        .sidebar {
          background: var(--ink-950);
          color: rgba(255,255,255,.78);
          border-right: 1px solid rgba(255,255,255,.05);
          display: flex; flex-direction: column;
          position: sticky; top: 0; height: 100dvh;
          z-index: 20;
        }
        .sidebar::before {
          content: ""; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, var(--gold-500), var(--gold-400) 50%, var(--orange-500));
          z-index: 1;
        }
        [data-theme="dark"] .sidebar { background: var(--ink-950); }
        .sidebar-brand { padding: 22px 18px 16px; display: flex; align-items: center; gap: 12px; }
        .brand-mark {
          width: 36px; height: 36px;
          background: linear-gradient(135deg, var(--copper-500), var(--copper-700));
          border-radius: 10px; display: grid; place-items: center;
          color: white; font-weight: 800; font-size: 16px;
          box-shadow: 0 4px 12px rgba(12,78,162,.4);
          letter-spacing: -0.5px;
        }
        .brand-img {
          width: 36px; height: 36px;
          object-fit: contain;
          background: white;
          border-radius: 8px;
          padding: 4px;
          box-shadow: 0 2px 8px rgba(0,0,0,.15);
        }
        .brand-name { color: white; font-weight: 700; font-size: 16px; letter-spacing: -0.01em; }
        .brand-sub { color: var(--gold-400); font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase; margin-top: 1px; font-weight: 600; }
        .nav-group { padding: 0 4px; margin-bottom: 18px; }
        .nav-label { font-size: 10px; font-weight: 700; color: rgba(255,255,255,.35); letter-spacing: 0.14em; text-transform: uppercase; padding: 0 8px 8px; }
        .nav-item {
          display: flex; align-items: center; gap: 12px;
          padding: 8px 12px; border-radius: 9px;
          color: rgba(255,255,255,.7);
          font-size: 13.5px; font-weight: 500;
          text-decoration: none;
          transition: all .15s;
          position: relative;
          margin-bottom: 1px;
        }
        .nav-item:hover { background: rgba(255,255,255,.05); color: white; }
        .nav-item.active {
          background: linear-gradient(90deg, rgba(12,78,162,.35), rgba(12,78,162,.05));
          color: white;
          box-shadow: inset 2px 0 0 var(--gold-500);
        }
        .nav-pill {
          margin-left: auto;
          background: var(--copper-600);
          color: white;
          font-size: 10px; font-weight: 700;
          padding: 2px 7px; border-radius: 999px;
        }
        .nav-pill.red { background: var(--status-alert); }
        .nav-pill.emerald { background: var(--emerald-600); }
        .sidebar-foot { padding: 14px; border-top: 1px solid rgba(255,255,255,.05); }
        .user-card { display: flex; align-items: center; gap: 10px; padding: 6px; border-radius: 10px; }
        .avatar { width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, var(--copper-500), var(--emerald-600));
          display: grid; place-items: center;
          color: white; font-weight: 700; font-size: 13px; flex-shrink: 0;
        }
        @media (max-width: 1024px) { .sidebar { display: none; } }
      `}</style>
    </aside>
  )
}
