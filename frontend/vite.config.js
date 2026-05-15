import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'ui': ['html5-qrcode'],
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': { target: process.env.VITE_API_URL || 'http://localhost:8000', changeOrigin: true },
      '/ws': { target: process.env.VITE_API_URL || 'http://localhost:8000', changeOrigin: true, ws: true },
    }
  }
})
