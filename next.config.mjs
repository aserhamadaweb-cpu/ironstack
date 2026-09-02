import createNextIntlPlugin from 'next-intl/plugin'
import withPWAInit from '@ducanh2912/next-pwa'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  fallbacks: {
    document: '/offline',
  },
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching: [
      {
        urlPattern: /\/api\/exercises\/[^/]+$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'exercise-details',
          expiration: { maxEntries: 256, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /\/offline\/exercises\.json$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'exercise-catalog',
          expiration: { maxEntries: 2, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /\/exercises\/images\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'exercise-thumbs',
          expiration: { maxEntries: 1400, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      {
        urlPattern: /\/exercises\/gifs\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'exercise-gifs',
          expiration: { maxEntries: 256, maxAgeSeconds: 60 * 60 * 24 * 14 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
      // Document navigations are handled in worker/index.js (network-only, no stale HTML cache).
      {
        urlPattern: /\/_next\/static\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'next-static',
          expiration: { maxEntries: 128, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        urlPattern: /\.(?:js|css)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'static-scripts',
          expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 7 },
        },
      },
      {
        urlPattern: /\.(?:woff2?|ttf|otf|eot)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'fonts',
          expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
      {
        urlPattern: /\/icons\/.*\.(?:png|svg|webp|ico)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'icons',
          expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 365 },
        },
      },
      {
        urlPattern: /\.(?:png|jpg|jpeg|gif|webp|svg|ico)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'images',
          expiration: { maxEntries: 128, maxAgeSeconds: 60 * 60 * 24 * 30 },
        },
      },
      {
        urlPattern:
          /^https:\/\/raw\.githubusercontent\.com\/yuhonas\/free-exercise-db\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'exercise-images',
          expiration: { maxEntries: 256, maxAgeSeconds: 60 * 60 * 24 * 30 },
          cacheableResponse: { statuses: [0, 200] },
        },
      },
    ],
  },
  customWorkerSrc: 'worker',
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: false,
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence Next 16 Turbopack warning when next-pwa injects a webpack plugin.
  turbopack: {},
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/yuhonas/free-exercise-db/**',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'jasxefogqpqkpzgjcxht.supabase.co',
      },
    ],
  },
}

export default withNextIntl(withPWA(nextConfig))
