import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo192.png'],
      manifest: {
        name: 'Résidence Roxgold Sango',
        short_name: 'RZI Camp',
        description: 'ERP GIS de Gestion de Camp Minier — Roxgold Sango',
        theme_color: '#1e3a8a',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/logo192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/logo512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        categories: ['business', 'productivity'],
        lang: 'fr',
      },
      workbox: {
        // Stratégie: Cache-First pour assets, Network-First pour API
        runtimeCaching: [
          // API: Network-First, fallback cache 5 min
          {
            urlPattern: /\/api\/(batiments|personnel|evenements|voyages|boutique|maintenance)\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'rzi-api-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 5 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // GeoJSON: Cache-First (change rarement)
          {
            urlPattern: /\/api\/batiments\/geojson\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'rzi-geojson-cache',
              expiration: { maxEntries: 5, maxAgeSeconds: 30 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Images produits: Cache-First 7 jours
          {
            urlPattern: /\.(png|jpg|jpeg|gif|webp|svg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'rzi-images-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Tiles carte OSM: Cache-First
          {
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'rzi-osm-tiles',
              expiration: { maxEntries: 2000, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Unsplash/Wikipedia images boutique
          {
            urlPattern: /^https:\/\/(images\.unsplash\.com|upload\.wikimedia\.org)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'rzi-product-images',
              expiration: { maxEntries: 100, maxAgeSeconds: 14 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Précacher l'app shell
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
      },
    }),
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react','react-dom'],
          leaflet: ['leaflet','react-leaflet'],
          charts: ['recharts'],
        },
      },
    },
  },
})
