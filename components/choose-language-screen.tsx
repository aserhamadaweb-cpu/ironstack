'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Dumbbell, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { setInitialLocaleAction } from '@/lib/data/locale-actions'
import { applyLocaleToDocument, markLocaleChosen, type AppLocale } from '@/lib/i18n'

type ChooseLanguageScreenProps = {
  /** After pick: stay on page and call this instead of a server redirect. */
  onComplete?: () => void
  /** Post-pick redirect target when not using onComplete. */
  redirectNext?: string | null
}

export function ChooseLanguageScreen({
  onComplete,
  redirectNext = '/login',
}: ChooseLanguageScreenProps) {
  const t = useTranslations('localeGate')
  const router = useRouter()
  const [pendingLocale, setPendingLocale] = useState<AppLocale | null>(null)
  const [isPending, startTransition] = useTransition()

  function choose(locale: AppLocale) {
    if (isPending) return
    setPendingLocale(locale)
    applyLocaleToDocument(locale)
    markLocaleChosen(locale)
    startTransition(async () => {
      if (onComplete) {
        await setInitialLocaleAction(locale, null, { skipRedirect: true })
        onComplete()
        router.refresh()
        return
      }
      await setInitialLocaleAction(locale, redirectNext)
    })
  }

  const options: { value: AppLocale; label: string; hint: string }[] = [
    { value: 'en', label: t('english'), hint: t('englishHint') },
    { value: 'ar', label: t('arabic'), hint: t('arabicHint') },
  ]

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-radial from-gold/15 via-transparent to-transparent"
        aria-hidden="true"
      />

      <header className="fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)]">
        <nav
          aria-label={t('navLabel')}
          className="glass-card nav-slide-down mx-auto mt-3 flex max-w-6xl items-center justify-center rounded-full border border-silver/20 px-6 py-3"
        >
          <div className="flex min-h-11 items-center gap-2 rounded-full px-1">
            <Dumbbell className="size-5 text-gold" aria-hidden="true" />
            <span className="font-heading text-metallic text-lg font-bold tracking-[0.25em]">
              IRONSTACK
            </span>
          </div>
        </nav>
      </header>

      <div className="relative z-10 w-full max-w-md">
        <div className="fade-up mb-8 flex flex-col items-center gap-3 text-center">
          <p className="text-xs font-semibold tracking-[0.35em] text-gold">
            {t('kicker')}
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            {t('title')}
          </h1>
          <p className="font-heading text-2xl font-bold tracking-tight text-muted-foreground sm:text-3xl">
            {t('titleSecondary')}
          </p>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>

        <div className="fade-up rounded-2xl border border-gold/25 bg-card/60 p-5 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-8">
          <div
            className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            role="group"
            aria-label={t('title')}
          >
            {options.map(({ value, label, hint }) => {
              const selected = pendingLocale === value
              const busy = isPending && selected
              return (
                <button
                  key={value}
                  type="button"
                  disabled={isPending}
                  aria-pressed={selected}
                  onClick={() => choose(value)}
                  className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border px-5 py-6 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-70 sm:min-h-32 ${
                    selected
                      ? 'border-gold/45 bg-gold/10 text-gold'
                      : 'border-border/80 bg-background/60 text-foreground hover:border-gold/35 hover:bg-gold/5 active:scale-[0.99]'
                  }`}
                >
                  {busy ? (
                    <Loader2 className="size-6 animate-spin" aria-hidden="true" />
                  ) : (
                    <span className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">
                      {label}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">{hint}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </main>
  )
}
