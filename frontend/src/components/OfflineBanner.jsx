/**
 * OfflineBanner + PWA Install + Offline cache manager
 */
import React, { useState, useEffect, useCallback } from 'react'

// ── Bannière hors réseau ────────────────────────────────────
export function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    const goOn  = () => setOffline(false)
    const goOff = () => { setOffline(true); setShowDetail(true) }
    window.addEventListener('online',  goOn)
    window.addEventListener('offline', goOff)
    return () => { window.removeEventListener('online',goOn); window.removeEventListener('offline',goOff) }
  }, [])

  if (!offline) return null

  return (
    <div style={{
      position:'fixed', top:0, left:0, right:0, zIndex:9999,
      background:'linear-gradient(135deg,#92400e,#b45309)',
      color:'#fff', padding:'10px 20px',
      display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
      boxShadow:'0 2px 12px rgba(0,0,0,.3)', cursor:'pointer',
    }} onClick={()=>setShowDetail(!showDetail)}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <span style={{fontSize:18}}>📡</span>
        <div>
          <div style={{fontWeight:700,fontSize:13}}>Mode hors réseau</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,.8)'}}>
            Données mises en cache disponibles · Modifications enregistrées dès reconnexion
          </div>
        </div>
      </div>
      <span style={{fontSize:12,color:'rgba(255,255,255,.7)'}}>
        {showDetail ? '▲' : '▼'}
      </span>
    </div>
  )
}

// PWAInstallButton a été déplacé : la version maintenue est dans PWAInstall.jsx
// (support iOS + Android, voir App.jsx). Celle qui était ici était dupliquée
// et n'a jamais été branchée nulle part — supprimée pour éviter toute confusion
// future sur laquelle des deux est la version active.

// ── Hook: état réseau ───────────────────────────────────────
export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    window.addEventListener('online',  () => setOnline(true))
    window.addEventListener('offline', () => setOnline(false))
  }, [])
  return online
}
