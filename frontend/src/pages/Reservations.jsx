import React, { useState } from 'react'
import { BookOpen, Plus, Calendar, MapPin, User } from 'lucide-react'
import BarChart from '../components/BarChart'

const ROOMS = ['Salle réunion A', 'Salle réunion B', 'Salle polyvalente', 'Salle formation', 'Centre conférence', 'Salle direction']
const TIMES = ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']

const RESA = [
  { id: 1, room: 'Salle réunion A', date: '2026-06-02', time: '09:00-10:00', by: 'A. Ouédraogo', motif: 'Brief managers' },
  { id: 2, room: 'Salle polyvalente', date: '2026-06-03', time: '14:00-16:00', by: 'HSE Team', motif: 'Briefing sécurité' },
  { id: 3, room: 'Salle formation', date: '2026-06-04', time: '09:00-12:00', by: 'IT', motif: 'Formation nouveaux outils' },
]

export default function Reservations() {
  const [room, setRoom] = useState(ROOMS[0])
  const [date, setDate] = useState('2026-06-01')
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Réservations de salles</h1>
          <p className="page-sub">6 salles · 3 réservations aujourd'hui · taux occupation 62%</p>
        </div>
        <button className="btn btn-primary"><Plus size={14} /> Nouvelle réservation</button>
      </div>

      <div className="grid gap-4" style={{   gridTemplateColumns: '1fr 2fr' }}>
        <div className="card card-pad-lg">
          <h3 style={{   fontSize: 14,   fontWeight: 700,   marginBottom: 12,   color: 'var(--text-3)',   textTransform: 'uppercase',   letterSpacing: '0.08em',   fontSize: 11 }}>
            Paramètres
          </h3>
          <div style={{   display: 'flex',   flexDirection: 'column',   gap: 14 }}>
            <div>
              <label style={{   fontSize: 11,   fontWeight: 700,   color: 'var(--text-3)',   textTransform: 'uppercase',   letterSpacing: '0.06em',   display: 'block',   marginBottom: 6 }}>Salle</label>
              <select className="input" value={room} onChange={(e) => setRoom(e.target.value)}>
                {ROOMS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label style={{   fontSize: 11,   fontWeight: 700,   color: 'var(--text-3)',   textTransform: 'uppercase',   letterSpacing: '0.06em',   display: 'block',   marginBottom: 6 }}>Date</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <button className="btn btn-primary mt-2"><Plus size={14} /> Réserver</button>
          </div>
        </div>

        <div className="card card-pad-lg">
          <h3 style={{   fontSize: 14,   fontWeight: 700,   marginBottom: 12 }}>Disponibilité · {date}</h3>
          <div style={{   display: 'grid',   gridTemplateColumns: 'repeat(8,   gap: 6 }}>
            {TIMES.map((t) => {
              const reserved = RESA.some((r) => r.time.startsWith(t.slice(0, 5)))
              return (
                <button
                  key={t}
                  className="btn btn-sm"
                  style={{
                    background: reserved ? 'rgba(220,38,38,.1)' : 'var(--emerald-50)',
                    color: reserved ? 'var(--status-alert)' : 'var(--emerald-700)',
                    border: `1px solid ${reserved ? 'rgba(220,38,38,.2)' : 'var(--emerald-100)'}`,
                    cursor: reserved ? 'not-allowed' : 'pointer',
                    height: 50,
                  }}
                  disabled={reserved}
                >
                  <div style={{   fontSize: 11,   fontWeight: 700 }}>{t}</div>
                  <div style={{   fontSize: 9,   marginTop: 2 }}>{reserved ? 'Réservé' : 'Libre'}</div>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="card mt-4" style={{   overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr><th>Salle</th><th>Date</th><th>Horaire</th><th>Demandé par</th><th>Motif</th><th></th></tr>
          </thead>
          <tbody>
            {RESA.map((r) => (
              <tr key={r.id}>
                <td><strong>{r.room}</strong></td>
                <td>{r.date}</td>
                <td style={{   fontFamily: 'var(--font-mono)' }}>{r.time}</td>
                <td>{r.by}</td>
                <td>{r.motif}</td>
                <td><button className="btn btn-sm btn-ghost">Annuler</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style>{`
        .grid { display: grid; } .gap-2 { gap: 8px; } .gap-4 { gap: 16px; } .mt-2 { margin-top: 8px; } .mt-4 { margin-top: 16px; }
        @media (max-width: 1024px) { .grid[style*="1fr 2fr"] { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
