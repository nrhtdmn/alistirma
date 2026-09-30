import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages: repo adı farklıysa VITE_BASE=/repo-adi/ ile değiştirin
const base = process.env.VITE_BASE || '/alistirma/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Alıştırma',
        short_name: 'Alıştırma',
        description:
          '1. sınıftan doktoraya alıştırma, test ve sınav oluşturma — yerel, paylaşılabilir PWA',
        theme_color: '#0B4F54',
        background_color: '#E8F0EE',
        display: 'standalone',
        lang: 'tr',
        start_url: '.',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: 'index.html',
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
})
