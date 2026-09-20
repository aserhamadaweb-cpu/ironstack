'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Dumbbell, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { buildAuthEntryHref } from '@/lib/auth-entry'
import { clearIronstackAuthCache } from '@/components/use-is-guest'
import { HOME_PATH } from '@/lib/onboarding-types'

function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return HOME_PATH
  }
  return raw
}

function parseHashTokens(hash: string) {
  if (!hash.includes('access_token=')) return null
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const access_token = params.get('access_token')
  const refresh_token = params.get('refresh_token')
  if (!access_token || !refresh_token) return null
  return { access_token, refresh_token }
}

/**
 * OAuth landing page — must stay a client route so URL hash tokens are not
 * stripped by server redirects (Google on mobile/PWA often uses the hash flow).
 */
function OAuthReturnContent() {
  const t = useTranslations('auth')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  const next = useMemo(
    () => safeNextPath(searchParams.get('next')),
    [searchParams],
  )

  useEffect(() => {
    let cancelled = false

    async function complete() {
      const code = searchParams.get('code')
      if (code) {
        const params = new URLSearchParams(searchParams.toString())
        window.location.replace(`/auth/callback?${params.toString()}`)
        return
      }

      const tokens = parseHashTokens(window.location.hash ?? '')
      if (!tokens) {
        if (!cancelled) {
          const dest = new URL('/auth/error', window.location.origin)
          dest.searchParams.set('reason', 'missing_code')
          router.replace(dest.pathname + dest.search)
        }
        return
      }

      try {
        clearIronstackAuthCache()

        const res = await fetch('/api/auth/oauth-session', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            next,
          }),
        })

        const payload = (await res.json().catch(() => null)) as {
          redirect?: string
          error?: string
        } | null

        if (!res.ok || !payload?.redirect) {
          if (!cancelled) {
            setError(payload?.error ?? t('callbackFailed'))
          }
          return
        }

        window.history.replaceState(null, '', window.location.pathname + window.location.search)
        window.location.replace(payload.redirect)
      } catch {
        if (!cancelled) setError(t('callbackFailed'))
      }
    }

    void complete()
    return () => {
      cancelled = true
    }
  }, [next, router, searchParams, t])

  if (error) {
    return (
      <div className="fade-up rounded-2xl border border-gold/25 bg-card/60 p-6 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-8">
        <div
          role="alert"
          className="mb-6 flex w-full items-start gap-3 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-start text-sm text-gold/80"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
        <Link
          href={buildAuthEntryHref()}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gold px-4 text-sm font-semibold tracking-wide text-black transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
        >
          {t('backToLogin')}
        </Link>
      </div>
    )
  }

  return (
    <div className="fade-up flex flex-col items-center gap-4 rounded-2xl border border-gold/25 bg-card/60 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-md">
      <Loader2 className="size-8 animate-spin text-gold" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{t('callbackWorking')}</p>
    </div>
  )
}

export default function OAuthReturnPage() {
  const t = useTranslations('auth')

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 pt-[calc(env(safe-area-inset-top)+5.5rem)] pb-12 text-foreground">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-radial from-gold/15 via-transparent to-transparent"
        aria-hidden="true"
      />

      <header className="fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)]">
        <nav
          aria-label={t('loginNav')}
          className="glass-card nav-slide-down mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-full border border-silver/20 px-3 py-1.5 sm:px-6 sm:py-3"
        >
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 rounded-full px-1 active:opacity-80"
          >
            <Dumbbell className="size-5 text-gold" aria-hidden="true" />
            <span className="font-heading text-metallic text-lg font-bold tracking-[0.25em]">
              IRONSTACK
            </span>
          </Link>
        </nav>
      </header>

      <div className="relative z-10 w-full max-w-md">
        <div className="fade-up mb-8 flex flex-col items-center gap-3 text-center">
          <p className="text-xs font-semibold tracking-[0.35em] text-gold">
            {t('callbackErrorKicker')}
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('callbackWorkingTitle')}
          </h1>
        </div>
        <Suspense
          fallback={
            <div className="flex justify-center p-8">
              <Loader2 className="size-8 animate-spin text-gold" />
            </div>
          }
        >
          <OAuthReturnContent />
        </Suspense>
      </div>
    </main>
  )
}
