import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { getOfflineQueue, addToOfflineQueue, clearOfflineQueue, flushOfflineQueue, cachedFetch } from './cache'

// tests/setup.js remplace window.localStorage par un simple espion (getItem renvoie toujours null,
// setItem ne stocke rien) — suffisant pour les composants qui ne font qu'appeler ces méthodes, mais
// cache.js a besoin d'un VRAI stockage (écrire puis relire). On installe ici un faux localStorage en
// mémoire, local à ce fichier de test, sans toucher au mock partagé des autres tests.
const original = Object.getOwnPropertyDescriptor(window, 'localStorage')
beforeAll(() => {
  const store = new Map()
  Object.defineProperty(window, 'localStorage', {
    configurable: true, writable: true,
    value: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
      get length() { return store.size },
      key: (i) => Array.from(store.keys())[i] ?? null,
    },
  })
})
afterAll(() => { if (original) Object.defineProperty(window, 'localStorage', original) })

describe('cache — file d\'attente offline', () => {
  beforeEach(() => localStorage.clear())

  it('empile puis vide la file offline', () => {
    expect(getOfflineQueue()).toEqual([])
    addToOfflineQueue({ method: 'POST', url: '/api/x/', data: { a: 1 } })
    addToOfflineQueue({ method: 'PATCH', url: '/api/y/', data: { b: 2 } })
    const q = getOfflineQueue()
    expect(q).toHaveLength(2)
    expect(q[0].method).toBe('POST')
    clearOfflineQueue()
    expect(getOfflineQueue()).toEqual([])
  })

  it('localStorage corrompu => file vide plutôt qu\'une exception', () => {
    localStorage.setItem('rzi_offline_queue', '{pas du json')
    expect(getOfflineQueue()).toEqual([])
  })

  it('flushOfflineQueue rejoue chaque mutation selon sa méthode puis vide la file', async () => {
    addToOfflineQueue({ method: 'POST', url: '/api/x/', data: { a: 1 } })
    addToOfflineQueue({ method: 'DELETE', url: '/api/y/' })
    const api = { post: vi.fn().mockResolvedValue({}), patch: vi.fn(), delete: vi.fn().mockResolvedValue({}) }
    const n = await flushOfflineQueue(api)
    expect(n).toBe(2)
    expect(api.post).toHaveBeenCalledWith('/api/x/', { a: 1 })
    expect(api.delete).toHaveBeenCalledWith('/api/y/')
    expect(getOfflineQueue()).toEqual([])
  })

  it('flushOfflineQueue continue après l\'échec d\'une mutation et vide quand même la file', async () => {
    addToOfflineQueue({ method: 'POST', url: '/api/echoue/' })
    addToOfflineQueue({ method: 'POST', url: '/api/ok/' })
    const api = { post: vi.fn().mockRejectedValueOnce(new Error('réseau')).mockResolvedValueOnce({}) }
    const n = await flushOfflineQueue(api)
    expect(n).toBe(1)
    expect(getOfflineQueue()).toEqual([])
  })
})

describe('cache — cachedFetch (Network-First)', () => {
  let onLineOrigine
  beforeEach(() => {
    localStorage.clear()
    onLineOrigine = Object.getOwnPropertyDescriptor(window.navigator, 'onLine')
  })
  afterEach(() => {
    if (onLineOrigine) Object.defineProperty(window.navigator, 'onLine', onLineOrigine)
  })
  const forcerEnLigne = (val) => Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: val })

  it('réseau disponible : renvoie les données serveur et les met en cache localStorage', async () => {
    forcerEnLigne(true)
    const apiFn = vi.fn().mockResolvedValue({ data: { x: 1 } })
    const d = await cachedFetch(apiFn, 'cle-test')
    expect(d).toEqual({ x: 1 })
    expect(apiFn).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('rzi_api_cache_cle-test')).toBeTruthy()
  })

  it('hors ligne avec un cache existant : renvoie le cache sans appeler le réseau', async () => {
    forcerEnLigne(true)
    await cachedFetch(vi.fn().mockResolvedValue({ data: { x: 'avant' } }), 'cle-offline')
    forcerEnLigne(false)
    const apiFn = vi.fn()
    const d = await cachedFetch(apiFn, 'cle-offline')
    expect(d).toEqual({ x: 'avant' })
    expect(apiFn).not.toHaveBeenCalled()
  })

  it('hors ligne sans aucun cache : lève une erreur explicite plutôt qu\'un résultat silencieusement vide', async () => {
    forcerEnLigne(false)
    await expect(cachedFetch(vi.fn(), 'cle-jamais-vue')).rejects.toThrow(/Hors réseau/)
  })

  it('erreur réseau (ni timeout) : l\'erreur remonte, pas de repli silencieux sur un vieux cache', async () => {
    forcerEnLigne(true)
    const erreur = new Error('500 serveur')
    await expect(cachedFetch(vi.fn().mockRejectedValue(erreur), 'cle-500')).rejects.toBe(erreur)
  })

  it('cache localStorage expiré (ttl dépassé) : traité comme absent', async () => {
    // Écrit directement dans localStorage (même format que storageSet) sans passer par cachedFetch,
    // pour ne pas peupler aussi le cache mémoire module-level — qui masquerait l'expiration testée ici.
    localStorage.setItem('rzi_api_cache_cle-expire-seule', JSON.stringify({ data: { x: 1 }, ts: Date.now() - 1000, ttl: 10 }))
    forcerEnLigne(false)
    await expect(cachedFetch(vi.fn(), 'cle-expire-seule', 10)).rejects.toThrow(/Hors réseau/)
  })
})
