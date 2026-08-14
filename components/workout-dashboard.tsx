'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CalendarDays,
  Clock3,
  Dumbbell,
  Layers,
  Loader2,
  Play,
  Plus,
  Share2,
  Trash2,
  TrendingUp,
  Trophy,
  Weight,
} from 'lucide-react'
import {
  useReducedMotion,
} from 'framer-motion'
import { AiCoachPanel } from '@/components/ai-coach-panel'
import {
  CelebrationBanner,
  type CelebrationBannerItem,
} from '@/components/celebration-banner'
import { DashboardNav } from '@/components/dashboard-nav'
import { LtrIsolate, isLatinFragment } from '@/components/ltr-isolate'
import { ltrEmbed } from '@/lib/bidi'
import { EmptyState } from '@/components/page-states'
import { ACCENT, CTA_PRIMARY, toneForFocus } from '@/lib/accent'
import type { CoachInsightView } from '@/lib/ai/insights'
import { initialsFrom } from '@/lib/dashboard-utils'
import { deleteCustomSplit, setSplitShared } from '@/lib/data/save-split'
import { MAX_CUSTOM_SPLITS } from '@/lib/data/split-limits'
import { formatVolumeKg, type WeightUnit } from '@/lib/units'

type SplitCard = {
  id: string
  slug: string
  name: string
  days: number
  lastUsed: string
  focus: string
  description?: string | null
  isShared?: boolean
}

type WorkoutDashboardProps = {
  displayName: string
  yourSplits: SplitCard[]
  recommendedSplits: SplitCard[]
  lastSession: {
    badge: string
    meta: string
    title: string
    blurb: string
    duration: string
    volume: string
    sets: string
    standouts: string[]
  } | null
  historySessions: Array<{
    id: string
    date: string
    name: string
    duration: string
    volume: string
  }>
  journeyVolume: number
  weightUnit?: WeightUnit
  volumeTrend: {
    bars: number[]
    caption: string
  }
  celebrations?: CelebrationBannerItem[]
  insight: CoachInsightView
  avatarUrl?: string | null
  profileHref?: string
  isGuest?: boolean
}

const JOURNEY_PLACEHOLDER_BARS = [28, 28, 28, 28, 28, 28, 28, 28]

