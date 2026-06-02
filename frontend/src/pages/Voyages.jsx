import React from 'react'
import { Plane, ArrowRight, MapPin, Calendar, Users, TrendingUp } from 'lucide-react'
import BarChart from '../components/BarChart'

const VOLS = [
  { num: 'AT-447', comp: 'Air Ivoire', route: 'Abidjan → RZI', arrivee: '21:30', statut: 'arrived', passagers: 38, expatries: 12, bagages: 42, retard: 0, color: 'var(--emerald-600)' },
  { num: 'AF-722', comp: 'Air France', route: 'CDG → OUA → RZI', arrivee: '23:45', statut: 'inflight', passagers: 14, expatries: 14, bagages: 18, retard: 0, color: 'var(--status-warn)' },
  { num: 'ET-921', comp: 'Ethiopian', route: 'ADD → OUA → RZI', arrivee: '02:15', statut: 'scheduled', passagers: 22, expatries: 8, bagages: 26, retard: 25, color: 'var(--status-info)' },
  { num: 'TK-456', comp: 'Turkish', route: 'IST → OUA → RZI', arrivee: '04:30', statut: 'scheduled', passagers: 9, expatries: 9, bagages: 11, retard: 0, color: 'var(--status-info)' },
]

const STATUT = { arrived: { label: 'Arrivé', color: 'ok' }, inflight: { label: 'En vol', color: 'warn' }, scheduled: { label: 'Planifié', color: 'info' } }

export default function Voyages() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Voyages & Rotations</h1>
          <p className="page-sub">4 vols cette nuit · 83 passagers attendus · 6 navettes planifiées</p>
        </div>
        <button className="btn btn-primary"><Plus size={14} /> Nouveau vol</button>
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: "Aujourd'hui", val: 83, sub: 'passagers' },
          { label: 'Cette semaine', val: 412, sub: '↑ 12%', color: 'var(--emerald-600)' },
          { label: 'Rotations ouvertes', val: 7, sub: 'à traiter' },
          { label: 'Taux ponctualité', val: '94%', sub: '↑ 3pt', color: 'var(--emerald-600)' },
        ].map((k) => (
          <div key={k.label} className="card kpi hover-lift">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{k.val}</div>
            <div style={{ fontSize: 12, color: k.color || 'var(--text-3)', marginTop: 8, fontWeight: 600 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {VOLS.map((v) => (
          <div key={v.num} className="card card-pad-lg">
            <div className="flex items-center gap-3 mb-3">
              <div style={{ width: 48, height: 48, borderRadius: 12, background: v.color, color: 'white', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 12 }}>
                {v.comp.split(' ').map((w) => w[0]).join('').slice(0, 2)}
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{v.num} · {v.comp}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{v.route}</div>
              </div>
              <span className={`badge badge-${STATUT[v.statut].color}`} style={{ marginLeft: 'auto' }}>
                {STATUT[v.statut].label}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 14 }}>
              <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Passagers</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{v.passagers}</div>
              </div>
              <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Expatriés</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{v.expatries}</div>
              </div>
              <div style={{ background: 'var(--bg-2)', borderRadius: 10, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Bagages</div>
                <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>{v.bagages}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3" style={{ fontSize: 12, color: 'var(--text-3)' }}>
              <Clock size={12} /> Arrivée prévue {v.arrivee}
              {v.retard > 0 && <span className="badge badge-warn" style={{ marginLeft: 'auto' }}>+{v.retard} min retard</span>}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .grid { display: grid; } .gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; } .mb-4 { margin-bottom: 16px; }
        .flex { display: flex; } .items-center { align-items: center; } .mt-3 { margin-top: 12px; }
        @media (max-width: 900px) { .grid[style*="1fr 1fr"], .grid[style*="repeat(4"] { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
