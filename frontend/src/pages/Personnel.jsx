import React, { useState } from 'react'
import { Users, Download, Plus, UserCheck, Globe, Briefcase } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'

const DATA = [
  { id: 'EMP-001', name: 'Aminata Ouédraogo', role: 'Manager', company: 'ROXGOLD', room: 'B103-04', status: 'on', since: '15 mars 2026', avatar: 'AO' },
  { id: 'EMP-042', name: 'Moussa Koné', role: 'Technicien', company: 'ROXGOLD', room: 'B088-12', status: 'on', since: '02 mai 2026', avatar: 'MK' },
  { id: 'EMP-089', name: 'Pascale Diallo', role: 'Restauration', company: 'SODEXO', room: 'B001-08', status: 'on', since: '20 avr. 2026', avatar: 'PD' },
  { id: 'EMP-103', name: 'Ibrahim Sawadogo', role: 'Ménage', company: 'NETCARE', room: 'B001-15', status: 'rot', since: '12 mai 2026', avatar: 'IS' },
  { id: 'EMP-156', name: 'Fatoumata Compaoré', role: 'Manager', company: 'ROXGOLD', room: 'B103-02', status: 'on', since: '08 fév. 2026', avatar: 'FC' },
  { id: 'EMP-201', name: 'Jean Dupont', role: 'Expatrié', company: 'ROXGOLD', room: 'B88-01', status: 'on', since: '01 juin 2026', avatar: 'JD' },
]

const ROLE_COLOR = {
  Manager: 'copper', Technicien: 'info', Restauration: 'purple', Ménage: 'ink', Expatrié: 'gold',
}

export default function Personnel() {
  const [list] = useState(DATA)
  const total = list.length
  const onSite = list.filter((p) => p.status === 'on').length
  const inRotation = list.filter((p) => p.status === 'rot').length
  const expat = list.filter((p) => p.role === 'Expatrié').length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Personnel</h1>
          <p className="page-sub">{onSite} sur site · {inRotation} en rotation · {expat} expatriés</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost"><Download size={14} /> Export RH</button>
          <button className="btn btn-primary"><Plus size={14} /> Nouveau</button>
        </div>
      </div>

      <div className="grid gap-4 mb-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: 'Sur site', value: onSite, total, color: 'emerald', icon: <UserCheck size={14} /> },
          { label: 'En rotation', value: inRotation, total, color: 'warn', icon: <Globe size={14} /> },
          { label: 'Expatriés', value: expat, total, color: 'gold', icon: <Briefcase size={14} /> },
          { label: 'Total', value: total, total: total, color: 'copper', icon: <Users size={14} /> },
        ].map((k) => (
          <div key={k.label} className="card kpi hover-lift">
            <div className="flex items-center justify-between">
              <div className="kpi-label">{k.label}</div>
              <div style={{ color: 'var(--text-3)' }}>{k.icon}</div>
            </div>
            <div className="kpi-value">{k.value}</div>
            <div className="mt-2">
              <ProgressBar value={k.value} max={k.total} color={k.color} size="sm" />
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Employé</th>
              <th>Matricule</th>
              <th>Rôle</th>
              <th>Société</th>
              <th>Chambre</th>
              <th>Statut</th>
              <th>Arrivée</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="avatar" style={{ width: 32, height: 32, fontSize: 11 }}>{p.avatar}</div>
                    <div>
                      <strong style={{ fontSize: 13 }}>{p.name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{p.role}</div>
                    </div>
                  </div>
                </td>
                <td className="text-mono" style={{ fontSize: 12 }}>{p.id}</td>
                <td>
                  <span className={`badge badge-${ROLE_COLOR[p.role] === 'copper' ? 'copper' : ROLE_COLOR[p.role] === 'gold' ? 'copper' : ROLE_COLOR[p.role] === 'info' ? 'info' : ROLE_COLOR[p.role] === 'purple' ? 'info' : 'ink'}`}>
                    {p.role}
                  </span>
                </td>
                <td>{p.company}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{p.room}</td>
                <td>
                  <span className={`badge badge-${p.status === 'on' ? 'ok' : 'warn'}`}>
                    {p.status === 'on' ? 'Sur site' : 'En rotation'}
                  </span>
                </td>
                <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{p.since}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .grid { display: grid; } .gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; } .mb-4 { margin-bottom: 16px; } .mt-2 { margin-top: 8px; }
        .flex { display: flex; } .items-center { align-items: center; } .justify-between { justify-content: space-between; }
        .avatar { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--copper-500), var(--emerald-600)); display: grid; place-items: center; color: white; font-weight: 700; font-size: 13px; }
        .text-mono { font-family: var(--font-mono); }
      `}</style>
    </div>
  )
}
