import React from 'react'
import { Workflow, Plus, Calendar, Users, ArrowRight } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'

const ROTATIONS = [
  { id: 'R-2026-188', name: 'Crew A · Expatriés', date: '15 juin', expected: 18, confirmed: 14, status: 'confirmed' },
  { id: 'R-2026-189', name: 'Crew B · Maintenance', date: '18 juin', expected: 24, confirmed: 24, status: 'confirmed' },
  { id: 'R-2026-190', name: 'Crew C · Restauration', date: '20 juin', expected: 12, confirmed: 9, status: 'pending' },
  { id: 'R-2026-191', name: 'Crew D · Sécurité', date: '22 juin', expected: 8, confirmed: 8, status: 'confirmed' },
  { id: 'R-2026-192', name: 'Crew E · Médical', date: '25 juin', expected: 6, confirmed: 3, status: 'pending' },
]

const STATUS_MAP = { confirmed: { label: 'Confirmée', color: 'ok' }, pending: { label: 'En attente', color: 'warn' } }

export default function Rotations() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Rotations Personnel</h1>
          <p className="page-sub">5 rotations ouvertes · 68 personnes attendues · 58 confirmées</p>
        </div>
        <button className="btn btn-primary"><Plus size={14} /> Nouvelle rotation</button>
      </div>

      <div className="card" style={{   overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>Rotation</th>
              <th>Date</th>
              <th style={{   minWidth: 220 }}>Confirmations</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ROTATIONS.map((r) => (
              <tr key={r.id}>
                <td className="text-mono" style={{   fontSize: 12 }}>{r.id}</td>
                <td><strong>{r.name}</strong></td>
                <td>{r.date}</td>
                <td>
                  <div style={{   display: 'flex',   alignItems: 'center',   gap: 8 }}>
                    <div style={{   flex: 1 }}>
                      <ProgressBar value={r.confirmed} max={r.expected} color={r.status === 'confirmed' ? 'emerald' : 'warn'} size="sm" />
                    </div>
                    <span style={{   fontSize: 11,   color: 'var(--text-3)',   fontFamily: 'var(--font-mono)',   minWidth: 50 }}>
                      {r.confirmed}/{r.expected}
                    </span>
                  </div>
                </td>
                <td>
                  <span className={`badge badge-${STATUS_MAP[r.status].color}`}>{STATUS_MAP[r.status].label}</span>
                </td>
                <td>
                  <button className="btn btn-sm btn-ghost">Détails <ArrowRight size={12} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .flex { display: flex; } .gap-2 { gap: 8px; } .items-center { align-items: center; }
        .text-mono { font-family: var(--font-mono); }
      `}</style>
    </div>
  )
}
