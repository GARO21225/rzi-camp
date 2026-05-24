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

// ── Bouton installation PWA ─────────────────────────────────
export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(false)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('pwa_dismissed') === '1')

  useEffect(() => {
    const handler = e => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDeferredPrompt(null)
  }

  const dismiss = e => { e.stopPropagation(); setDismissed(true); localStorage.setItem('pwa_dismissed','1') }

  if (!deferredPrompt || installed || dismissed) return null

  return (
    <div style={{
      position:'fixed', bottom:80, right:16, zIndex:999,
      background:'linear-gradient(135deg,#1e3a8a,#1d4ed8)',
      color:'#fff', borderRadius:16, padding:'12px 16px',
      boxShadow:'0 4px 20px rgba(30,58,138,.4)',
      display:'flex', alignItems:'center', gap:12, maxWidth:280,
    }}>
      <div style={{fontSize:28}}>📲</div>
      <div style={{flex:1}}>
        <div style={{fontWeight:700,fontSize:13,marginBottom:3}}>Installer l'application</div>
        <div style={{fontSize:11,color:'rgba(255,255,255,.8)',marginBottom:8}}>
          Accès rapide, fonctionne hors réseau
        </div>
        <div style={{display:'flex',gap:6}}>
          <button onClick={install}
            style={{background:'#f0a500',color:'#000',border:'none',padding:'5px 14px',
              borderRadius:99,cursor:'pointer',fontSize:12,fontWeight:700}}>
            Installer
          </button>
          <button onClick={dismiss}
            style={{background:'rgba(255,255,255,.15)',color:'#fff',border:'none',padding:'5px 10px',
              borderRadius:99,cursor:'pointer',fontSize:12}}>
            Plus tard
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Hook: état réseau ───────────────────────────────────────
export function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    window.addEventListener('online',  () => setOnline(true))
    window.addEventListener('offline', () => setOnline(false))
  }, [])
  return online
}
