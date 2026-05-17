import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { evenements as evtAPI } from '../api'

// ── Notification Style Glovo ────────────────────────────────────
// Affiche les événements récents sous forme de banner coloré
// Auto-dismiss 8s · Cliquable pour naviguer

export default function EventNotifBanner() {
  const [notifs, setNotifs] = useState([])
  const navigate = useNavigate()

  // Charger les événements récents (non vus)
  const checkEvents = useCallback(async () => {
    try {
      const r = await evtAPI.list({ page_size: 5, ordering: '-date_debut' })
      const items = r.data.results || r.data || []
      const seen  = JSON.parse(localStorage.getItem('rzi_seen_events') || '[]')
      const fresh = items.filter(e => !seen.includes(e.id))
      if (fresh.length > 0) {
        // Afficher seulement le plus récent
        setNotifs([fresh[0]])
        // Marquer comme vu après 8s
        setTimeout(() => {
          const updated = [...seen, fresh[0].id]
          localStorage.setItem('rzi_seen_events', JSON.stringify(updated.slice(-20)))
          setNotifs([])
        }, 45000)  // 45 secondes
      }
    } catch {}
  }, [])

  useEffect(() => {
    // Vérifier au montage
    const timer = setTimeout(checkEvents, 2000)
    // Vérifier toutes les 2 minutes
    const interval = setInterval(checkEvents, 2 * 60 * 1000)
    // Écouter les nouvelles notifs du SW
    const onMsg = (e) => {
      if (e.data?.type === 'NEW_EVENT') checkEvents()
    }
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
      navigator.serviceWorker?.removeEventListener('message', onMsg)
    }
  }, [checkEvents])

  if (!notifs.length) return null

  const evt = notifs[0]
  const typeColors = {
    urgence:  { bg: '#dc2626', accent: '#fca5a5', icon: '🚨' },
    reunion:  { bg: '#2563eb', accent: '#bfdbfe', icon: '📅' },
    social:   { bg: '#7c3aed', accent: '#ddd6fe', icon: '🎉' },
    securite: { bg: '#ea580c', accent: '#fed7aa', icon: '🛡️' },
    info:     { bg: '#0891b2', accent: '#cffafe', icon: 'ℹ️' },
  }
  const style = typeColors[evt.type_evenement] || { bg: '#1e3a8a', accent: '#bfdbfe', icon: '📢' }

  return (
    <div
      onClick={() => { navigate('/evenements'); setNotifs([]) }}
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9998,
        width: 'min(420px, calc(100vw - 32px))',
        background: style.bg,
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,.35)',
        cursor: 'pointer',
        animation: 'slideUp .4s cubic-bezier(.34,1.56,.64,1)',
        display: 'flex',
        alignItems: 'stretch',
      }}>

      {/* Bande accent gauche */}
      <div style={{ width: 6, background: style.accent, flexShrink: 0 }} />

      {/* Contenu */}
      <div style={{ flex: 1, padding: '14px 16px', minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontSize: 28 }}>{style.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: style.accent, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 }}>
              Nouvel événement
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {evt.titre || evt.title || 'Événement'}
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); setNotifs([]) }}
            style={{ background: 'rgba(255,255,255,.2)', border: 'none', color: '#fff', width: 26, height: 26, borderRadius: 13, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            ✕
          </button>
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginBottom: 8 }}>
          {evt.description ? evt.description.slice(0, 80) + (evt.description.length > 80 ? '…' : '') : ''}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: style.accent }}>
            📍 {evt.lieu || 'Camp Roxgold Sango'}
          </div>
          <div style={{ background: 'rgba(255,255,255,.25)', color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
            Voir →
          </div>
        </div>
      </div>

      {/* Barre de progression auto-dismiss */}
      <style>{`
        @keyframes shrink { from { width: 100% } to { width: 0% } }
        .notif-progress { animation: shrink 45s linear forwards; }
      `}</style>
      <div style={{ position: 'absolute', bottom: 0, left: 0, height: 3, background: 'rgba(255,255,255,.3)', width: '100%' }}>
        <div className="notif-progress" style={{ height: '100%', background: style.accent }} />
      </div>
    </div>
  )
}
