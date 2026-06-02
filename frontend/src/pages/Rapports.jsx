import React, { useState } from 'react'
import { FileText, Download, Calendar, Filter } from 'lucide-react'
import BarChart from '../components/BarChart'

const RAPPORTS = [
  { id: 'RPT-2026-188', name: 'Rapport mensuel Mai', type: 'Mensuel', pages: 24, date: '01 juin 2026', author: 'A. Ouédraogo' },
  { id: 'RPT-2026-187', name: 'Bilan HSE Q2', type: 'Trimestriel', pages: 48, date: '15 mai 2026', author: 'HSE Team' },
  { id: 'RPT-2026-186', name: 'Audit conformité ISO', type: 'Annuel', pages: 86, date: '10 mai 2026', author: 'Auditeur externe' },
  { id: 'RPT-2026-185', name: 'Rapport maintenance Avril', type: 'Mensuel', pages: 18, date: '01 mai 2026', author: 'M. Koné' },
  { id: 'RPT-2026-184', name: 'Bilan rotations Q1', type: 'Trimestriel', pages: 32, date: '05 avril 2026', author: 'RH' },
  { id: 'RPT-2026-183', name: 'Rapport financier Mars', type: 'Mensuel', pages: 28, date: '01 avril 2026', author: 'Finance' },
]

const TYPE_COLOR = { Mensuel: 'info', Trimestriel: 'copper', Annuel: 'gold' }

export default function Rapports() {
  const [type, setType] = useState('all')
  const filtered = RAPPORTS.filter((r) => type === 'all' || r.type === type)
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Rapports</h1>
          <p className="page-sub">{RAPPORTS.length} rapports générés · 236 pages totales · export PDF/Excel</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost"><Filter size={14} /> Filtres</button>
          <button className="btn btn-primary">+ Générer</button>
        </div>
      </div>

      <div className="card card-pad mb-4">
        <div className="flex gap-3 items-center" style={{ flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Type :</span>
          <div className="tabs">
            {['all', 'Mensuel', 'Trimestriel', 'Annuel'].map((t) => (
              <button key={t} className={type === t ? 'active' : ''} onClick={() => setType(t)}>
                {t === 'all' ? 'Tous' : t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {filtered.map((r) => (
          <div key={r.id} className="card card-pad-lg hover-lift">
            <div className="flex items-center gap-3 mb-3">
              <div style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--copper-100)', color: 'var(--copper-700)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <FileText size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>{r.id}</div>
              </div>
              <span className={`badge badge-${TYPE_COLOR[r.type] || 'ink'}`}>{r.type}</span>
            </div>
            <div className="flex items-center gap-3 mb-3" style={{ fontSize: 12, color: 'var(--text-3)' }}>
              <span>📄 {r.pages} pages</span>
              <span>📅 {r.date}</span>
              <span>👤 {r.author}</span>
            </div>
            <button className="btn btn-soft" style={{ width: '100%' }}>
              <Download size={14} /> Télécharger
            </button>
          </div>
        ))}
      </div>

      <style>{`
        .grid { display: grid; } .gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; } .mb-3 { margin-bottom: 12px; } .mb-4 { margin-bottom: 16px; }
        .flex { display: flex; } .items-center { align-items: center; }
        @media (max-width: 768px) { .grid[style*="repeat(2"] { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
