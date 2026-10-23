'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, Layers, Play, WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CTA_PRIMARY } from '@/lib/accent'
import { useGuestGate } from '@/components/guest-gate-provider'
import { OfflineSessionLaunch } from '@/components/offline-session-launch'
import {
  listStartableOfflineSplits,
  subscribeOfflineCacheChanged,
  type CachedUserSplit,
} from '@/lib/offline/cached-user-splits'
import type { WeightUnit } from '@/lib/units'

type OfflineStartSessionFlowProps = {
  displayName: string
  initials: string
  avatarUrl?: string | null
  profileHref?: string
  isGuest?: boolean
  weightUnit?: WeightUnit
  className?: string
  /** Lift launch to the floor (full-screen) so Resume banner chrome is not shown. */
  onLaunch?: (slug: string) => void
}

type Phase = 'idle' | 'picking' | 'launching'

function brokenMessage(
  t: (key: string) => string,
  split: CachedUserSplit,
): string {
  switch (split.issue) {
    case 'missing-snapshot':
      return t('offlineSplitBrokenMissing')
    case 'empty-program':
      return t('offlineSplitBrokenEmpty')
    case 'incomplete-media':
      return t('offlineSplitBrokenMedia')
    default:
      return t('offlineSplitBroken')
  }
}

function SplitRow({
  split,
  onSelect,
  t,
}: {
  split: CachedUserSplit
  onSelect: (slug: string) => void
  t: (key: string, values?: Record<string, number>) => string
}) {
  const broken = !split.ready
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          if (broken) return
          onSelect(split.slug)
        }}
        disabled={broken}
        className={`is-panel flex w-full items-center gap-4 p-4 text-start transition-colors ${
          broken
            ? 'cursor-not-allowed opacity-90'
            : 'active:border-gold/40'
        }`}
      >
        <span
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${
            broken
              ? 'border-destructive/35 bg-destructive/10 text-destructive'
              : 'border-gold/30 bg-gold/10 text-gold'
          }`}
        >
          {broken ? (
            <AlertTriangle className="size-5" aria-hidden="true" />
          ) : (
            <Layers className="size-5" aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-headline">
            {split.name}
          </span>
          {broken ? (
            <span className="mt-0.5 block text-xs text-destructive">
              {brokenMessage(t, split)}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t('floorDays', { count: split.days })}
            </span>
          )}
        </span>
        {!broken ? (
          <Play className="size-4 shrink-0 text-gold" aria-hidden="true" />
        ) : null}
      </button>
    </li>
  )
}

export function OfflineStartSessionFlow({
  displayName,
  initials,
  avatarUrl,
  profileHref,
  isGuest = false,
  weightUnit = 'kg',
  className = '',
  onLaunch,
}: OfflineStartSessionFlowProps) {
  const t = useTranslations('offline')
  const { requireAccount } = useGuestGate()
  const [phase, setPhase] = useState<Phase>('idle')
  const [splits, setSplits] = useState<CachedUserSplit[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  const [showEmptyPrompt, setShowEmptyPrompt] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = () => {
      void listStartableOfflineSplits()
        .then((rows) => {
          if (cancelled) return
          setSplits(rows)
          if (rows.some((s) => s.ready)) setShowEmptyPrompt(false)
        })
        .catch(() => {
          if (!cancelled) setSplits([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }

    load()
    const unsubscribe = subscribeOfflineCacheChanged(() => {
      if (cancelled) return
      load()
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  const readySplits = splits.filter((s) => s.ready)

  const openPicker = () => {
    requireAccount('startSession', () => {
      setShowEmptyPrompt(false)
      if (loading) return
      // Show the picker whenever any saved pin exists (including incomplete).
      if (splits.length === 0) {
        setShowEmptyPrompt(true)
        return
      }
      setPhase('picking')
    })
  }

  const selectSplit = (slug: string) => {
    requireAccount('startSession', () => {
      if (onLaunch) {
        setPhase('idle')
        setSelectedSlug(null)
        onLaunch(slug)
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
        weightUnit={weightUnit}
        onExit={() => {
          setPhase('idle')
          setSelectedSlug(null)
        }}
        onSwitchSplit={setSelectedSlug}
      />
    )
  }

  // Full-screen page: only splits saved for offline.
  if (phase === 'picking') {
    return (
      <div className="fixed inset-0 z-40 overflow-y-auto bg-background">
        <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
          <div className="absolute inset-0 gold-radial-wash" />
        </div>


        <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
          <button
            type="button"
            onClick={() => setPhase('idle')}
            className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 rtl-flip" aria-hidden="true" />
            {t('pickSplitBack')}
          </button>

          <p className="section-kicker mt-6 inline-flex items-center gap-2">
            <WifiOff className="size-3 text-gold" aria-hidden="true" />
            {t('pickSplitKicker')}
          </p>
          <h1 className="font-heading mt-2 text-3xl font-bold tracking-tight text-headline sm:text-4xl">
            {t('pickSplitTitle')}
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {t('pickSplitBody')}
          </p>

          <ul className="mt-8 space-y-2">
            {splits.map((split) => (
              <SplitRow
                key={split.id}
                split={split}
                onSelect={selectSplit}
                t={t}
              />
            ))}
          </ul>
        </main>
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
          {splits.some((s) => !s.ready) ? (
            <p className="mt-3 text-destructive">{t('offlineSplitBroken')}</p>
          ) : null}
        </div>
      ) : null}

      {!loading && readySplits.length > 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          {t('savedSplitsHint', { count: readySplits.length })}
        </p>
      ) : null}
    </div>
  )
}
