// Lieu d'une déclaration de maintenance : un hébergement (résidence + bloc/chambre) OU une autre infrastructure
// du camp (infirmerie, restauration…). Stocké dans les champs existants `residence` + `bloc` — aucune migration.
import React, { useState } from 'react'
import ComboLibre from './ComboLibre'

// Libellés ≤ 20 caractères (longueur max du champ `residence`).
export const INFRASTRUCTURES = [
  'Infirmerie', 'Restauration', 'Bar & boutique', 'Salle de sport', 'Blanchisserie', 'Bureaux',
  'Atelier', 'Magasin', 'Parking', 'Voirie / extérieurs', 'Réseau eau', 'Réseau électrique',
  'Station carburant', 'Salle de réunion', 'Autre infra.',
]

export default function LieuIncident({ residence, bloc, onChange, residences = [], style, isMobile }) {
  const [mode, setMode] = useState(() => (INFRASTRUCTURES.includes(residence) ? 'infra' : 'heberg'))
  const lab = { display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 4 }
  const seg = (actif) => ({
    flex: 1, padding: '8px 10px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', borderRadius: 8,
    border: `1.5px solid ${actif ? 'var(--rzc-navy,#0F2A5C)' : '#e2e8f0'}`,
    background: actif ? 'var(--rzc-navy,#0F2A5C)' : '#fff', color: actif ? '#fff' : '#475569',
  })
  const changerMode = (m) => {
    if (m === mode) return
    setMode(m)
    onChange({ residence: '', bloc: '' })
  }
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div>
        <label style={lab}>TYPE DE LIEU</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={seg(mode === 'heberg')} onClick={() => changerMode('heberg')}>🏠 Hébergement</button>
          <button type="button" style={seg(mode === 'infra')} onClick={() => changerMode('infra')}>🏥 Autre infrastructure</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <div>
          <label style={lab}>{mode === 'infra' ? 'INFRASTRUCTURE *' : 'RÉSIDENCE *'}</label>
          <ComboLibre value={residence} onChange={(v) => onChange({ residence: v.slice(0, 20), bloc })}
            placeholder="Choisir dans la liste ou saisir…" style={style}
            options={mode === 'infra' ? INFRASTRUCTURES : residences} />
        </div>
        <div>
          <label style={lab}>{mode === 'infra' ? 'PRÉCISION (salle, zone…)' : 'BLOC / CHAMBRE'}</label>
          <input value={bloc} onChange={(e) => onChange({ residence, bloc: e.target.value })}
            placeholder={mode === 'infra' ? 'Ex: salle de soins, cuisine…' : 'Ex: Bloc 3, Ch. 12'} style={style} />
        </div>
      </div>
    </div>
  )
}
