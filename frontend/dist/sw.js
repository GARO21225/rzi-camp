const CACHE_NAME = 'rzi-camp-v1'
const OFFLINE_URLS = ['/', '/carte', '/residences', '/evenements']

self.addEventListener('install', evt => {
  self.skipWaiting()
})

self.addEventListener('activate', evt => {
  evt.waitUntil(clients.claim())
})

self.addEventListener('fetch', evt => {
  if (evt.request.method !== 'GET') return
  if (evt.request.url.includes('/api/')) return
  evt.respondWith(
    fetch(evt.request).catch(() => caches.match('/'))
  )
})

self.addEventListener('push', evt => {
  if (!evt.data) return
  const data = evt.data.json()
  evt.waitUntil(
    self.registration.showNotification(data.title || 'Roxgold Sango', {
      body: data.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
    })
  )
})
