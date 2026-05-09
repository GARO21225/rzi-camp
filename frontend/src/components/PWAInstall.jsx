import React, { useState, useEffect } from 'react'

let deferredPrompt = null

export function PWAInstallButton() {
  const [showBtn, setShowBtn] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      deferredPrompt = e
      setShowBtn(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => { setInstalled(true); setShowBtn(false) })
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    if (outcome === 'accepted') setShowBtn(false)
  }

  if (installed || !showBtn) return null

  return (
    <button onClick={install}
      style={{
        position: 'fixed', bottom: 20, right: 16, zIndex: 999,
        background: 'linear-gradient(135deg,#1e3a8a,#2563eb)',
        color: '#fff', border: 'none', borderRadius: 14,
        padding: '12px 20px', fontSize: 13, fontWeight: 700,
        boxShadow: '0 4px 20px rgba(30,58,138,.4)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10,
        animation: 'fadeIn .4s ease'
      }}>
      <span style={{ fontSize: 22 }}>📱</span>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Installer l'application</div>
        <div style={{ fontSize: 10, opacity: .8 }}>Accès rapide sur votre écran</div>
      </div>
    </button>
  )
}
