import React, { useState } from 'react'
import { Plus, Filter, Wrench, AlertCircle, Clock, CheckCircle2 } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'

const COLS = [
  { id: 'nouveau', label: 'Nouveau', icon: Plus, color: 'info' },
  { id: 'en_cours', label: 'En cours', icon: Wrench, color: 'copper' },
  { id: 'verif', label: 'Vérification', icon: Clock, color: 'warn' },
  { id: 'resolu', label: 'Résolu · 7j', icon: CheckCircle2, color: 'emerald' },
]

const INITIAL = {
  nouveau: [
    { id: 'MNT-2849', title: 'Fuite plomberie B47', prio: 'P1', cat: 'Plomberie', ts: 'à l\'instant', by: 'AO' },
    { id: 'MNT-2850', title: 'Clim bloquée B88', prio: 'P2', cat: 'HVAC', ts: 'il y a 1h', by: 'PD' },
    { id: 'MNT-2851', title: 'Éclairage parking HS', prio: 'P3', cat: 'Électricité', ts: 'il y a 3h', by: 'IS' },
    { id: 'MNT-2852', title: 'Porte cassée réfectoire', prio: 'P3', cat: 'Serrurerie', ts: 'il y a 4h', by: 'FC' },
  ],
  en_cours: [
    { id: 'MNT-2847', title: 'Pompe P-203 vibrations', prio: 'P2', cat: 'Prédictif', ts: 'Tech en route', by: 'MK' },
    { id: 'MNT-2848', title: 'Fuite réseau eau froide', prio: 'P2', cat: 'Plomberie', ts: 'ETA 25 min', by: 'AB' },
  ],
  verif: [
    { id: 'MNT-2845', title: 'Générateur test hebdo', prio: 'P3', cat: 'Routine', ts: 'Planifié 06:00', by: 'AO' },
  ],
  resolu: [
    { id: 'MNT-2840', title: 'Chaudière réfectoire', prio: 'P2', cat: 'HVAC', ts: '2h14', by: 'PD', done: true },
    { id: 'MNT-2839', title: 'Clim salle serveurs', prio: 'P1', cat: 'HVAC', ts: '1h02', by: 'MK', done: true },
    { id: 'MNT-2838', title: '5 ampoules couloirs', prio: 'P3', cat: 'Électricité', ts: '35min', by: 'IS', done: true },
    { id: 'MNT-2837', title: 'Robinetterie dortoir C', prio: 'P2', cat: 'Plomberie', ts: '4h12', by: 'AB', done: true },
  ],
}

export default function Maintenance() {
  const [cols, setCols] = useState(INITIAL)
  const [dragged, setDragged] = useState(null)

  const moveCard = (toCol) => {
    if (!dragged) return
    setCols((c) => {
      const next = { ...c }
      let card = null
      for (const k of Object.keys(next)) {
        next[k] = next[k].filter((x) => {
          if (x.id === dragged.id) { card = x; return false }
          return true
        })
      }
      if (card) {
        card = { ...card, ts: toCol === 'resolu' ? 'à l\'instant' : card.ts, done: toCol === 'resolu' }
        next[toCol] = [card, ...next[toCol]]
      }
      return next
    })
    setDragged(null)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Maintenance Terrain</h1>
          <p className="page-sub">{cols.nouveau.length + cols.en_cours.length} incidents ouverts · MTTR moyen 4h12 · Conformité SLA 94%</p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-2" style={{   alignItems: 'center',   fontSize: 12,   color: 'var(--text-3)' }}>
            <div className="kpi-delta up">SLA 94%</div>
          </div>
          <button className="btn btn-ghost"><Filter size={14} /> Filtres</button>
          <button className="btn btn-primary">+ Nouvel incident</button>
        </div>
      </div>

      <div className="card card-pad mb-4">
        <div className="flex items-center gap-3">
          <span style={{   fontSize: 12,   color: 'var(--text-3)' }}>SLA global</span>
          <div style={{   flex: 1 }}>
            <ProgressBar value={94} color="emerald" showLabel />
          </div>
        </div>
      </div>

      <div className="kanban">
        {COLS.map((col) => (
          <div
            key={col.id}
            className="kcol"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => moveCard(col.id)}
          >
            <h4>
              <col.icon size={14} /> {col.label} <span className="count">{cols[col.id].length}</span>
            </h4>
            {cols[col.id].map((c) => (
              <div
                key={c.id}
                className="kcard"
                draggable
                onDragStart={() => setDragged(c)}
                style={{   opacity: c.done ? 0.7 : 1,   cursor: 'grab' }}
              >
                <div className="kcard-title">{c.title}</div>
                <div className="flex items-center gap-2" style={{   fontSize: 11,   color: 'var(--text-3)',   marginTop: 4 }}>
                  <span className={`badge badge-${c.prio === 'P1' ? 'alert' : c.prio === 'P2' ? 'warn' : 'ink'}`}>{c.prio}</span>
                  <span style={{   background: 'var(--bg-2)',   padding: '2px 8px',   borderRadius: 6 }}>{c.cat}</span>
                </div>
                <div className="kcard-meta" style={{   marginTop: 8 }}>
                  <span>{c.ts}</span>
                  <div className="avatar" style={{   width: 22,   height: 22,   fontSize: 9 }}>{c.by}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <style>{`
        .flex { display: flex; } .gap-2 { gap: 8px; } .items-center { align-items: center; }
        .mb-4 { margin-bottom: 16px; }
        .kanban { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .kcol { background: var(--bg-2); border-radius: 14px; padding: 12px; min-height: 400px; }
        .kcol h4 { font-size: 12px; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
        .kcol h4 .count { background: var(--surface); padding: 1px 8px; border-radius: 999px; font-size: 11px; }
        .kcard { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-bottom: 8px; box-shadow: var(--shadow-xs); transition: all .15s; }
        .kcard:hover { box-shadow: var(--shadow); transform: translateY(-1px); }
        .kcard-title { font-size: 13px; font-weight: 600; color: var(--text); }
        .kcard-meta { display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--text-3); }
        .avatar { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--copper-500), var(--emerald-600)); display: grid; place-items: center; color: white; font-weight: 700; font-size: 13px; }
        @media (max-width: 1024px) { .kanban { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 640px) { .kanban { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  )
}
