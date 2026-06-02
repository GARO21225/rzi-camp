import React, { useState } from 'react'
import { History, Filter, Download } from 'lucide-react'
import BarChart from '../components/BarChart'

const ENTRIES = [
  { ts: '01 juin 2026 · 22:14', user: 'A. Ouédraogo', action: 'a modifié', target: 'B-088 → maintenance' },
  { ts: '01 juin 2026 · 22:08', user: 'M. Koné', action: 'a créé', target: 'incident #MNT-2847' },
  { ts: '01 juin 2026 · 21:55', user: 'P. Diallo', action: 'a scanné', target: 'QR repas EMP-2241' },
  { ts: '01 juin 2026 · 21:42', user: 'admin', action: 's\'est connecté', target: 'session admin' },
  { ts: '01 juin 2026 · 21:30', user: 'F. Compaoré', action: 'a assigné', target: 'rôle technicien à EMP-892' },
  { ts: '01 juin 2026 · 21:15', user: 'I. Sawadogo', action: 'a nettoyé', target: 'chambre B-001-15' },
  { ts: '01 juin 2026 · 20:58', user: 'système', action: 'a alerté', target: 'panne P-203 (87%)' },
  { ts: '01 juin 2026 · 20:30', user: 'A. Ouédraogo', action: 'a validé', target: 'demande DEM-2026-185' },
  { ts: '01 juin 2026 · 20:12', user: 'H. Müller', action: 'a uploadé', target: 'photo B-88-01' },
  { ts: '01 juin 2026 · 19:45', user: 'A. Volkov', action: 'a exporté', target: 'rapport géologie Q1' },
  { ts: '01 juin 2026 · 19:00', user: 'système', action: 'a généré', target: 'QR 38 repas' },
  { ts: '01 juin 2026 · 18:30', user: 'J. Dupont', action: 's\'est connecté', target: 'session expatrié' },
]

const ACTION_COLOR = { 'a modifié': 'info', 'a créé': 'ok', 'a scanné': 'copper', 's\'est connecté': 'purple', 'a assigné': 'info', 'a nettoyé': 'ink', 'a alerté': 'alert', 'a validé': 'ok', 'a uploadé': 'gold', 'a exporté': 'ink', 'a généré': 'copper' }

export default function Historique() {
  const [search, setSearch] = useState('')
  const filtered = ENTRIES.filter((e) => `${e.user} ${e.action} ${e.target}`.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Historique</h1>
          <p className="page-sub">{ENTRIES.length} événements aujourd'hui · 1 247 ce mois</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost"><Filter size={14} /> Filtres</button>
          <button className="btn btn-primary"><Download size={14} /> Exporter</button>
        </div>
      </div>

      <div className="card card-pad mb-4">
        <input
          className="input"
          placeholder="Filtrer par utilisateur, action, cible…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card" style={{   overflow: 'hidden' }}>
        <div style={{   padding: 20 }}>
          {filtered.map((e, i) => (
            <div key={i} style={{   display: 'flex',   alignItems: 'center',   gap: 12,   padding: '10px 0',   borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div className="avatar" style={{   width: 36,   height: 36,   fontSize: 12 }}>{e.user.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
              <div style={{   flex: 1,   minWidth: 0 }}>
                <div style={{   fontSize: 13 }}>
                  <strong>{e.user}</strong> <span style={{   color: 'var(--text-3)' }}>{e.action}</span> <span style={{   color: 'var(--copper-600)' }}>{e.target}</span>
                </div>
                <div style={{   fontSize: 11,   color: 'var(--text-3)',   marginTop: 2,   fontFamily: 'var(--font-mono)' }}>{e.ts}</div>
              </div>
              <span className={`badge badge-${ACTION_COLOR[e.action] || 'ink'}`}>{e.action}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .flex { display: flex; } .gap-2 { gap: 8px; } .mb-4 { margin-bottom: 16px; }
        .avatar { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--copper-500), var(--emerald-600)); display: grid; place-items: center; color: white; font-weight: 700; font-size: 13px; flex-shrink: 0; }
      `}</style>
    </div>
  )
}
