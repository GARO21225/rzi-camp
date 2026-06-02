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

  const connectWS = useCallback(() => {
    if (!token) return
    try {
      const base = (import.meta.env.VITE_API_URL || window.location.origin)
        .replace('https://', 'wss://').replace('http://', 'ws://')
      const ws = new WebSocket(`${base}/ws/notifications/`)
      wsRef.current = ws
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data)
          if (d.type === 'count') setCount(d.count || 0)
          if (d.type === 'notification') {
            setCount(c => c + 1)
            fetch()
            if (window.Notification?.permission === 'granted') {
              new window.Notification('🏔 Roxgold Sango', { body: d.titre || 'Nouvelle notification' })
            }
          }
        } catch {}
      }
      ws.onclose = () => { wsRef.current = null }
      ws.onerror = () => { wsRef.current = null }
    } catch {}
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
