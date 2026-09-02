'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Layers, Play, WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CTA_PRIMARY, CTA_SECONDARY } from '@/lib/accent'
import { useGuestGate } from '@/components/guest-gate-provider'
import { OfflineSessionLaunch } from '@/components/offline-session-launch'
import {
  listCachedUserSplits,
  type CachedUserSplit,
} from '@/lib/offline/cached-user-splits'

type OfflineStartSessionFlowProps = {
  displayName: string
  initials: string
  /** When set, picker selection navigates here instead of inline launch. */
  navigateOnSelect?: boolean
  className?: string
}

type Phase = 'idle' | 'picking' | 'launching'

export function OfflineStartSessionFlow({
  displayName,
  initials,
  navigateOnSelect = false,
  className = '',
}: OfflineStartSessionFlowProps) {
  const t = useTranslations('offline')
  const router = useRouter()
  const { requireAccount } = useGuestGate()
  const [phase, setPhase] = useState<Phase>('idle')
  const [splits, setSplits] = useState<CachedUserSplit[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [showEmptyPrompt, setShowEmptyPrompt] = useState(false)

  useEffect(() => {
    let cancelled = false
    void listCachedUserSplits()
      .then((rows) => {
        if (cancelled) return
        setSplits(rows)
      })
      .catch(() => {
        if (!cancelled) setSplits([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const openPicker = () => {
    requireAccount('startSession', () => {
    setShowEmptyPrompt(false)
    if (loading) return
    if (splits.length === 0) {
      setShowEmptyPrompt(true)
      return
    }
    setPhase('picking')
    })
  }

  const selectSplit = (slug: string) => {
    requireAccount('startSession', () => {
    if (navigateOnSelect) {
      router.push(`/dashboard/splits/${slug}/session`)
      return
    }
    setSelectedSlug(slug)
    setPhase('launching')
    })
  }

  if (phase === 'launching' && selectedSlug) {
    return (
      <OfflineSessionLaunch
        slug={selectedSlug}
        displayName={displayName}
        initials={initials}
      />
    )
  }

  if (phase === 'picking') {
    return (
      <div className={className}>
        <p className="section-kicker">{t('pickSplitKicker')}</p>
        <h2 className="font-heading mt-1 text-xl font-bold text-headline">
          {t('pickSplitTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('pickSplitBody')}</p>
        <ul className="mt-4 space-y-2">
          {splits.map((split) => (
            <li key={split.id}>
              <button
                type="button"
                onClick={() => selectSplit(split.slug)}
                className="is-panel flex w-full items-center gap-4 p-4 text-start transition-colors active:border-gold/40"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
                  <Layers className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-headline">
                    {split.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('floorDays', { count: split.days })}
                  </span>
                </span>
                <Play className="size-4 shrink-0 text-gold" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => setPhase('idle')}
          className={`${CTA_SECONDARY} mt-6 inline-flex min-h-11 items-center px-5`}
        >
          {t('pickSplitBack')}
        </button>
      </div>
    )
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={openPicker}
        disabled={loading}
        className={`${CTA_PRIMARY} inline-flex min-h-12 items-center justify-center gap-2 px-6 disabled:opacity-60`}
      >
        <Play className="size-4" aria-hidden="true" />
        {loading ? t('pickSplitLoading') : t('floorStart')}
      </button>

      {showEmptyPrompt ? (
        <div
          role="status"
          className="mt-4 rounded-2xl border border-dashed border-silver/25 bg-card/40 px-5 py-6 text-sm text-muted-foreground"
        >
          <p className="inline-flex items-center gap-2 font-semibold text-headline">
            <WifiOff className="size-4 shrink-0 text-gold" aria-hidden="true" />
            {t('noSavedSplitsTitle')}
          </p>
          <p className="mt-2 leading-relaxed">{t('noSavedSplitsBody')}</p>
        </div>
      ) : null}

      {!loading && splits.length > 0 ? (
        <section className="mt-8">
          <p className="section-kicker">{t('cachedSplits')}</p>
          <h2 className="font-heading mt-1 text-xl font-bold text-headline">
            {t('savedSplitsOnDevice')}
          </h2>
          <ul className="mt-4 space-y-2">
            {splits.map((split) => (
              <li key={split.id}>
                <button
                  type="button"
                  onClick={() => selectSplit(split.slug)}
                  className="is-panel flex w-full items-center gap-4 p-4 text-start transition-colors active:border-gold/40"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
                    <Layers className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-headline">
                      {split.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t('floorDays', { count: split.days })}
                    </span>
                  </span>
                  <Play className="size-4 shrink-0 text-gold" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : !loading && splits.length === 0 && !showEmptyPrompt ? (
        <p className="mt-6 rounded-2xl border border-dashed border-silver/25 bg-card/40 px-5 py-8 text-sm text-muted-foreground">
          {t('noSavedSplitsBody')}
        </p>
      ) : null}
    </div>
  )
}
