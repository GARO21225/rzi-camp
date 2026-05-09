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

  const fetchCount = useCallback(async () => {
    if (!token) return
    try {
      const r = await notifications.compteur()
      setCount(r.data.non_lues || 0)
      setAlertes(r.data.alertes || [])
      setProchainEvt(r.data.prochain_evenement || null)
    } catch {}
  }, [token])

  const fetchList = useCallback(async () => {
    if (!token) return
    try {
      const r = await notifications.list({ page_size: 20 })
      setItems(r.data.results || r.data || [])
    } catch {}
  }, [token])

  const connectWS = useCallback(() => {
    if (!token) return
    try {
      const base = (import.meta.env.VITE_API_URL || window.location.origin)
        .replace('https://', 'wss://')
        .replace('http://', 'ws://')
      const ws = new WebSocket(`${base}/ws/notifications/`)
      wsRef.current = ws
      ws.onmessage = (e) => {
        try {
          const d = JSON.parse(e.data)
          if (d.type === 'count') setCount(d.count || 0)
          if (d.type === 'notification') {
            setCount(c => c + 1)
            fetchList()
            if (window.Notification?.permission === 'granted') {
              new window.Notification('🏔 Roxgold Sango', { body: d.titre || 'Nouvelle notification' })
            }
          }
        } catch {}
      }
      ws.onclose = () => {
        wsRef.current = null
        // Don't reconnect — polling handles it
      }
      ws.onerror = () => {
        wsRef.current = null
      }
    } catch {}
  }, [token, fetchList])

  useEffect(() => {
    if (!token) return
    fetchCount()
    fetchList()
    connectWS()
    // Poll every 30s as fallback
    pollRef.current = setInterval(fetchCount, 30000)
    // Request browser notif permission
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
      fetchList()
    } catch {}
  }

  return { count, items, alertes, prochainEvt, fetchList, marquerToutLu }
}
