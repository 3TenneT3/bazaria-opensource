import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const dirname = path.dirname(fileURLToPath(import.meta.url))
// Única fuente de la versión: package.json (se muestra en el banner y en el pie).
const { version } = JSON.parse(readFileSync(path.resolve(dirname, './package.json'), 'utf-8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        runtimeCaching: [
          {
            // Fotos de prendas (api.example.com/fotos/...): el nombre es el hash del contenido,
            // así que nunca cambian. El enlace lleva una firma con caducidad (?e=&s=) que cambia
            // a diario: la caché la ignora para no volver a bajar la misma foto.
            urlPattern: ({ url }) => url.pathname.startsWith('/fotos/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'bazaria-fotos',
              expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [200] },
              matchOptions: { ignoreSearch: true },
            },
          },
        ],
      },
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Bazaria',
        short_name: 'Bazaria',
        description: 'Sabe cuánto ganas de verdad con cada prenda que vendes.',
        theme_color: '#fdfbf6',
        background_color: '#fdfbf6',
        display: 'standalone',
        start_url: '/app',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
