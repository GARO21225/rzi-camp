import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: './index.html',
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          leaflet: ['leaflet', 'react-leaflet'],
          charts: ['recharts'],
        },
      },
    },
  },
})
