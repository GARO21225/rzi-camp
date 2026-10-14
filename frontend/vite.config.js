import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Identifiant de build affiché dans le menu : permet de vérifier d'un coup d'œil quelle version tourne.
  define: { __BUILD_ID__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC') },
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'charts': ['recharts'],
          'map': ['leaflet', 'react-leaflet'],
          'utils': ['axios', 'zustand'],
        },
      },
    },
  },
  server: { port: 5173 },
})
