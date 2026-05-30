/**
 * useSessionGuard — Vérifie la session JWT:
 * - Au réveil (visibilitychange)
 * - Au focus de la fenêtre
 * - Toutes les 5 minutes
 * → Déconnecte si le token est expiré
 */
import { useEffect, useRef } from 'react'
import { useStore } from '../store'

function decodeJWT(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload
  } catch { return null }
}

function isTokenExpired(token) {
  const payload = decodeJWT(token)
  if (!payload?.exp) return true
  // Expiré si maintenant > exp (en secondes)
  return Date.now() / 1000 > payload.exp
}

export function useSessionGuard() {
  const { token, logout } = useStore()
  const checkRef = useRef(null)

  const check = () => {
    const t = localStorage.getItem('access_token')
    if (!t) return
    if (isTokenExpired(t)) {
      logout()
      window.location.replace('/login?reason=session_expired')
    }
  }

  useEffect(() => {
    if (!token) return

    // Vérifier immédiatement
    check()

    // Vérifier au retour en premier plan (réveil iPhone/Android)
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Vérifier au focus (retour sur la fenêtre)
    window.addEventListener('focus', check)

    // Check périodique toutes les 5 minutes
    checkRef.current = setInterval(check, 5 * 60 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', check)
      clearInterval(checkRef.current)
    }
  }, [token])
}
