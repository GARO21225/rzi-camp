import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'map': ['leaflet', 'react-leaflet'],
          'charts': ['recharts'],
          'utils': ['axios', 'zustand'],
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
  },
})
