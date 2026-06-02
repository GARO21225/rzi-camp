import React from 'react'
import { Workflow, Plus, ArrowRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'

const WFS = [
  { id: 'WF-2026-188', name: 'Induction nouveau', steps: 8, done: 8, status: 'completed', color: 'var(--emerald-500)' },
  { id: 'WF-2026-187', name: 'Rotation Crew A', steps: 6, done: 6, status: 'completed', color: 'var(--emerald-500)' },
  { id: 'WF-2026-186', name: 'Incident pompe P-203', steps: 5, done: 3, status: 'in_progress', color: 'var(--copper-500)' },
  { id: 'WF-2026-185', name: 'Audit QR hebdo', steps: 4, done: 4, status: 'completed', color: 'var(--emerald-500)' },
  { id: 'WF-2026-184', name: 'Inventaire stock', steps: 7, done: 2, status: 'in_progress', color: 'var(--copper-500)' },
  { id: 'WF-2026-183', name: 'Rapport mensuel', steps: 5, done: 1, status: 'in_progress', color: 'var(--copper-500)' },
]

const STATUS_MAP = { completed: { label: 'Terminé', color: 'ok' }, in_progress: { label: 'En cours', color: 'info' }, blocked: { label: 'Bloqué', color: 'alert' } }

export default function Workflows() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Workflow Hub</h1>
          <p className="page-sub">6 workflows actifs · 3 terminés · 3 en cours · 0 bloqués</p>
        </div>
        <button className="btn btn-primary"><Plus size={14} /> Nouveau workflow</button>
      </div>

      <div className="grid gap-4" style={{   gridTemplateColumns: 'repeat(2 }}>
        {WFS.map((w) => (
          <div key={w.id} className="card card-pad-lg hover-lift">
            <div className="flex items-center gap-3 mb-3">
              <div style={{   width: 44,   height: 44,   borderRadius: 12,   background: w.color,   color: 'white',   display: 'grid',   placeItems: 'center' }}>
                {w.status === 'completed' ? <CheckCircle2 size={22} /> : <Clock size={22} />}
              </div>
              <div>
                <div style={{   fontSize: 14,   fontWeight: 700 }}>{w.name}</div>
                <div style={{   fontSize: 11,   color: 'var(--text-3)',   fontFamily: 'var(--font-mono)' }}>{w.id}</div>
              </div>
              <span className={`badge badge-${STATUS_MAP[w.status].color}`} style={{   marginLeft: 'auto' }}>{STATUS_MAP[w.status].label}</span>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <div style={{   flex: 1 }}>
                <ProgressBar value={w.done} max={w.steps} color={w.status === 'completed' ? 'emerald' : 'copper'} showLabel label={`${w.done}/${w.steps} étapes`} />
              </div>
            </div>

            <div className="flex items-center justify-between mt-3" style={{   fontSize: 11,   color: 'var(--text-3)' }}>
              <span>Mis à jour il y a 12 min</span>
              <button className="btn btn-sm btn-ghost">Détails <ArrowRight size={12} /></button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .grid { display: grid; } .gap-4 { gap: 16px; }
        .flex { display: flex; } .items-center { align-items: center; } .justify-between { justify-content: space-between; }
        .mt-3 { margin-top: 12px; } .mb-2 { margin-bottom: 8px; } .mb-3 { margin-bottom: 12px; }
        @media (max-width: 768px) { .grid[style*="repeat(2"] { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
