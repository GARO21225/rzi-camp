import { useState, useEffect, useRef, useCallback } from 'react'
import { notifications } from '../api'
import { useStore } from '../store'

export function useNotifications() {
  const { token } = useStore()
  const [count, setCount] = useState(0)
  const [items, setItems] = useState([])
  const [alertes, setAlertes] = useState([])
  const [prochainEvt, setProchainEvt] = useState(null)
  const pollRef = useRef(null)
  const wsRef = useRef(null)

  const fetch = useCallback(async () => {
    if (!token) return
    try {
      const r = await notifications.compteur()
      const d = r.data
      setCount(d.non_lues || 0)
      setAlertes(d.alertes || [])
      setProchainEvt(d.prochain_evenement || null)
      // Use unified notifications list from compteur
      if (d.notifications) setItems(d.notifications)
    } catch {}
  }, [token])

  // WebSocket désactivé : backend Render n'a pas /ws/notifications/
  // On utilise uniquement le polling HTTP toutes les 20s (suffisant)
  const connectWS = useCallback(() => {
    // No-op: pas de WebSocket pour le moment
  }, [token, fetch])

  useEffect(() => {
    if (!token) return
    fetch()
    connectWS()
    pollRef.current = setInterval(fetch, 20000) // Poll every 20s
    if (window.Notification?.permission === 'default') {
      window.Notification.requestPermission().catch(() => {})
    }
    return () => {
      clearInterval(pollRef.current)
      wsRef.current?.close()
    }
  }, [token])

  const marquerToutLu = async () => {
    try {
      await notifications.toutLire()
      setCount(0)
      setItems(prev => prev.map(n => ({...n, lu:true})))
    } catch {}
  }

  return { count, items, alertes, prochainEvt, fetch, marquerToutLu }
}
