import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true, // Nettoie dist/ avant chaque build
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React et router → chunk stable
          if (id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react-router')) {
            return 'react-vendor'
          }
          // Leaflet (carte GIS)
          if (id.includes('node_modules/leaflet') ||
              id.includes('node_modules/react-leaflet')) {
            return 'map'
          }
          // Recharts (graphiques)
          if (id.includes('node_modules/recharts') ||
              id.includes('node_modules/d3')) {
            return 'charts'
          }
          // Axios + Zustand
          if (id.includes('node_modules/axios') ||
              id.includes('node_modules/zustand')) {
            return 'utils'
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    proxy: {},
  },
})
