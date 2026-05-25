// RZI CAMP — Service Worker v4 — Optimisé
// Stratégie: cache ASSETS statiques uniquement, API = network direct
const CACHE = 'rzi-assets-v4'
const ASSETS = ['/index.html', '/roxgold-logo.png', '/manifest.json']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ASSETS.map(a => c.add(a))))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== 'rzi-queue').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Mutations API (POST/PUT/PATCH/DELETE) → offline queue si réseau absent
  if (e.request.method !== 'GET' && url.pathname.startsWith('/api/')) {
    e.respondWith(mutateFetch(e.request))
    return
  }

  // Assets statiques → cache-first
  if (ASSETS.includes(url.pathname) || url.pathname.match(/\.(js|css|png|ico|woff2)$/)) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    )
    return
  }

  // TOUT le reste (API GET + navigation) → network direct, PAS de cache
  // Fallback index.html seulement si vraiment hors-ligne
  e.respondWith(
    fetch(e.request).catch(() =>
      url.pathname.startsWith('/api/')
        ? new Response(JSON.stringify({ offline: true, results: [], count: 0 }), {
            headers: { 'Content-Type': 'application/json' }
          })
        : caches.match('/index.html')
    )
  )
})

// ── Queue offline mutations ──────────────────────────────────────
async function mutateFetch(req) {
  try { return await fetch(req.clone()) }
  catch {
    const body  = await req.text().catch(() => '')
    const entry = { id: Date.now(), url: req.url, method: req.method, headers: Object.fromEntries(req.headers.entries()), body, at: new Date().toISOString() }
    const q = await getQueue(); q.push(entry); await saveQueue(q)
    const cs = await self.clients.matchAll()
    cs.forEach(c => c.postMessage({ type: 'QUEUED', count: q.length }))
    return new Response(JSON.stringify({ queued: true, message: 'Sauvegardé hors-ligne. Sync au retour du réseau.' }), {
      status: 202, headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function getQueue() { const c = await caches.open('rzi-queue'); const r = await c.match('q'); return r ? r.json() : [] }
async function saveQueue(q) { const c = await caches.open('rzi-queue'); await c.put('q', new Response(JSON.stringify(q), { headers: { 'Content-Type': 'application/json' } })) }

// ── Sync ─────────────────────────────────────────────────────────
self.addEventListener('sync', e => { if (e.tag === 'rzi-sync') e.waitUntil(syncAll()) })
self.addEventListener('message', e => { if (e.data?.type === 'SYNC_NOW') syncAll() })

async function syncAll() {
  const q = await getQueue(); if (!q.length) return
  const done = [], fail = []
  for (const entry of q) {
    try {
      const r = await fetch(entry.url, { method: entry.method, headers: entry.headers, body: entry.body || undefined })
      if (r.ok || r.status < 500) done.push(entry.id); else fail.push(entry)
    } catch { fail.push(entry) }
  }
  await saveQueue(fail)
  const cs = await self.clients.matchAll()
  cs.forEach(c => c.postMessage({ type: 'SYNCED', done: done.length, fail: fail.length }))
}

// ── Push notifications ───────────────────────────────────────────
self.addEventListener('push', e => {
  let data = {}
  try { data = e.data.json() } catch { data = { title: e.data?.text() || 'RZI Camp' } }
  e.waitUntil(
    self.registration.showNotification(data.title || '📢 RZI Camp', {
      body: data.body || 'Nouvel événement sur la résidence',
      icon: '/roxgold-logo.png',
      badge: '/roxgold-logo.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/evenements' }
    })
  )
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  const url = e.notification.data?.url || '/evenements'
  e.waitUntil(clients.openWindow(url))
})
