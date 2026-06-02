import React from 'react'
import { Calendar, Plus, MapPin, Users } from 'lucide-react'

const EVENTS = [
  { id: 1, type: 'securite', required: true, title: 'Briefing sécurité mensuel', desc: 'Rappel HSE + point sur incidents du mois. Présence requise pour tout le personnel terrain.', date: 'Mercredi 3 juin · 14:00', place: 'Salle polyvalente', participants: 824, color: 'alert' },
  { id: 2, type: 'social', required: false, title: 'Tournoi de foot inter-services', desc: 'Finale矿区 vs maintenance · ambiance garantie, barbecue à la mi-temps.', date: 'Samedi 6 juin · 17:00', place: 'Terrain de sport', participants: 0, color: 'info' },
  { id: 3, type: 'formation', required: false, title: 'Formation premiers secours', desc: 'Recyclage PSC1 · 12 places · inscription obligatoire auprès de la HSE.', date: 'Lundi 8 juin · 09:00', place: 'Centre formation', participants: 12, color: 'copper' },
  { id: 4, type: 'reunion', required: false, title: "Réunion managers mensuelle", desc: 'KPIs du mois, planning rotations, budgets Q3.', date: 'Vendredi 12 juin · 10:00', place: 'Salle direction', participants: 18, color: 'ink' },
]

const TYPE_LABEL = { securite: 'Sécurité', social: 'Social', formation: 'Formation', reunion: 'Réunion' }
const TYPE_COLOR = { securite: 'alert', social: 'info', formation: 'copper', reunion: 'ink' }

export default function Evenements() {
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Événements</h1>
          <p className="page-sub">{EVENTS.length} événements à venir · {EVENTS.filter((e) => e.required).length} obligatoires</p>
        </div>
        <button className="btn btn-primary"><Plus size={14} /> Créer événement</button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        {EVENTS.map((e) => (
          <div key={e.id} className="card card-pad-lg hover-lift">
            <div className="flex items-center gap-2 mb-3">
              {e.required && <span className="badge badge-alert">Obligatoire</span>}
              <span className={`badge badge-${TYPE_COLOR[e.type]}`}>{TYPE_LABEL[e.type]}</span>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{e.title}</h3>
            <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.6 }}>{e.desc}</div>
            <div style={{ height: 1, background: 'var(--border)', margin: '16px 0' }} />
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>📅 {e.date}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>📍 {e.place}</div>
            {e.participants > 0 && (
              <div className="flex items-center gap-2 mt-3">
                <div className="flex" style={{ marginRight: 4 }}>
                  <div className="avatar" style={{ width: 24, height: 24, fontSize: 9, border: '2px solid var(--surface)' }}>AO</div>
                  <div className="avatar" style={{ width: 24, height: 24, fontSize: 9, marginLeft: -8, border: '2px solid var(--surface)' }}>MK</div>
                  <div className="avatar" style={{ width: 24, height: 24, fontSize: 9, marginLeft: -8, border: '2px solid var(--surface)' }}>PD</div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>+ {e.participants} participants</span>
              </div>
            )}
            <style>{`.avatar { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, var(--copper-500), var(--emerald-600)); display: grid; place-items: center; color: white; font-weight: 700; font-size: 13px; }`}</style>
          </div>
        ))}
      </div>

      <style>{`
        .grid { display: grid; } .gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; }
        .flex { display: flex; } .items-center { align-items: center; } .mt-3 { margin-top: 12px; }
        @media (max-width: 1024px) { .grid[style*="1fr 1fr 1fr"] { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 640px) { .grid[style*="1fr 1fr 1fr"] { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  )
}
