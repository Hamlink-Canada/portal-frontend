import { fileURLToPath, URL } from 'node:url'

import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig(() => ({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        portal: fileURLToPath(new URL('./index.html', import.meta.url)),
        silentRenew: fileURLToPath(new URL('./silent-renew.html', import.meta.url)),
      },
    },
  },
}))
