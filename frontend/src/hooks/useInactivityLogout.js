import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { useNavigate } from 'react-router-dom'

const TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes
const WARNING_MS = 9 * 60 * 1000  // warn at 9 min

export function useInactivityLogout() {
  const { logout, token } = useStore()
  const navigate = useNavigate()
  const timerRef = useRef(null)
  const warnRef = useRef(null)
  const lastActivity = useRef(Date.now())

  const doLogout = useCallback(() => {
    logout()
    navigate('/login?reason=inactivity')
  }, [logout, navigate])

  const resetTimer = useCallback(() => {
    if (!token) return
    lastActivity.current = Date.now()
    clearTimeout(timerRef.current)
    clearTimeout(warnRef.current)
    timerRef.current = setTimeout(doLogout, TIMEOUT_MS)
    warnRef.current = setTimeout(() => {
      const remaining = Math.round((TIMEOUT_MS - (Date.now() - lastActivity.current)) / 1000)
      if (remaining > 0) {
        // Show toast notification
        const evt = new CustomEvent('inactivity-warning', { detail: { remaining } })
        window.dispatchEvent(evt)
      }
    }, WARNING_MS)
  }, [token, doLogout])

  useEffect(() => {
    if (!token) return
    const events = ['mousedown','mousemove','keypress','scroll','touchstart','click']
    events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()
    return () => {
      events.forEach(e => document.removeEventListener(e, resetTimer))
      clearTimeout(timerRef.current)
      clearTimeout(warnRef.current)
    }
  }, [token, resetTimer])

  return { resetTimer }
}
