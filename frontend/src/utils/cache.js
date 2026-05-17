// Cache mémoire simple avec TTL pour éviter les appels API redondants
const _store = new Map()

export const apiCache = {
  get(key) {
    const e = _store.get(key)
    if (!e) return null
    if (Date.now() > e.exp) { _store.delete(key); return null }
    return e.data
  },
  set(key, data, ttl = 30000) {
    _store.set(key, { data, exp: Date.now() + ttl })
  },
  clear(prefix) {
    if (prefix) { for (const k of _store.keys()) if (k.startsWith(prefix)) _store.delete(k) }
    else _store.clear()
  }
}

export async function cachedFetch(key, fn, ttl = 30000) {
  const cached = apiCache.get(key)
  if (cached !== null) return { data: cached, fromCache: true }
  const r = await fn()
  apiCache.set(key, r.data, ttl)
  return r
}
