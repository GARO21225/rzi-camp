import React, { useState } from 'react'
import { Users, Search, Phone, Mail, Building } from 'lucide-react'

const PEOPLE = [
  { name: 'Aminata Ouédraogo', role: 'Manager Camp', dept: 'Direction', phone: '+226 70 12 34 56', email: 'a.ouedraogo@roxgold.com', location: 'B103' },
  { name: 'Moussa Koné', role: 'Tech. Maintenance', dept: 'Maintenance', phone: '+226 70 23 45 67', email: 'm.kone@roxgold.com', location: 'B088' },
  { name: 'Pascale Diallo', role: 'Resp. Restauration', dept: 'Restauration', phone: '+226 70 34 56 78', email: 'p.diallo@soxedho.com', location: 'B001' },
  { name: 'Ibrahim Sawadogo', role: 'Chef d\'équipe Ménage', dept: 'Ménage', phone: '+226 70 45 67 89', email: 'i.sawadogo@netcare.com', location: 'B001' },
  { name: 'Fatoumata Compaoré', role: 'Manager RH', dept: 'RH', phone: '+226 70 56 78 90', email: 'f.compaore@roxgold.com', location: 'B103' },
  { name: 'Jean Dupont', role: 'Lead Expatrié', dept: 'Expatriés', phone: '+33 6 12 34 56 78', email: 'j.dupont@roxgold.com', location: 'B88' },
  { name: 'Hans Müller', role: 'Tech. Senior', dept: 'Maintenance', phone: '+49 176 12345678', email: 'h.muller@roxgold.com', location: 'B88' },
  { name: 'Anna Volkov', role: 'Géologue', dept: 'Géologie', phone: '+7 916 123 4567', email: 'a.volkov@roxgold.com', location: 'B103' },
]

const DEPT_COLORS = { Direction: 'copper', Maintenance: 'info', Restauration: 'copper', Ménage: 'ink', RH: 'purple', Expatriés: 'gold', Géologie: 'emerald' }

export default function Annuaire() {
  const [search, setSearch] = useState('')
  const filtered = PEOPLE.filter((p) => `${p.name} ${p.role} ${p.dept}`.toLowerCase().includes(search.toLowerCase()))
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Annuaire</h1>
          <p className="page-sub">{PEOPLE.length} contacts · 7 départements · multi-pays</p>
        </div>
      </div>

      <div className="card card-pad mb-4">
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            placeholder="Rechercher par nom, rôle, département…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
        {filtered.map((p) => (
          <div key={p.email} className="card card-pad flex items-center gap-3 hover-lift">
            <div className="avatar">{p.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{p.role}</div>
              <div className="flex gap-3 mt-2" style={{ fontSize: 11, color: 'var(--text-3)' }}>
                <span className="flex items-center gap-1"><Phone size={11} /> {p.phone}</span>
                <span className="flex items-center gap-1"><Mail size={11} /> {p.email}</span>
                <span className="flex items-center gap-1"><Building size={11} /> {p.location}</span>
              </div>
            </div>
            <span className={`badge badge-${DEPT_COLORS[p.dept]}`}>{p.dept}</span>
          </div>
        ))}
      </div>

      <style>{`
        .grid { display: grid; } .gap-1 { gap: 4px; } .gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; } .mb-4 { margin-bottom: 16px; } .mt-2 { margin-top: 8px; }
        .flex { display: flex; } .items-center { align-items: center; }
        .avatar { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, var(--copper-500), var(--emerald-600)); display: grid; place-items: center; color: white; font-weight: 700; font-size: 14px; flex-shrink: 0; }
        @media (max-width: 768px) { .grid[style*="repeat(2"] { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  )
}
