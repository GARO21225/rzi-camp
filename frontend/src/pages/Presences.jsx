import React, { useState } from 'react'
import { Clock, UserCheck, UserX, Coffee, Plane, TrendingUp } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'
import BarChart from '../components/BarChart'

export default function Presences() {
  const [now] = useState(new Date())
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Présences</h1>
          <p className="page-sub">Pointage temps réel · 847 personnes attendues · {now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Présents', val: 798, total: 847, color: 'emerald', icon: <UserCheck size={14} /> },
          { label: 'Absents', val: 32, total: 847, color: 'alert', icon: <UserX size={14} /> },
          { label: 'En pause', val: 47, total: 847, color: 'warn', icon: <Coffee size={14} /> },
          { label: 'En voyage', val: 17, total: 847, color: 'info', icon: <Plane size={14} /> },
        ].map((k) => (
          <div key={k.label} className="card kpi hover-lift">
            <div className="flex items-center justify-between">
              <div className="kpi-label">{k.label}</div>
              <div style={{ color: 'var(--text-3)' }}>{k.icon}</div>
            </div>
            <div className="kpi-value">{k.val}<span style={{ fontSize: 14, color: 'var(--text-3)', fontWeight: 500 }}> / {k.total}</span></div>
            <div className="mt-2">
              <ProgressBar value={(k.val / k.total) * 100} color={k.color} size="sm" showLabel />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <div className="card card-pad-lg">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Heures de pointage · aujourd'hui</h3>
          <BarChart
            data={[
              { label: '05h', value: 12 },
              { label: '06h', value: 84 },
              { label: '07h', value: 412 },
              { label: '08h', value: 198 },
              { label: '12h', value: 47 },
              { label: '13h', value: 38 },
              { label: '17h', value: 215 },
              { label: '18h', value: 142 },
              { label: '19h', value: 32 },
            ]}
            color="var(--copper-500)"
            unit=" pointages"
          />
        </div>

        <div className="card card-pad-lg">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Anomalies du jour</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { t: 'Retard B-012', d: 'A. Sawadogo · 47 min', c: 'warn' },
              { t: 'Oubli pointage', d: 'F. Compaoré · sortie', c: 'warn' },
              { t: 'Départ anticipé', d: 'I. Sawadogo · 16h30', c: 'alert' },
              { t: 'Heures sup', d: 'M. Koné · +2h30', c: 'info' },
            ].map((a, i) => (
              <div key={i} style={{ padding: 10, background: 'var(--bg-2)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 6, height: 32, borderRadius: 3, background: `var(--status-${a.c})` }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{a.t}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .grid { display: grid; } .gap-2 { gap: 8px; } .gap-4 { gap: 16px; }
        .flex { display: flex; } .items-center { align-items: center; } .justify-between { justify-content: space-between; }
        .mb-4 { margin-bottom: 16px; } .mt-2 { margin-top: 8px; }
        @media (max-width: 900px) { .grid[style*="1fr 1fr"], .grid[style*="repeat(4"] { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
