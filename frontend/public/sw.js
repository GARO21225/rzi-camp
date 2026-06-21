// RZI Camp — Service Worker minimal et prudent.
//
// Portée volontairement limitée pour ne jamais recréer le bug qui avait conduit
// à l'ajout (puis le retrait incomplet) d'un script de désinstallation dans
// index.html : ce SW ne met en cache QUE les assets statiques immuables
// (JS/CSS buildés par Vite, qui ont un hash dans leur nom de fichier — donc
// jamais de "vieille version qui ne se met pas à jour"). Il ne cache JAMAIS
// les appels /api/, qui doivent toujours aller chercher des données fraîches
// ou échouer franchement (la queue offline applicative dans useOffline.js
// gère déjà la résilience réseau pour les données, ce n'est pas le rôle de
// ce service worker).

const CACHE_NAME = 'rzi-camp-static-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Ne jamais intercepter les appels API — toujours réseau direct.
  if (url.pathname.startsWith('/api/')) return

  // Ne mettre en cache que les assets statiques buildés (JS/CSS hashés par Vite).
  if (event.request.method !== 'GET') return
  if (!/\.(js|css|png|svg|woff2?)$/.test(url.pathname)) return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      }).catch(() => cached)
    })
  )
})

// Permet à App.jsx de déclencher une vérification immédiate au retour réseau
// (voir window.addEventListener('online', ...) dans App.jsx) sans attendre
// un cycle de fetch naturel.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SYNC_NOW') {
    // Pas d'action serveur ici — la synchronisation réelle des données reste
    // gérée par useOffline.js côté application, ce SW ne fait que l'assets cache.
  }
})
