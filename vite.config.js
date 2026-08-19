import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PWA/service-worker support (vite-plugin-pwa) was dropped in the move to
// Vercel: its silent `registerType: 'autoUpdate'` caused a real incident
// where a deployed UI change wasn't visible until a hard refresh. Offline
// reads are still covered by the localStorage cache in src/services/api.js,
// which doesn't depend on a service worker.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:3000',
        storageQuota: 10000000,
      },
    },
  },
})
