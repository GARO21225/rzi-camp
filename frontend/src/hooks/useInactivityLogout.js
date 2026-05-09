import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'

const TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes
const WARN_MS = 9 * 60 * 1000     // warn at 9 min

export function useInactivityLogout() {
  const { logout, token } = useStore()
  const timerRef = useRef(null)
  const warnRef = useRef(null)

  const doLogout = useCallback(() => {
    logout()
    window.location.href = '/login?reason=inactivity'
  }, [logout])

  const reset = useCallback(() => {
    if (!token) return
    clearTimeout(timerRef.current)
    clearTimeout(warnRef.current)
    timerRef.current = setTimeout(doLogout, TIMEOUT_MS)
    warnRef.current = setTimeout(() => {
      const remaining = 60
      window.dispatchEvent(new CustomEvent('inactivity-warning', { detail: { remaining } }))
    }, WARN_MS)
  }, [token, doLogout])

  useEffect(() => {
    if (!token) return
    const events = ['mousedown','mousemove','keypress','scroll','touchstart']
    events.forEach(e => document.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      events.forEach(e => document.removeEventListener(e, reset))
      clearTimeout(timerRef.current)
      clearTimeout(warnRef.current)
    }
  }, [token, reset])
}
