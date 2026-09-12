import React, { useState, useEffect, useCallback } from 'react'
import { subscribeToast } from '../toast'

const STYLES = {
  success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', icon: '✅' },
  error:   { bg: '#fef2f2', border: '#fecaca', color: '#991b1b', icon: '❌' },
  warning: { bg: '#fffbeb', border: '#fde68a', color: '#92400e', icon: '⚠️' },
  info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', icon: 'ℹ️' },
}

export default function ToastContainer() {
  const [items, setItems] = useState([])

  const remove = useCallback((id) => {
    setItems(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    return subscribeToast((item) => {
      setItems(prev => [...prev, item])
      setTimeout(() => remove(item.id), item.duree)
    })
  }, [remove])

  if (items.length === 0) return null

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360,
      pointerEvents: 'none',
    }}>
      {items.map(item => {
        const s = STYLES[item.type] || STYLES.info
        return (
          <div key={item.id} onClick={() => remove(item.id)}
            style={{
              pointerEvents: 'auto', cursor: 'pointer',
              background: s.bg, border: `1px solid ${s.border}`, color: s.color,
              borderRadius: 10, padding: '12px 14px', fontSize: 13, fontWeight: 600,
              boxShadow: '0 8px 24px rgba(0,0,0,.12)',
              display: 'flex', alignItems: 'flex-start', gap: 8,
              animation: 'toast-in 0.25s ease-out',
            }}>
            <span style={{ fontSize: 15, flexShrink: 0 }}>{s.icon}</span>
            <span style={{ flex: 1, lineHeight: 1.4 }}>{item.message}</span>
          </div>
        )
      })}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}
