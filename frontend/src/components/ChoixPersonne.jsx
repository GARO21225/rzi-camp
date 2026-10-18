// Sélecteur de personne : on tape un nom, la liste se filtre, on clique pour choisir.
// options = [{id, nom, detail?}] ; onChoisir(id) est appelé au clic.
import React, { useState, useMemo } from 'react'

export default function ChoixPersonne({ options = [], onChoisir, placeholder = 'Saisir un nom…', style }) {
  const [q, setQ] = useState('')
  const [ouvert, setOuvert] = useState(false)
  const filtrees = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (t ? options.filter(o => `${o.nom} ${o.detail || ''}`.toLowerCase().includes(t)) : options).slice(0, 50)
  }, [q, options])
  return (
    <div style={{ position: 'relative', maxWidth: 380, ...style }}>
      <input value={q} placeholder={placeholder} onFocus={() => setOuvert(true)} onBlur={() => setTimeout(() => setOuvert(false), 150)}
        onChange={e => { setQ(e.target.value); setOuvert(true) }}
        style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 12px', fontSize: 13, background: '#fff' }} />
      {ouvert && (
        <div style={{ position: 'absolute', zIndex: 500, left: 0, right: 0, top: '100%', marginTop: 4, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, maxHeight: 240, overflowY: 'auto', boxShadow: '0 8px 24px rgba(15,23,42,.15)' }}>
          {filtrees.length === 0
            ? <div style={{ padding: '10px 12px', fontSize: 12.5, color: '#94a3b8' }}>Aucune personne trouvée</div>
            : filtrees.map(o => (
              <div key={o.id} onMouseDown={e => e.preventDefault()} onClick={() => { onChoisir(o.id); setQ(''); setOuvert(false) }}
                style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontWeight: 600 }}>{o.nom}</span>
                {o.detail && <span style={{ color: '#94a3b8', fontSize: 11.5 }}>{o.detail}</span>}
              </div>))}
        </div>)}
    </div>
  )
}
