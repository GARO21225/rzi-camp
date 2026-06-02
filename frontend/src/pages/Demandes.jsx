import React, { useState } from 'react'
import { ListChecks, Plus, Clock, CheckCircle2, XCircle, MessageCircle } from 'lucide-react'
import BarChart from '../components/BarChart'

const DEMANDES = [
  { id: 'DEM-2026-188', type: 'Changement chambre', by: 'EMP-103', desc: 'Demande transfert B-001 vers B-088 pour rapprochement', date: '28 mai', status: 'pending' },
  { id: 'DEM-2026-187', type: 'Maintenance', by: 'EMP-042', desc: 'Fuite sous évier cuisine B-001', date: '27 mai', status: 'validated' },
  { id: 'DEM-2026-186', type: 'Permission', by: 'EMP-156', desc: 'Permission exceptionnelle 2 jours', date: '26 mai', status: 'rejected' },
  { id: 'DEM-2026-185', type: 'Réparation', by: 'EMP-201', desc: 'Climatisation chambre B-88-01 en panne', date: '25 mai', status: 'validated' },
  { id: 'DEM-2026-184', type: 'Acompte', by: 'EMP-089', desc: "Demande d'avance sur salaire", date: '24 mai', status: 'pending' },
  { id: 'DEM-2026-183', type: 'Changement chambre', by: 'EMP-203', desc: 'Échange chambre B-152-08 ↔ B-152-12', date: '23 mai', status: 'validated' },
]

const STATUS_MAP = { pending: { label: 'En attente', color: 'warn' }, validated: { label: 'Validée', color: 'ok' }, rejected: { label: 'Rejetée', color: 'alert' } }
const TYPE_COLOR = { 'Changement chambre': 'info', Maintenance: 'copper', Réparation: 'copper', Permission: 'ink', Acompte: 'warn' }

export default function Demandes() {
  const counts = {
    pending: DEMANDES.filter((d) => d.status === 'pending').length,
    validated: DEMANDES.filter((d) => d.status === 'validated').length,
    rejected: DEMANDES.filter((d) => d.status === 'rejected').length,
  }
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Demandes</h1>
          <p className="page-sub">{DEMANDES.length} demandes · {counts.pending} en attente · temps moyen traitement 18h</p>
        </div>
        <button className="btn btn-primary"><Plus size={14} /> Nouvelle demande</button>
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {[
          { label: 'En attente', val: counts.pending, color: 'warn', icon: <Clock size={14} /> },
          { label: 'Validées', val: counts.validated, color: 'emerald', icon: <CheckCircle2 size={14} /> },
          { label: 'Rejetées', val: counts.rejected, color: 'alert', icon: <XCircle size={14} /> },
        ].map((k) => (
          <div key={k.label} className="card kpi hover-lift">
            <div className="flex items-center justify-between">
              <div className="kpi-label">{k.label}</div>
              <div style={{ color: 'var(--text-3)' }}>{k.icon}</div>
            </div>
            <div className="kpi-value">{k.val}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Demandé par</th>
              <th>Description</th>
              <th>Date</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {DEMANDES.map((d) => (
              <tr key={d.id}>
                <td className="text-mono" style={{ fontSize: 12 }}>{d.id}</td>
                <td><span className={`badge badge-${TYPE_COLOR[d.type] || 'ink'}`}>{d.type}</span></td>
                <td><strong style={{ fontSize: 12 }}>{d.by}</strong></td>
                <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{d.desc}</td>
                <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{d.date}</td>
                <td><span className={`badge badge-${STATUS_MAP[d.status].color}`}>{STATUS_MAP[d.status].label}</span></td>
                <td>
                  <div className="flex gap-2">
                    {d.status === 'pending' && (
                      <>
                        <button className="btn btn-sm btn-ok">✓</button>
                        <button className="btn btn-sm btn-danger">✕</button>
                      </>
                    )}
                    <button className="btn btn-sm btn-ghost"><MessageCircle size={12} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .grid { display: grid; } .gap-2 { gap: 8px; } .gap-4 { gap: 16px; } .mb-4 { margin-bottom: 16px; }
        .flex { display: flex; } .items-center { align-items: center; } .justify-between { justify-content: space-between; }
        .text-mono { font-family: var(--font-mono); }
      `}</style>
    </div>
  )
}
