import { useState, useEffect, useCallback, useRef } from 'react'

const QUEUE_KEY = 'rzi_offline_queue'

export function useOffline() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [syncMsg, setSyncMsg] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const failCount = useRef(0)

  const checkBackend = useCallback(async () => {
    if (!navigator.onLine) { failCount.current = 0; setIsOffline(true); return }
    try {
      const BASE = import.meta?.env?.VITE_API_URL || 'http://204.168.229.74:8001'
      // GET sur /api/batiments/?page_size=1 (le backend supporte GET, pas HEAD)
      const r = await fetch(`${BASE}/api/batiments/?page_size=1`, {
        method: 'GET', signal: AbortSignal.timeout(12000)
      }).catch(() => null)
      if (r) {
        // Toute réponse HTTP (même 401/403) prouve que le réseau + le serveur
        // sont joignables — seule une vraie panne réseau/serveur compte.
        failCount.current = 0
        setIsOffline(false)
      } else {
        // On exige 2 échecs consécutifs avant d'afficher "hors ligne", pour
        // éviter les faux positifs dus à un aléa réseau ponctuel (ou, avec un
        // certificat auto-signé, à un appareil qui ne l'a pas encore validé).
        failCount.current += 1
        if (failCount.current >= 2) setIsOffline(true)
      }
    } catch {
      failCount.current += 1
      if (failCount.current >= 2) setIsOffline(true)
    }
  }, [])

  const flushQueue = useCallback(async () => {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    if (!queue.length) return
    setSyncing(true)
    setSyncMsg(`🔄 Synchronisation de ${queue.length} opération(s)...`)
    const BASE = import.meta?.env?.VITE_API_URL || 'http://204.168.229.74:8001'
    const token = localStorage.getItem('access_token') || ''
    let success = 0, failed = []
    for (const op of queue) {
      try {
        const r = await fetch(`${BASE}${op.url}`, {
          method: op.method || 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(op.data)
        })
        if (r.ok) success++
        else failed.push(op)
      } catch (e) { failed.push(op) }
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

    // Vérifier toutes les 30 secondes
    const interval = setInterval(checkBackend, 30000)

    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
      clearInterval(interval)
    }
  }, [flushQueue, checkBackend])

  const queueOffline = useCallback((url, data, method = 'POST') => {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    queue.push({ url, data, method, ts: Date.now() })
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  }, [])

  return { isOffline, syncing, syncMsg, queueOffline }
}
