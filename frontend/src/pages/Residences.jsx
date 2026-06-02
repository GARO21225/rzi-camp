import React, { useEffect, useState } from 'react'
import { Plus, Filter, Download, Search } from 'lucide-react'
import ProgressBar from '../components/ProgressBar'
import { generateBuildings } from '../utils/buildings'

export default function Residences() {
  const [list, setList] = useState([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  useEffect(() => { setList(generateBuildings()) }, [])

  const filtered = list.filter((b) => {
    if (filter !== 'all' && b.status !== filter) return false
    if (search && !`${b.id} ${b.section} ${b.type}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Résidences</h1>
          <p className="page-sub">{list.length} bâtiments · {list.filter((b) => b.status === 'ok').length} occupés · {list.filter((b) => b.status === 'empty').length} inoccupés</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-ghost"><Download size={14} /> Export CSV</button>
          <button className="btn btn-primary"><Plus size={14} /> Assigner chambre</button>
        </div>
      </div>

      <div className="card card-pad mb-4">
        <div className="flex gap-3 items-center" style={{   flexWrap: 'wrap' }}>
          <div style={{   position: 'relative',   flex: 1,   minWidth: 240 }}>
            <Search size={16} style={{   position: 'absolute',   left: 12,   top: '50%',   transform: 'translateY(-50%)',   color: 'var(--text-3)' }} />
            <input
              className="input"
              style={{   paddingLeft: 36 }}
              placeholder="Rechercher par ID, section, type…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="tabs">
            {[
              { id: 'all', label: 'Tous' },
              { id: 'ok', label: 'Occupés' },
              { id: 'warn', label: 'Maintenance' },
              { id: 'alert', label: 'Alertes' },
              { id: 'empty', label: 'Inoccupés' },
            ].map((t) => (
              <button key={t.id} className={filter === t.id ? 'active' : ''} onClick={() => setFilter(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{   overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Section</th>
              <th style={{   minWidth: 200 }}>Occupation</th>
              <th>Conso</th>
              <th>Responsable</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map((b) => (
              <tr key={b.id}>
                <td className="text-mono" style={{   fontSize: 12 }}>{b.id}</td>
                <td><strong>{b.type}</strong></td>
                <td>Section {b.section}</td>
                <td>
                  <div style={{   display: 'flex',   alignItems: 'center',   gap: 8 }}>
                    <div style={{   flex: 1 }}>
                      <ProgressBar value={b.occupants} max={b.chambres} color={b.status === 'alert' ? 'alert' : 'copper'} size="sm" />
                    </div>
                    <span style={{   fontSize: 11,   color: 'var(--text-3)',   fontFamily: 'var(--font-mono)',   minWidth: 50 }}>
                      {b.occupants}/{b.chambres}
                    </span>
                  </div>
                </td>
                <td style={{   fontFamily: 'var(--font-mono)' }}>{b.consommation_kwh.toFixed(0)} kWh</td>
                <td style={{   fontSize: 12 }}>{b.responsable}</td>
                <td>
                  <span className={`badge badge-${b.status === 'ok' ? 'ok' : b.status === 'warn' ? 'warn' : b.status === 'alert' ? 'alert' : 'ink'}`}>
                    {b.status === 'ok' ? 'Occupé' : b.status === 'warn' ? 'Maintenance' : b.status === 'alert' ? 'Alerte' : 'Inoccupé'}
                  </span>
                </td>
                <td>
                  <button className="btn btn-sm btn-ghost">Détails</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .flex { display: flex; } .gap-2 { gap: 8px; } .gap-3 { gap: 12px; }
        .items-center { align-items: center; } .mb-4 { margin-bottom: 16px; }
        .text-mono { font-family: var(--font-mono); }
      `}</style>
    </div>
  )
}
