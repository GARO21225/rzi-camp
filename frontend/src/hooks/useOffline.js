import { useState, useEffect, useCallback, useRef } from 'react'

const QUEUE_KEY = 'rzi_offline_queue'

export function useOffline() {
  // On démarre optimiste (pas hors ligne) : navigator.onLine n'est pas fiable
  // ici, checkBackend() ci-dessous vérifie la vraie joignabilité dès le montage.
  const [isOffline, setIsOffline] = useState(false)
  const [syncMsg, setSyncMsg] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const failCount = useRef(0)

  const checkBackend = useCallback(async () => {
    // IMPORTANT : ne jamais se fier à navigator.onLine seul pour décider —
    // c'est justement lui qui donne de faux "hors ligne" sur un réseau
    // intranet/camp (le serveur local reste joignable même si l'OS pense
    // qu'il n'y a pas d'accès internet global). La seule preuve fiable
    // est une vraie requête au serveur, ci-dessous.
    const BASE = import.meta?.env?.VITE_API_URL || window.location.origin
    // Timeout manuel via AbortController — AbortSignal.timeout() n'existe
    // pas sur tous les navigateurs/versions ; s'il manquait, l'appel
    // plantait avant même d'atteindre le fetch, faisant échouer CE test
    // à 100% du temps, peu importe l'état réel du réseau.
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12000)
    let r = null
    try {
      r = await fetch(`${BASE}/api/batiments/?page_size=1`, {
        method: 'GET', signal: controller.signal
      })
    } catch {
      r = null
    } finally {
      clearTimeout(timer)
    }
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
  }, [])

  const flushQueue = useCallback(async () => {
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]')
    if (!queue.length) return
    setSyncing(true)
    setSyncMsg(`🔄 Synchronisation de ${queue.length} opération(s)...`)
    const BASE = import.meta?.env?.VITE_API_URL || window.location.origin
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
    // Les événements navigateur 'offline'/'online' se basent sur le même
    // navigator.onLine peu fiable ici — on les traite comme un simple
    // déclencheur pour revérifier réellement, pas comme une vérité.
    const goOffline = () => checkBackend()
    const goOnline = async () => {
      await checkBackend()
      await flushQueue()
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)

    // Vérification immédiate au montage (ne pas attendre 30s et rester
    // bloqué sur le "!navigator.onLine" initial, peu fiable sur ce réseau)
    checkBackend()

    // Puis vérifier toutes les 30 secondes
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

  return { isOffline, syncing, syncMsg, queueOffline, retry: checkBackend }
}
