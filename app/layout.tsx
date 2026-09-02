import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { DM_Sans, Noto_Sans_Arabic, Oswald } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import { NavTransitionOverlay } from '@/components/nav-transition-overlay'
import { ThemeProvider } from '@/components/theme-provider'
import { localeDir, type AppLocale } from '@/lib/i18n'
import { getServerAppearanceMode, getServerThemePreference } from '@/lib/theme-server'
import './globals.css'

const oswald = Oswald({
  subsets: ['latin'],
  variable: '--font-oswald',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const notoArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-noto-arabic',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

export const metadata: Metadata = {
  title: 'IronStack — Train Smarter, Feel Stronger',
  description:
    'Track workouts, challenges, messages, and progress. Install IronStack as a home-screen app — no store required.',
  applicationName: 'IronStack',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IronStack',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0E0E10' },
    { media: '(prefers-color-scheme: light)', color: '#F7F6F3' },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [serverTheme, serverAppearance, locale, messages] = await Promise.all([
    getServerThemePreference(),
    getServerAppearanceMode(),
    getLocale(),
    getMessages(),
  ])
  const appLocale = (locale === 'ar' ? 'ar' : 'en') as AppLocale
  const dir = localeDir(appLocale)

  return (
    <html
      lang={appLocale}
      dir={dir}
      suppressHydrationWarning
      className={`${oswald.variable} ${dmSans.variable} ${notoArabic.variable} bg-background dark`}
      data-theme="dark"
      data-locale={appLocale}
    >
      <body
        className={`antialiased ${
          appLocale === 'ar' ? 'font-arabic' : 'font-sans'
        }`}
      >
        <NextIntlClientProvider locale={appLocale} messages={messages}>
          <ThemeProvider
            initialTheme={serverTheme}
            initialAppearance={serverAppearance}
          >
            <NavTransitionOverlay />
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
