import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Project Pages: https://kupferarne.github.io/BallKnowlAIge/
const base = process.env.VITE_BASE || '/BallKnowlAIge/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'BallKnowlAIge',
        short_name: 'BallKnowlAIge',
        description: 'Create prediction leagues, invite friends, tip scores — with optional AI players.',
        theme_color: '#0f766e',
        background_color: '#0b1220',
        display: 'standalone',
        start_url: base,
        scope: base,
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
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
})
