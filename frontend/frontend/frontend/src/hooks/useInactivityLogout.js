import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'

const TIMEOUT_MS = 15 * 60 * 1000  // 15 minutes d'inactivité
const WARN_MS    = 14 * 60 * 1000  // Avertissement à 14 min

export function useInactivityLogout() {
  const { logout, token } = useStore()
  const timerRef = useRef(null)
  const warnRef  = useRef(null)

  const doLogout = useCallback(() => {
    logout()
    window.location.replace('/login?reason=inactivity')
  }, [logout])

  const reset = useCallback(() => {
    if (!token) return
    clearTimeout(timerRef.current)
    clearTimeout(warnRef.current)
    timerRef.current = setTimeout(doLogout, TIMEOUT_MS)
    warnRef.current  = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('inactivity-warning', { detail: { remaining: 60 } }))
    }, WARN_MS)
  }, [token, doLogout])

  useEffect(() => {
    if (!token) return

    // Événements desktop + mobile (touch + pointer)
    const EVENTS = [
      'mousedown','mousemove','keydown','keypress',
      'scroll','touchstart','touchmove','pointerdown','pointermove',
      'click','focus','visibilitychange'
    ]

    // Options passives pour la perf mobile
    const opts = { passive: true, capture: false }

    EVENTS.forEach(e => document.addEventListener(e, reset, opts))
    // visibilitychange sur document
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) reset()
    })

    // Sync entre onglets via BroadcastChannel
    let bc = null
    try {
      bc = new BroadcastChannel('rzi_activity')
      bc.onmessage = () => reset()
    } catch {}

    const sendActivity = () => {
      try { bc?.postMessage('active') } catch {}
    }

    // Relayer l'activité aux autres onglets
    const relay = () => { reset(); sendActivity() }
    EVENTS.forEach(e => document.addEventListener(e, relay, opts))

    reset()

    return () => {
      EVENTS.forEach(e => {
        document.removeEventListener(e, reset)
        document.removeEventListener(e, relay)
      })
      clearTimeout(timerRef.current)
      clearTimeout(warnRef.current)
      try { bc?.close() } catch {}
    }
  }, [token, reset])
}
