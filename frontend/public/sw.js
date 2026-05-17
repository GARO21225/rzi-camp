// RZI CAMP — Service Worker v3 — Offline + Background Sync
const CACHE = 'rzi-v3'
const STATIC = ['/', '/index.html', '/manifest.json', '/roxgold-logo.png']

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(STATIC).catch(() => {}))
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

  // Mutations API → intercepter pour offline queue
  if (e.request.method !== 'GET' && url.pathname.startsWith('/api/')) {
    e.respondWith(mutateFetch(e.request))
    return
  }

  // API GET → Network first + cache fallback
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
          return res
        })
        .catch(() => caches.match(e.request).then(cached =>
          cached || new Response(
            JSON.stringify({ offline: true, message: 'Données en cache (hors-ligne)' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          )
        ))
    )
    return
  }

  // Tout le reste → Network avec fallback index.html
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request).then(c => c || caches.match('/index.html'))
    )
  )
})

// ── Queue offline des mutations ──────────────────────────────────
async function mutateFetch(req) {
  try {
    return await fetch(req.clone())
  } catch {
    const body = await req.text().catch(() => '')
    const entry = {
      id: Date.now() + Math.random(),
      url: req.url,
      method: req.method,
      headers: Object.fromEntries(req.headers.entries()),
      body,
      at: new Date().toISOString()
    }
    const q = await getQueue()
    q.push(entry)
    await saveQueue(q)
    const clients = await self.clients.matchAll()
    clients.forEach(c => c.postMessage({ type: 'QUEUED', count: q.length }))
    return new Response(
      JSON.stringify({ queued: true, message: 'Sauvegardé localement. Sera synchronisé dès que le réseau revient.' }),
      { status: 202, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

async function getQueue() {
  const c = await caches.open('rzi-queue')
  const r = await c.match('q')
  return r ? r.json() : []
}

async function saveQueue(q) {
  const c = await caches.open('rzi-queue')
  await c.put('q', new Response(JSON.stringify(q), { headers: { 'Content-Type': 'application/json' } }))
}

// ── Sync quand le réseau revient ─────────────────────────────────
self.addEventListener('sync', e => {
  if (e.tag === 'rzi-sync') e.waitUntil(syncAll())
})

self.addEventListener('message', e => {
  if (e.data?.type === 'SYNC_NOW') syncAll()
})

async function syncAll() {
  const q = await getQueue()
  if (!q.length) return
  const done = [], fail = []
  for (const entry of q) {
    try {
      const res = await fetch(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body || undefined
      })
      if (res.ok || res.status < 500) done.push(entry.id)
      else fail.push(entry)
    } catch { fail.push(entry) }
  }
  await saveQueue(fail)
  const clients = await self.clients.matchAll()
  clients.forEach(c => c.postMessage({ type: 'SYNCED', done: done.length, fail: fail.length }))
}