export function WorkoutDashboard({
  displayName,
  yourSplits,
  recommendedSplits,
  lastSession,
  historySessions,
  journeyVolume,
  weightUnit = 'kg',
  volumeTrend,
  celebrations = [],
  insight,
  avatarUrl,
  profileHref,
  isGuest = false,
}: WorkoutDashboardProps) {
  const t = useTranslations('workout')
  const router = useRouter()
  const reduce = useReducedMotion()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [sharingId, setSharingId] = useState<string | null>(null)
  const [sharedMap, setSharedMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(yourSplits.map((s) => [s.id, Boolean(s.isShared)])),
  )
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setSharedMap(
      Object.fromEntries(yourSplits.map((s) => [s.id, Boolean(s.isShared)])),
    )
  }, [yourSplits])

  const firstName = displayName.trim().split(/\s+/)[0] || displayName
  const atSplitLimit = yourSplits.length >= MAX_CUSTOM_SPLITS

  const handleDelete = (splitId: string, splitName: string) => {
    if (deletingId || pending) return
    const confirmed = window.confirm(
      t('deleteConfirm', { name: splitName, max: MAX_CUSTOM_SPLITS }),
    )
    if (!confirmed) return

    setDeleteError(null)
    setDeletingId(splitId)
    startTransition(async () => {
      const result = await deleteCustomSplit(splitId)
      setDeletingId(null)
      if (result.error) {
        setDeleteError(result.error)
        return
      }
      router.refresh()
    })
  }

  const handleShareToggle = (splitId: string) => {
    if (sharingId || pending) return
    const next = !sharedMap[splitId]
    setShareError(null)
    setSharingId(splitId)
    setSharedMap((prev) => ({ ...prev, [splitId]: next }))
    startTransition(async () => {
      const result = await setSplitShared(splitId, next)
      setSharingId(null)
      if (result.error) {
        setSharedMap((prev) => ({ ...prev, [splitId]: !next }))
        setShareError(result.error)
        return
      }
      router.refresh()
    })
  }

  const renderSplitCard = (
    split: SplitCard,
    options?: { deletable?: boolean; shareable?: boolean },
  ) => {
    const tone = ACCENT[toneForFocus(split.focus)]
    const isDeleting = deletingId === split.id
    const isShared = Boolean(sharedMap[split.id] ?? split.isShared)
    const isSharing = sharingId === split.id
    return (
      <article
        key={split.id}
        className={`group relative flex w-[85vw] max-w-sm shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:border-gold/30 md:w-auto md:max-w-none md:hover:-translate-y-0.5 ${tone.edge}`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className={`flex size-11 items-center justify-center rounded-xl ${tone.chip}`}>
            <Dumbbell className="size-5" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2">
            {options?.shareable && isShared && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue/35 bg-blue-tint/40 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-blue">
                <Share2 className="size-3" aria-hidden="true" />
                {t('sharedBadge')}
              </span>
            )}
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em] ${tone.badge}`}>
              {isLatinFragment(split.focus)
                ? split.focus.toUpperCase()
                : split.focus}
            </span>
            {options?.deletable && (
              <button
                type="button"
                onClick={() => handleDelete(split.id, split.name)}
                disabled={isDeleting || pending}
                aria-label={t('deleteAria', { name: split.name })}
                className="flex size-9 items-center justify-center rounded-xl border border-silver/15 bg-background/50 text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <h3 className="font-heading text-xl font-bold text-foreground">
          {split.name}
        </h3>
        {split.description ? (
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
            {split.description}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays
              className={`size-3.5 ${tone.text}`}
              aria-hidden="true"
            />
            {t('daysPerWeek', { count: split.days })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Clock3
              className={`size-3.5 ${tone.text}`}
              aria-hidden="true"
            />
            <LtrIsolate when={isLatinFragment(split.lastUsed)}>
              {split.lastUsed}
            </LtrIsolate>
          </span>
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-6">
          <Link
            href={`/dashboard/splits/${split.slug}/session`}
            className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold tracking-[0.18em] transition-all duration-200 hover:scale-[1.02] ${CTA_PRIMARY}`}
          >
            <Play
              className="size-4 fill-current"
              aria-hidden="true"
            />
            {t('startSession')}
          </Link>
          <Link
            href={`/dashboard/splits/${split.slug}`}
            className="inline-flex min-h-10 w-full items-center justify-center rounded-full border border-silver/15 text-xs font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
          >
            {t('viewSplit')}
          </Link>
          {options?.shareable && (
            <button
              type="button"
              onClick={() => handleShareToggle(split.id)}
              disabled={isSharing || pending}
              className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border text-xs font-semibold tracking-[0.12em] transition disabled:opacity-60 ${
                isShared
                  ? 'border-blue/35 bg-blue-tint/30 text-blue hover:border-blue/50'
                  : 'border-silver/15 text-muted-foreground hover:border-blue/35 hover:text-blue'
              }`}
            >
              {isSharing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Share2 className="size-3.5" aria-hidden="true" />
              )}
              {isShared ? t('sharedUnshare') : t('shareToProfile')}
            </button>
          )}
        </div>
      </article>
    )
  }

  const journeySparkBars =
    volumeTrend.bars.length >= 2 ? volumeTrend.bars : JOURNEY_PLACEHOLDER_BARS

  const journeyTrendCaption =
    journeyVolume === 0
      ? t('journeyStart')
      : volumeTrend.bars.length === 1
        ? t('journeyBaseline')
        : volumeTrend.caption

  return (
    <div className="relative min-h-svh pb-20 md:pb-0">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-x-0 top-0 h-[55svh] [mask-image:linear-gradient(to_bottom,black_10%,transparent)]">
          <Image
            src="/images/hero-gym.png"
            alt=""
            fill
            className="object-cover opacity-[0.14]"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/55 to-background" />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-5%,rgba(198,40,40,0.12),transparent_60%)]" />
        <div className="absolute top-[35%] -end-40 h-96 w-96 rounded-full bg-gold/[0.06] blur-3xl" />
        <div className="absolute bottom-[20%] start-[-6rem] h-80 w-80 rounded-full bg-gold/[0.09] blur-3xl" />
      </div>

      <DashboardNav
        userName={displayName}
        initials={initialsFrom(displayName)}
        avatarUrl={avatarUrl}
        profileHref={profileHref}
        isGuest={isGuest}
      />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 md:py-12">
            {celebrations.length > 0 && (
              <CelebrationBanner items={celebrations} />
            )}

            <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
                  {t('kicker')}
                </p>
                <h1 className="font-heading mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                  {t('ready', { name: firstName })}
                </h1>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  {t('subtitle')}
                </p>
              </div>
            </div>

            {/* Total Volume + Progress — first section */}
            <section className="relative mb-8 overflow-hidden rounded-3xl border border-border bg-card p-5 sm:mb-10 sm:p-8">
              <div
                className="pointer-events-none absolute -top-20 -end-16 h-52 w-52 rounded-full bg-gold/10 blur-3xl"
                aria-hidden="true"
              />
              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
                    {t('yourJourney')}
                  </p>
                  <LtrIsolate
                    as="p"
                    className="font-heading mt-3 text-4xl font-bold tracking-tight text-foreground tabular-nums sm:text-5xl"
                  >
                    {formatVolumeKg(journeyVolume, weightUnit).replace(
                      ` ${weightUnit}`,
                      '',
                    )}{' '}
                    <span className="text-2xl font-semibold text-gold sm:text-3xl">
                      {weightUnit}
                    </span>
                  </LtrIsolate>
                  <p className="mt-2 text-sm font-medium text-muted-foreground">
                    {t('liftedSince')}
                  </p>
                  <div className="mt-5 flex items-start gap-3 rounded-2xl border border-success/30 bg-success-tint p-4">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border chip-green">
                      <TrendingUp className="size-4" aria-hidden="true" />
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {t('loadUp', { pct: ltrEmbed('18%') })}
                    </p>
                  </div>
                </div>

                <div className="w-full shrink-0 rounded-2xl border border-border bg-background p-4 lg:w-64">
                  <p className="mb-3 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
                    {t('trend')}
                  </p>
                  <div
                    className="flex h-24 items-end gap-1.5"
                    aria-hidden="true"
                  >
                    {journeySparkBars.map((height, index) => (
                      <div
                        key={index}
                        className="w-full rounded-t-sm bg-gradient-to-t from-success/20 to-success/85"
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                  <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-success">
                    <TrendingUp className="size-3.5" aria-hidden="true" />
                    <LtrIsolate when={isLatinFragment(journeyTrendCaption)}>
                      {journeyTrendCaption}
                    </LtrIsolate>
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8 sm:mb-10">
              <AiCoachPanel
                insight={insight}
                compact
                startHref={
                  yourSplits[0]
                    ? `/dashboard/splits/${yourSplits[0].slug}/session`
                    : recommendedSplits[0]
                      ? `/dashboard/splits/${recommendedSplits[0].slug}`
                      : '/dashboard/workout'
                }
              />
            </section>

            {/* Your Splits */}
            <section className="mb-10">
              <div className="mb-5">
                <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
                  {t('primary')}
                </p>
                <h2 className="font-heading mt-1 text-2xl font-bold text-foreground md:text-3xl">
                  {t('yourSplits')}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('splitsHint', { max: MAX_CUSTOM_SPLITS })}
                </p>
              </div>

              {deleteError && (
                <p
                  role="alert"
                  className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {deleteError}
                </p>
              )}
              {shareError && (
                <p
                  role="alert"
                  className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {shareError}
                </p>
              )}

              {yourSplits.length === 0 ? (
                <EmptyState
                  icon={Layers}
                  title={t('noSplits')}
                  body={t('noSplitsBody')}
                  actionLabel={t('createSplit')}
                  actionHref="/dashboard/splits/create"
                  tone="gold"
                />
              ) : (
                <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-3">
                  {yourSplits.map((split) =>
                    renderSplitCard(split, { deletable: true, shareable: true }),
                  )}
                </div>
              )}
            </section>

            {/* Last Session Summary */}
            <section className="mb-10">
              <div className="mb-5">
                <p className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground">
                  {t('recap')}
                </p>
                <h2 className="font-heading mt-1 text-2xl font-bold text-foreground">
                  {t('lastSession')}
                </h2>
              </div>

              {lastSession === null ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-silver/20 bg-card/35 px-6 py-14 text-center">
                  <div className="mb-4 flex size-12 items-center justify-center rounded-xl border border-silver/20 bg-silver/5 text-silver">
                    <Trophy className="size-6" aria-hidden="true" />
                  </div>
                  <p className="font-heading text-lg font-semibold text-foreground">
                    {t('noSessionsRecap')}
                  </p>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    {t('noSessionsRecapBody')}
                  </p>
                </div>
              ) : (
                <article className="glass-card rounded-2xl border border-border bg-card p-5 sm:p-7">
                  <div className="flex flex-col gap-6">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <LtrIsolate
                          as="span"
                          when={isLatinFragment(lastSession.badge)}
                          className="rounded-full border badge-amber px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em]"
                        >
                          {lastSession.badge}
                        </LtrIsolate>
                        <LtrIsolate
                          as="span"
                          className="text-xs text-muted-foreground"
                        >
                          {lastSession.meta}
                        </LtrIsolate>
                      </div>
                      <h3 className="font-heading mt-3 text-xl font-bold text-foreground sm:text-2xl">
                        {lastSession.title}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {lastSession.blurb}
                      </p>

                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {[
                          { label: t('duration'), value: lastSession.duration, icon: Clock3 },
                          { label: t('volume'), value: lastSession.volume, icon: Weight },
                          { label: t('sets'), value: lastSession.sets, icon: Layers },
                        ].map((stat) => (
                          <div
                            key={stat.label}
                            className="rounded-xl border border-silver/10 bg-background/50 p-3"
                          >
                            <stat.icon
                              className="mb-2 size-4 text-gold"
                              aria-hidden="true"
                            />
                            <LtrIsolate
                              as="p"
                              when={isLatinFragment(stat.value)}
                              className="font-heading text-lg font-bold tabular-nums text-foreground"
                            >
                              {stat.value}
                            </LtrIsolate>
                            <p className="text-[10px] tracking-[0.15em] text-muted-foreground">
                              {stat.label}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 space-y-2.5">
                        <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
                          {t('standoutLifts')}
                        </p>
                        {lastSession.standouts.length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            {t('noStandouts')}
                          </p>
                        )}
                        {lastSession.standouts.map((lift) => (
                          <div
                            key={lift}
                            className="flex min-h-11 items-center gap-3 rounded-xl border border-silver/10 bg-background/40 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-gold/30 hover:bg-gold/5"
                          >
                            <Dumbbell
                              className="size-4 shrink-0 text-gold"
                              aria-hidden="true"
                            />
                            <LtrIsolate>{lift}</LtrIsolate>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="w-full rounded-xl border border-border bg-background p-4">
                      <p className="mb-3 text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
                        {t('volumeTrend')}
                      </p>
                      <div
                        className="flex h-28 items-end gap-1.5"
                        aria-hidden="true"
                      >
                        {volumeTrend.bars.map((height, index) => (
                          <div
                            key={index}
                            className="w-full rounded-t-sm bg-gradient-to-t from-success/20 to-success/80 transition-all hover:to-success"
                            style={{ height: `${height}%` }}
                          />
                        ))}
                      </div>
                      <LtrIsolate
                        as="p"
                        when={isLatinFragment(volumeTrend.caption)}
                        className="mt-3 text-xs font-semibold text-success"
                      >
                        {volumeTrend.caption}
                      </LtrIsolate>
                    </div>
                  </div>
                </article>
              )}
            </section>

            {/* Workout Sessions — last 3 */}
            <section className="mb-10">
              <div className="mb-5">
                <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
                  {t('historyKicker')}
                </p>
                <h2 className="font-heading mt-1 text-2xl font-bold text-foreground">
                  {t('history')}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('historyHint')}
                </p>
              </div>

              {historySessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-silver/20 bg-card/35 px-6 py-12 text-center">
                  <p className="font-heading text-lg font-semibold text-foreground">
                    {t('noHistory')}
                  </p>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    {t('noHistoryBody')}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {historySessions.map((session) => (
                    <Link
                      key={session.id}
                      href={`/dashboard/sessions/${session.id}`}
                      className="flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-silver/10 bg-card/50 px-4 py-4 text-start transition-all duration-200 hover:-translate-y-0.5 hover:border-gold/30 hover:bg-gold/[0.04] sm:px-5"
                    >
                      <div className="flex min-w-0 items-center gap-4">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
                          <Dumbbell className="size-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-heading text-base font-semibold text-foreground">
                            {session.name}
                          </p>
                          <LtrIsolate as="p" className="mt-0.5 text-xs text-muted-foreground">
                            {session.date}
                          </LtrIsolate>
                        </div>
                      </div>
                      <div className="hidden shrink-0 items-center gap-6 text-right sm:flex">
                        <div>
                          <p className="text-[10px] tracking-[0.15em] text-muted-foreground">
                            {t('duration')}
                          </p>
                          <LtrIsolate
                            as="p"
                            when={isLatinFragment(session.duration)}
                            className="mt-0.5 text-sm font-semibold tabular-nums text-foreground"
                          >
                            {session.duration}
                          </LtrIsolate>
                        </div>
                        <div>
                          <p className="text-[10px] tracking-[0.15em] text-muted-foreground">
                            {t('volume')}
                          </p>
                          <LtrIsolate
                            as="p"
                            className="mt-0.5 text-sm font-semibold tabular-nums text-gold"
                          >
                            {session.volume}
                          </LtrIsolate>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Choose a Split */}
            <section className="mb-10">
              <div className="mb-5">
                <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
                  {t('recommendedForYou')}
                </p>
                <h2 className="font-heading mt-1 text-2xl font-bold text-foreground">
                  {t('chooseSplit')}
                </h2>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                  {t('chooseSplitBody')}
                </p>
              </div>

              {recommendedSplits.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-silver/20 bg-card/35 px-6 py-12 text-center">
                  <p className="font-heading text-lg font-semibold text-foreground">
                    {t('noRecommended')}
                  </p>
                  <p className="mt-2 max-w-md text-sm text-muted-foreground">
                    {t('noRecommendedBody')}
                  </p>
                </div>
              ) : (
                <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 xl:grid-cols-3">
                  {recommendedSplits.map((split) => renderSplitCard(split))}
                </div>
              )}
            </section>

            {/* Create Your Own Split */}
            <section className="mb-6">
              <div className="mb-5">
                <p className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground">
                  {t('custom')}
                </p>
                <h2 className="font-heading mt-1 text-2xl font-bold text-foreground">
                  {t('customTitle')}
                </h2>
              </div>

              {atSplitLimit ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-silver/25 bg-card/30 px-6 py-12 text-center">
                  <span className="flex size-14 items-center justify-center rounded-full border border-silver/25 bg-background/60 text-silver">
                    <Layers className="size-7" aria-hidden="true" />
                  </span>
                  <p className="font-heading mt-4 text-xl font-bold text-foreground">
                    {t('limitReached')}
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    {t('limitBody', { max: MAX_CUSTOM_SPLITS })}
                  </p>
                </div>
              ) : (
                <Link
                  href="/dashboard/splits/create"
                  className="group flex min-h-14 w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-gold/35 bg-card/30 px-6 py-12 text-center transition-all duration-200 active:border-gold/60 active:bg-gold/5 sm:py-14"
                >
                  <span className="flex size-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold transition-transform duration-200 group-hover:scale-110">
                    <Plus className="size-7" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-heading text-xl font-bold text-foreground">
                      {t('createCustom')}
                    </p>
                    <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                      {t('createCustomBody', {
                        used: yourSplits.length,
                        max: MAX_CUSTOM_SPLITS,
                      })}
                    </p>
                  </div>
                </Link>
              )}
            </section>
          </main>
    </div>
  )
}
