import { useState, useEffect, useRef, useCallback } from 'react'
import { notifications } from '../api'
import { useStore } from '../store'

export function useNotifications() {
  const { token } = useStore()
  const [count, setCount] = useState(0)
  const [items, setItems] = useState([])
  const [alertes, setAlertes] = useState([])
  const [prochainEvt, setProchainEvt] = useState(null)
  const wsRef = useRef(null)
  const pollRef = useRef(null)

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

  useEffect(() => {
    if (!token) return
    const base = (import.meta.env.VITE_API_URL || window.location.origin)
      .replace('https://', 'wss://').replace('http://', 'ws://')

    const connect = () => {
      try {
        const ws = new WebSocket(`${base}/ws/notifications/`)
        wsRef.current = ws
        ws.onmessage = (e) => {
          const d = JSON.parse(e.data)
          if (d.type === 'count') setCount(d.count)
          if (d.type === 'notification') {
            setCount(c => c + 1)
            fetchList()
            if (window.Notification?.permission === 'granted') {
              new window.Notification('🏔 Roxgold Sango — ' + d.titre, { body: d.message })
            }
          }
        }
        ws.onclose = () => { setTimeout(connect, 5000) }
      } catch {}
    }

    connect()
    fetchCount()
    fetchList()
    pollRef.current = setInterval(fetchCount, 30000)
    return () => { wsRef.current?.close(); clearInterval(pollRef.current) }
  }, [token])

  const marquerToutLu = async () => {
    await notifications.toutLire(); setCount(0); fetchList()
  }

  // Request browser notification permission
  useEffect(() => {
    if (window.Notification && window.Notification.permission === 'default') {
      window.Notification.requestPermission()
    }
  }, [])

  return { count, items, alertes, prochainEvt, fetchList, marquerToutLu }
}
