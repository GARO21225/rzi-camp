import React, { useState } from 'react'
import { ShieldCheck, Download, FileText } from 'lucide-react'

const AUDIT = [
  { ts: '2026-06-01 22:14:38', user: 'aminata.ouedraogo', action: 'UPDATE', target: 'batiment.statut', detail: 'B-088 → maintenance', ip: '10.42.1.18', hash: 'a3f2…c81d' },
  { ts: '2026-06-01 22:11:02', user: 'moussa.kone', action: 'CREATE', target: 'incident', detail: '#MNT-2847 · pompe P-203', ip: '10.42.1.47', hash: 'b4e7…2a91' },
  { ts: '2026-06-01 22:08:51', user: 'system', action: 'DETECT', target: 'fraud.qr.dup', detail: '3 scans B-12 · 5min', ip: '—', hash: 'c8d2…7e44' },
  { ts: '2026-06-01 21:55:14', user: 'pascal.diallo', action: 'SCAN', target: 'qr.repas', detail: 'EMP-2241 · déjeuner', ip: '10.42.1.62', hash: 'd9f1…3b22' },
  { ts: '2026-06-01 21:42:00', user: 'admin', action: 'LOGIN', target: 'session', detail: '2FA ok · desktop', ip: '10.42.1.2', hash: 'e0a4…8c33' },
  { ts: '2026-06-01 21:30:11', user: 'fatoumata.compaoré', action: 'ASSIGN', target: 'personnel.role', detail: 'EMP-892 → technicien', ip: '10.42.1.33', hash: 'f1b5…9d44' },
  { ts: '2026-06-01 21:15:22', user: 'ibrahim.sawadogo', action: 'UPDATE', target: 'chambre.statut', detail: 'B-001-15 · ménage', ip: '10.42.1.51', hash: 'a2c6…1e55' },
  { ts: '2026-06-01 20:58:00', user: 'system', action: 'ALERT', target: 'panne.predict', detail: 'Pompe P-203 · 87%', ip: '—', hash: 'b3d7…2f66' },
]

const ACT_COLOR = { UPDATE: 'info', CREATE: 'ok', DELETE: 'alert', SCAN: 'copper', LOGIN: 'purple', DETECT: 'warn', ASSIGN: 'info', ALERT: 'alert' }

export default function Audit() {
  const [filter, setFilter] = useState('all')
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Audit Trail</h1>
          <p className="page-sub">8 247 événements ce mois · conformité ISO 27001 · chaînage de hashes</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost"><FileText size={14} /> Rapport</button>
          <button className="btn btn-primary"><Download size={14} /> Exporter registre</button>
        </div>
      </div>

      <div className="card card-pad mb-4">
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          <div className="tabs">
            {['all', 'UPDATE', 'CREATE', 'DELETE', 'LOGIN', 'DETECT', 'ALERT'].map((t) => (
              <button key={t} className={filter === t ? 'active' : ''} onClick={() => setFilter(t)}>
                {t === 'all' ? 'Tous' : t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr><th>Horodatage</th><th>Utilisateur</th><th>Action</th><th>Cible</th><th>Détail</th><th>IP</th><th>Hash</th></tr>
          </thead>
          <tbody>
            {AUDIT.filter((a) => filter === 'all' || a.action === filter).map((a, i) => (
              <tr key={i}>
                <td className="text-mono" style={{ fontSize: 12 }}>{a.ts}</td>
                <td><strong style={{ fontSize: 12 }}>{a.user}</strong></td>
                <td><span className={`badge badge-${ACT_COLOR[a.action]}`}>{a.action}</span></td>
                <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{a.target}</td>
                <td style={{ fontSize: 12 }}>{a.detail}</td>
                <td className="text-mono" style={{ fontSize: 11 }}>{a.ip}</td>
                <td className="text-mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>{a.hash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .flex { display: flex; } .gap-2 { gap: 8px; } .mb-4 { margin-bottom: 16px; }
        .text-mono { font-family: var(--font-mono); }
      `}</style>
    </div>
  )
}
