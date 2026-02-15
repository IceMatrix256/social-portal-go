import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/reddit': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        secure: false,
      },
      '/api/mastodon': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        secure: false,
      },
      '/api/nostr': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        secure: false,
      },
      '/api/lemmy': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        secure: false,
      },
      '/api/custom-feed': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        secure: false,
      },
      '/api/misskey': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        secure: false,
      },
      '/api/misskey-design': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        secure: false,
      },
      '/api/bluesky': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        secure: false,
      },
      '/api/proxy': {
        target: 'http://localhost:8090',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})
