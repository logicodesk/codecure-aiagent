import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Dev server: proxy API calls to FastAPI running on 8000
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/predict':        'http://127.0.0.1:8000',
      '/models':         'http://127.0.0.1:8000',
      '/examples':       'http://127.0.0.1:8000',
      '/health':         'http://127.0.0.1:8000',
      '/analyze':        'http://127.0.0.1:8000',
      '/qa':             'http://127.0.0.1:8000',
      '/counterfactual': 'http://127.0.0.1:8000',
    },
  },
  build: {
    outDir: 'dist',
    // Suppress the chunk size warning (expected with Recharts + Framer Motion)
    chunkSizeWarningLimit: 800,
  },
})
