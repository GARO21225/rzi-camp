/**
 * Cache API intelligent — Network-First avec fallback IndexedDB
 * Gère les mutations offline (POST/PATCH/DELETE en attente)
 */

// ── Cache en mémoire (session) ───────────────────────────────
const MEM_CACHE = new Map()
const TTL = { default: 3*60*1000, geojson: 30*60*1000, images: 7*24*60*60*1000 }

// ── LocalStorage cache ───────────────────────────────────────
const STORAGE_KEY = 'rzi_api_cache'
const QUEUE_KEY   = 'rzi_offline_queue'

function storageGet(key) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${key}`)
    if (!raw) return null
    const { data, ts, ttl } = JSON.parse(raw)
    if (Date.now() - ts > ttl) { localStorage.removeItem(`${STORAGE_KEY}_${key}`); return null }
    return data
  } catch { return null }
}

function storageSet(key, data, ttl = TTL.default) {
  try { localStorage.setItem(`${STORAGE_KEY}_${key}`, JSON.stringify({ data, ts: Date.now(), ttl })) }
  catch(e) { if (e.name === 'QuotaExceededError') clearOldCache() }
}

function clearOldCache() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_KEY))
  keys.slice(0, Math.floor(keys.length / 2)).forEach(k => localStorage.removeItem(k))
}

// ── Queue mutations offline ──────────────────────────────────
export function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] }
}

export function addToOfflineQueue(mutation) {
  const q = getOfflineQueue()
  q.push({ ...mutation, id: Date.now(), ts: new Date().toISOString() })
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export function clearOfflineQueue() {
  localStorage.removeItem(QUEUE_KEY)
}

export async function flushOfflineQueue(api) {
  const q = getOfflineQueue()
  if (!q.length) return 0
  let success = 0
  for (const mut of q) {
    try {
      const { method, url, data } = mut
      if (method === 'POST')   await api.post(url, data)
      if (method === 'PATCH')  await api.patch(url, data)
      if (method === 'DELETE') await api.delete(url)
      success++
    } catch(e) { console.warn('Offline queue flush error:', e) }
  }
  clearOfflineQueue()
  return success
}

// ── cachedFetch: Network-First avec fallback cache ───────────
export async function cachedFetch(apiFn, cacheKey, ttl = TTL.default) {
  // 1. Essayer le réseau
  if (navigator.onLine) {
    try {
      const res = await Promise.race([
        apiFn(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))
      ])
      const data = res.data
      storageSet(cacheKey, data, ttl)
      MEM_CACHE.set(cacheKey, { data, ts: Date.now() })
      return data
    } catch(e) {
      if (e.message !== 'timeout') throw e
      // timeout → fallback cache
    }
  }

  // 2. Fallback: mémoire
  const mem = MEM_CACHE.get(cacheKey)
  if (mem && Date.now() - mem.ts < TTL.default) return mem.data

  // 3. Fallback: localStorage
  const stored = storageGet(cacheKey)
  if (stored) return stored

  // 4. Pas de cache → erreur réseau
  throw new Error('Hors réseau — données non disponibles en cache')
}

export const apiCache = { cachedFetch, storageGet, storageSet }
export default apiCache
