/**
 * LoadingSpinner + EmptyState + ErrorState
 * Composants UI centralisés pour les états de chargement
 * Répétés dans toutes les pages
 */
import React from 'react'

export function LoadingSpinner({ message = 'Chargement...', size = 'md' }) {
  const s = size === 'sm' ? 30 : size === 'lg' ? 80 : 50
  return (
    <div style={{textAlign:'center', padding: s, color:'#94a3b8'}}>
      <div style={{fontSize: size === 'sm' ? 20 : 32, marginBottom:8}}>⏳</div>
      <div style={{fontSize:13}}>{message}</div>
    </div>
  )
}

export function EmptyState({ icon = '📭', title = 'Aucun résultat', subtitle = '', action = null }) {
  return (
    <div style={{textAlign:'center', padding:60, color:'#94a3b8'}}>
      <div style={{fontSize:48, marginBottom:12}}>{icon}</div>
      <div style={{fontSize:16, fontWeight:600, color:'#64748b', marginBottom:4}}>{title}</div>
      {subtitle && <div style={{fontSize:13, marginBottom:16}}>{subtitle}</div>}
      {action && action}
    </div>
  )
}

export function ErrorState({ error, onRetry }) {
  return (
    <div style={{textAlign:'center', padding:40, color:'#dc2626'}}>
      <div style={{fontSize:32, marginBottom:8}}>⚠️</div>
      <div style={{fontSize:14, fontWeight:600, marginBottom:8}}>Erreur de chargement</div>
      <div style={{fontSize:12, color:'#94a3b8', marginBottom:16}}>{error}</div>
      {onRetry && (
        <button onClick={onRetry}
          style={{background:'#1e3a8a',color:'#fff',border:'none',borderRadius:9,
            padding:'8px 20px',cursor:'pointer',fontSize:13,fontWeight:700}}>
          🔄 Réessayer
        </button>
      )}
    </div>
  )
}

/**
 * StatusBadge — badge coloré centralisé
 * status: 'ok' | 'warning' | 'error' | 'info' | 'neutral'
 */
export function StatusBadge({ label, status = 'neutral', size = 'sm' }) {
  const colors = {
    ok:      { bg:'#dcfce7', color:'#16a34a' },
    warning: { bg:'#fef3c7', color:'#92400e' },
    error:   { bg:'#fee2e2', color:'#dc2626' },
    info:    { bg:'#eff6ff', color:'#1e3a8a' },
    neutral: { bg:'#f1f5f9', color:'#64748b' },
    purple:  { bg:'#f5f3ff', color:'#7c3aed' },
  }
  const { bg, color } = colors[status] || colors.neutral
  return (
    <span style={{background:bg, color, padding: size === 'sm' ? '3px 10px' : '5px 14px',
      borderRadius:99, fontSize: size === 'sm' ? 11 : 13, fontWeight:700,
      display:'inline-block', whiteSpace:'nowrap'}}>
      {label}
    </span>
  )
}
