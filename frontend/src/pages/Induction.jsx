import React, { useState } from 'react'
import { Plus, Check, Clock, User, Briefcase, Shield, Award, FileText, LogIn } from 'lucide-react'

const STEPS = [
  { id: 1, label: 'Arrivée', icon: LogIn, color: 'var(--emerald-600)', done: true },
  { id: 2, label: 'Identité', icon: User, color: 'var(--emerald-600)', done: true },
  { id: 3, label: 'HSE', icon: Shield, color: 'var(--emerald-600)', done: true },
  { id: 4, label: 'Médecin', icon: FileText, color: 'var(--emerald-600)', done: true },
  { id: 5, label: 'Chambre', icon: Briefcase, color: 'var(--copper-500)', active: true },
  { id: 6, label: 'QR', icon: Award },
  { id: 7, label: 'IT', icon: User },
  { id: 8, label: 'Brief', icon: Shield },
]

export default function Induction() {
  const [activeStep, setActiveStep] = useState(5)
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Induction Nouveau Arrivant</h1>
          <p className="page-sub">Workflow automatisé · 8 étapes · taux complétion 96%</p>
        </div>
        <button className="btn btn-primary"><Plus size={14} /> Démarrer induction</button>
      </div>

      <div className="card card-pad mb-4">
        <div style={{   display: 'grid',   gridTemplateColumns: 'repeat(4,   gap: 20 }}>
          {[
            { label: 'Vol AT-447 · arrivé 21h30', val: 38, sub: 'personnes à processer' },
            { label: 'Inductions en cours', val: 12, sub: '8 à l\'étape finale', color: 'var(--emerald-600)' },
            { label: 'Complétées ce mois', val: 147, sub: '↑ 22 vs avril', color: 'var(--emerald-600)' },
            { label: 'Temps moyen', val: '2h14', sub: '↓ 18 min vs moy.', color: 'var(--emerald-600)' },
          ].map((k) => (
            <div key={k.label}>
              <div style={{   fontSize: 11,   color: 'var(--text-3)',   textTransform: 'uppercase',   letterSpacing: '0.06em',   fontWeight: 600 }}>{k.label}</div>
              <div style={{   fontSize: 32,   fontWeight: 700,   marginTop: 6,   color: k.color || 'var(--text)' }}>{k.val}</div>
              <div style={{   fontSize: 12,   color: k.color || 'var(--text-3)' }}>{k.sub}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card card-pad-lg">
        <h3 style={{   fontSize: 15,   fontWeight: 700,   marginBottom: 18 }}>Workflow en 8 étapes</h3>
        <div className="flex" style={{   alignItems: 'center',   justifyContent: 'space-between' }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div style={{   textAlign: 'center' }}>
                <div
                  onClick={() => setActiveStep(s.id)}
                  style={{   width: 44,   height: 44,   borderRadius: '50%',   background: s.done ? 'var(--emerald-600)' : s.active ? 'var(--copper-500)' : 'var(--bg-2)',   color: s.done || s.active ? 'white' : 'var(--text-3)',   border: s.active ? '2px solid var(--gold-500)' : 'none',   boxShadow: s.active ? '0 0 0 4px rgba(255,   .25)': 'none',   display: 'grid',   placeItems: 'center',   margin: '0 auto 8px',   fontWeight: 700,   cursor: 'pointer' }}>
                  {s.done ? <Check size={18} /> : s.id}
                </div>
                <div style={{   fontSize: 12,   fontWeight: 600 }}>{s.label}</div>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{   flex: 1,   height: 2,   background: s.done ? 'var(--emerald-500)' : 'var(--border-2)',   marginBottom: 24 }} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      <style>{`
        .flex { display: flex; } .gap-4 { gap: 16px; }
        .mb-4 { margin-bottom: 16px; }
        @media (max-width: 1024px) { .flex[style*="space-between"] { flex-wrap: wrap; gap: 16px; } }
      `}</style>
    </div>
  )
}
