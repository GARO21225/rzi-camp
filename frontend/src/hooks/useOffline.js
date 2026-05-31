import { useState, useEffect, useCallback } from 'react'

const QUEUE_KEY = 'rzi_offline_queue'

export function useOffline() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)

  const flushQueue = useCallback(async () => {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    if (!queue.length) return
    setSyncing(true)
    setSyncMsg(`🔄 Synchronisation de ${queue.length} opération(s)...`)
    const BASE = import.meta?.env?.VITE_API_URL || 'https://rzi-camp-backend.onrender.com'
    const token = localStorage.getItem('access_token') || ''
    let success = 0, failed = []
    for (const op of queue) {
      try {
        await fetch(`${BASE}${op.url}`, {
          method: op.method || 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(op.data)
        })
        success++
      } catch (e) {
        failed.push(op)
      }
    }
    localStorage.setItem(QUEUE_KEY, JSON.stringify(failed))
    setSyncing(false)
    setSyncMsg(failed.length
      ? `⚠️ ${success} sync, ${failed.length} en attente`
      : `✅ Connexion rétablie — ${success} opération(s) synchronisée(s)`)
    setTimeout(() => setSyncMsg(null), 5000)
  }, [])

  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = async () => {
      setIsOffline(false)
      await flushQueue()
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [flushQueue])

  const queueOffline = useCallback((url, data, method = 'POST') => {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    queue.push({ url, data, method, ts: Date.now() })
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  }, [])

  return { isOffline, syncing, syncMsg, queueOffline }
}
