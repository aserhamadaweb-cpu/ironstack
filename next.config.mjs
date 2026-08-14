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
    // Prefer fresh HTML for navigations so `/` always runs StandaloneRedirect.
    runtimeCaching: [
      {
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages',
          networkTimeoutSeconds: 3,
        },
      },
    ],
  },
  customWorkerSrc: 'worker',
  cacheOnFrontEndNav: false,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence Next 16 Turbopack warning when next-pwa injects a webpack plugin.
  turbopack: {},
  typescript: {
    ignoreBuildErrors: true,
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
