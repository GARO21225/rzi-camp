
import React, { useState, useEffect } from 'react'

let deferredPrompt = null

function isIOS() {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) && !window.MSStream
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
}

export function PWAInstallButton() {
  const [showAndroid, setShowAndroid] = useState(false)
  const [showIOS, setShowIOS] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Already installed
    if (isInStandaloneMode()) return
    // Check if already dismissed in this session
    if (sessionStorage.getItem('pwa-dismissed')) return

    if (isIOS()) {
      // On iOS Safari, show manual instructions after 3 seconds
      const timer = setTimeout(() => setShowIOS(true), 3000)
      return () => clearTimeout(timer)
    } else {
      // Android/Chrome: listen for install prompt
      const handler = (e) => {
        e.preventDefault()
        deferredPrompt = e
        setShowAndroid(true)
      }
      window.addEventListener('beforeinstallprompt', handler)
      window.addEventListener('appinstalled', () => setShowAndroid(false))
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const installAndroid = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    deferredPrompt = null
    setShowAndroid(false)
  }

  const dismiss = () => {
    setShowIOS(false)
    setShowAndroid(false)
    setDismissed(true)
    sessionStorage.setItem('pwa-dismissed', '1')
  }

  if (dismissed) return null

  // iOS Instructions
  if (showIOS) return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16, right: 16, zIndex: 9998,
      background: '#fff', border: '2px solid #1e3a8a', borderRadius: 16,
      padding: '16px 18px', boxShadow: '0 8px 32px rgba(30,58,138,.25)',
      animation: 'slideUp .4s ease'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#1e3a8a' }}>
          📱 Installer l'application sur iPhone
        </div>
        <button onClick={dismiss}
          style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b', lineHeight: 1, padding: 0 }}>✕</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <div style={{ background: '#f1f5f9', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#1e3a8a', flexShrink: 0 }}>1</div>
          <span>Appuyez sur <b style={{ color: '#007AFF' }}>Partager</b> <span style={{ fontSize: 16 }}>⬆️</span> en bas de Safari</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <div style={{ background: '#f1f5f9', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#1e3a8a', flexShrink: 0 }}>2</div>
          <span>Faites défiler et tapez <b>"Sur l'écran d'accueil"</b> <span style={{ fontSize: 16 }}>➕</span></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <div style={{ background: '#f1f5f9', borderRadius: 8, padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#1e3a8a', flexShrink: 0 }}>3</div>
          <span>Appuyez sur <b>"Ajouter"</b> en haut à droite ✅</span>
        </div>
      </div>
      <div style={{ marginTop: 12, background: 'rgba(30,58,138,.06)', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#64748b', textAlign: 'center' }}>
        ⚠️ Doit être ouvert dans <b>Safari</b> (pas Chrome) pour fonctionner
      </div>
    </div>
  )

  // Android / Chrome
  if (showAndroid) return (
    <button onClick={installAndroid}
      style={{
        position: 'fixed', bottom: 20, right: 16, zIndex: 9998,
        background: 'linear-gradient(135deg,#1e3a8a,#2563eb)',
        color: '#fff', border: 'none', borderRadius: 14,
        padding: '12px 18px', fontSize: 13, fontWeight: 700,
        boxShadow: '0 4px 20px rgba(30,58,138,.4)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 10,
        animation: 'slideUp .4s ease', maxWidth: 'calc(100vw - 32px)'
      }}>
      <span style={{ fontSize: 22 }}>📱</span>
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Installer l'application</div>
        <div style={{ fontSize: 10, opacity: .8 }}>Accès direct depuis l'écran d'accueil</div>
      </div>
    </button>
  )

  return null
}
