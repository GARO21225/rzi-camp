import React, { useState, useEffect } from 'react'
import { subscribeConfirm } from '../toast'

export default function ConfirmDialogContainer() {
  const [item, setItem] = useState(null)

  useEffect(() => {
    return subscribeConfirm((newItem) => setItem(newItem))
  }, [])

  if (!item) return null

  const repondre = (val) => {
    item.resolve(val)
    setItem(null)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,.55)', zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    }} onClick={(e) => { if (e.target === e.currentTarget) repondre(false) }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: '100%', maxWidth: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,.3)', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 20px 4px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: item.danger ? '#dc2626' : 'var(--rzc-navy, #0F2A5C)', marginBottom: 8 }}>
            {item.danger ? '⚠️ ' : ''}{item.titre}
          </div>
          <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{item.message}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: 16 }}>
          <button onClick={() => repondre(false)}
            style={{ flex: 1, background: '#f1f5f9', color: '#475569', border: 'none', padding: 10, borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            Annuler
          </button>
          <button onClick={() => repondre(true)}
            style={{ flex: 1, background: item.danger ? '#dc2626' : 'var(--rzc-navy, #0F2A5C)', color: '#fff', border: 'none', padding: 10, borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
            Confirmer
          </button>
        </div>
      </div>
    </div>
  )
}
