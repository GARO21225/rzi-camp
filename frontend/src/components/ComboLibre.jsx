// Champ « choisir dans la liste OU saisir librement » : liste filtrée qui s'ouvre au toucher / à la frappe.
// Remplace <input list=…><datalist> (invisible sur mobile tant qu'on n'a pas tapé). Liste dans le flux (pas de
// positionnement absolu) pour ne jamais être rognée par une fenêtre modale.
import React, { useState, useMemo } from 'react'

export default function ComboLibre({ value, onChange, options = [], placeholder, style, vide = 'Aucun résultat — la saisie libre sera utilisée', connuLabel = 'Résidence connue' }) {
  const [ouvert, setOuvert] = useState(false)
  const filtrees = useMemo(() => {
    const q = (value || '').trim().toLowerCase()
    const liste = q ? options.filter(o => String(o).toLowerCase().includes(q)) : options
    return liste.slice(0, 80)
  }, [value, options])
  const connu = options.some(o => String(o).toLowerCase() === (value || '').trim().toLowerCase())

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input value={value} placeholder={placeholder} style={{ ...style, paddingRight: 34 }}
          onFocus={() => setOuvert(true)}
          onChange={e => { onChange(e.target.value); setOuvert(true) }} />
        <button type="button" aria-label="Afficher la liste" onClick={() => setOuvert(o => !o)}
          style={{ position: 'absolute', right: 4, top: 0, bottom: 0, width: 30, border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', fontSize: 12 }}>
          {ouvert ? '▲' : '▼'}
        </button>
      </div>
      {ouvert && (
        <div style={{ marginTop: 4, border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', maxHeight: 200, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {filtrees.length === 0
            ? <div style={{ padding: '8px 12px', fontSize: 12, color: '#94a3b8' }}>{vide}</div>
            : filtrees.map(o => (
              <div key={o} onMouseDown={e => e.preventDefault()} onClick={() => { onChange(String(o)); setOuvert(false) }}
                style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                  background: String(o) === value ? '#eff6ff' : '#fff', fontWeight: String(o) === value ? 700 : 400 }}>
                {o}
              </div>))}
          <div style={{ padding: '6px 12px', fontSize: 10, color: '#94a3b8', background: '#f8fafc', display: 'flex', justifyContent: 'space-between' }}>
            <span>{connu ? `✔ ${connuLabel}` : value ? '✎ Saisie libre' : 'Choisissez ou saisissez'}</span>
            <button type="button" onClick={() => setOuvert(false)} style={{ border: 'none', background: 'transparent', color: '#2563eb', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  )
}
