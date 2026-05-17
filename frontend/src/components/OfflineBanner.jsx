import React, { useState, useEffect } from 'react'

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  const [queued, setQueued] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  useEffect(() => {
    const onOnline  = () => setOffline(false)
    const onOffline = () => setOffline(true)
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)

    // Écouter les messages du SW
    const onMsg = (e) => {
      if (e.data?.type === 'QUEUED') {
        setQueued(e.data.count || 1)
      }
      if (e.data?.type === 'SYNCED') {
        setSyncing(false)
        setQueued(e.data.fail || 0)
        if (e.data.done > 0) {
          setSyncMsg(`✅ ${e.data.done} action(s) synchronisée(s)`)
          setTimeout(() => setSyncMsg(''), 4000)
        }
      }
    }
    navigator.serviceWorker?.addEventListener('message', onMsg)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      navigator.serviceWorker?.removeEventListener('message', onMsg)
    }
  }, [])

  const sync = () => {
    setSyncing(true)
    navigator.serviceWorker?.controller?.postMessage({ type: 'SYNC_NOW' })
  }

  if (!offline && queued === 0 && !syncMsg) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 18px',
      borderRadius: 50,
      boxShadow: '0 8px 32px rgba(0,0,0,.25)',
      fontSize: 13,
      fontWeight: 600,
      whiteSpace: 'nowrap',
      maxWidth: 'calc(100vw - 32px)',
      background: offline ? '#1e293b' : '#f0fdf4',
      color: offline ? '#fff' : '#166534',
      border: offline ? 'none' : '1px solid #86efac',
      transition: 'all .3s ease',
      animation: 'slideUp .3s ease',
    }}>
      {offline ? (
        <>
          <span>📡</span>
          <span>Mode hors-ligne</span>
          {queued > 0 && (
            <span style={{ background: '#f97316', color: '#fff', padding: '2px 8px', borderRadius: 20, fontSize: 11 }}>
              {queued} en attente
            </span>
          )}
        </>
      ) : queued > 0 ? (
        <>
          <span>🔄</span>
          <span>{queued} action(s) à synchroniser</span>
          <button onClick={sync} disabled={syncing}
            style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            {syncing ? '⏳' : 'Sync'}
          </button>
        </>
      ) : (
        <span>{syncMsg}</span>
      )}
    </div>
  )
}
