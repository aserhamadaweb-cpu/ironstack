import Link from 'next/link'
import { AlertCircle, Dumbbell } from 'lucide-react'
import { getTranslations } from 'next-intl/server'
import { buildAuthEntryHref } from '@/lib/auth-entry'

type Props = {
  searchParams: Promise<{ reason?: string; detail?: string }>
}

export default async function AuthErrorPage({ searchParams }: Props) {
  const t = await getTranslations('auth')
  const params = await searchParams
  const reason = params.reason ?? 'callback_failed'

  const message =
    reason === 'expired'
      ? t('callbackExpired')
      : reason === 'missing_code'
        ? t('callbackMissingCode')
        : t('callbackFailed')

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
          <Link
            href={buildAuthEntryHref()}
            className="inline-flex min-h-11 items-center rounded-full border border-gold/40 px-4 text-xs font-semibold tracking-[0.15em] text-gold transition-all duration-200 active:scale-95 active:bg-gold/10"
          >
            {t('backToLogin')}
          </Link>
        </nav>
      </header>

      <div className="relative z-10 w-full max-w-md">
        <div className="fade-up mb-8 flex flex-col items-center gap-3 text-center">
          <p className="text-xs font-semibold tracking-[0.35em] text-gold">
            {t('callbackErrorKicker')}
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('callbackErrorTitle')}
          </h1>
        </div>

        <div className="fade-up rounded-2xl border border-gold/25 bg-card/60 p-6 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-8">
          <div
            role="alert"
            className="mb-6 flex w-full items-start gap-3 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-start text-sm text-gold/80"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="space-y-2">
              <p>{message}</p>
              {params.detail ? (
                <p className="text-xs opacity-80">{params.detail}</p>
              ) : null}
            </div>
          </div>

          <Link
            href={buildAuthEntryHref()}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gold px-4 text-sm font-semibold tracking-wide text-black transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          >
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    </main>
  )
}
