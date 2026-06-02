/**
 * MassActionBar — barre d'actions groupées centralisée
 * Utilisée dans Personnel, Maintenance, Boutique, Historique...
 * 
 * Props:
 *   count: number — nb d'éléments sélectionnés
 *   actions: [{ value, label, color? }]
 *   onApply: (action) => void
 *   onClear: () => void
 *   onDelete?: () => void — si défini, affiche bouton Supprimer
 */
import React, { useState } from 'react'

export default function MassActionBar({ count, actions, onApply, onClear, onDelete }) {
  const [selected, setSelected] = useState('')

  if (count === 0) return null

  return (
    <div style={{
      background: 'linear-gradient(135deg,#1e3a8a,#2563eb)',
      color: '#fff', borderRadius: 12, padding: '10px 16px', marginBottom: 12,
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      boxShadow: '0 4px 12px rgba(30,58,138,.3)',
    }}>
      <span style={{fontWeight:700,fontSize:13}}>
        {count} sélectionné{count > 1 ? 's' : ''}
      </span>

      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        style={{border:'none',borderRadius:8,padding:'5px 10px',fontSize:12,fontWeight:600,
          background:'rgba(255,255,255,.15)',color:'#fff',outline:'none',cursor:'pointer'}}
      >
        <option value="">— Action groupée —</option>
        {actions.map(a => (
          typeof a === 'string'
            ? <optgroup key={a} label={`── ${a}`} style={{color:'#000'}}/>
            : <option key={a.value} value={a.value} style={{color:'#000'}}>{a.label}</option>
        ))}
      </select>

      {selected && (
        <button
          onClick={() => { onApply(selected); setSelected('') }}
          style={{background:'#f0a500',color:'#000',border:'none',padding:'5px 14px',
            borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700}}
        >
          ✓ Appliquer
        </button>
      )}

      {onDelete && (
        <button
          onClick={onDelete}
          style={{background:'#dc2626',color:'#fff',border:'none',padding:'5px 12px',
            borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:700,marginLeft:'auto'}}
        >
          🗑️ Supprimer ({count})
        </button>
      )}

      <button
        onClick={() => { setSelected(''); onClear() }}
        style={{background:'rgba(255,255,255,.2)',color:'#fff',border:'none',padding:'5px 8px',
          borderRadius:8,cursor:'pointer',fontSize:11, marginLeft: onDelete ? 0 : 'auto'}}
      >
        ✕
      </button>
    </div>
  )
}
