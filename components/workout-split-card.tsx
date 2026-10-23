'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  CalendarDays,
  Clock3,
  Download,
  Dumbbell,
  Loader2,
  Play,
  Share2,
  Star,
  Trash2,
} from 'lucide-react'
import { LtrIsolate, isLatinFragment } from '@/components/ltr-isolate'
import { ACCENT, toneForFocus } from '@/lib/accent'

export type WorkoutSplitCardData = {
  id: string
  slug: string
  name: string
  days: number
  focus: string
  description?: string | null
  isShared?: boolean
  /** Formatted saved date (updated_at, fallback created_at). */
  savedDate?: string | null
}

type WorkoutSplitCardProps = {
  split: WorkoutSplitCardData
  primarySplitId?: string | null
  isShared?: boolean
  /** Train tab — start + view only. */
  compact?: boolean
  savedForOffline?: boolean
  /** Pin exists but integrity check failed — offer retry instead of "saved". */
  offlineIncomplete?: boolean
  savingOffline?: boolean
  /** 0–100 while downloading; null when idle. */
  offlineProgress?: number | null
  onToggleOffline?: (id: string, next: boolean) => void
  onStart: (slug: string) => void
  onDelete?: (id: string, name: string) => void
  onOpenShare?: (split: WorkoutSplitCardData) => void
  onSetPrimary?: (id: string) => void
  deleting?: boolean
  settingPrimary?: boolean
  pending?: boolean
}

/** Gold fill — avoids CTA_PRIMARY (near-white) blending into card on dark theme. */
const START_CTA =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-sm font-bold tracking-[0.18em] text-black transition-all duration-200 hover:scale-[1.02] hover:bg-gold/90 active:scale-[0.98]'

export function WorkoutSplitCard({
  split,
  primarySplitId = null,
  isShared = false,
  compact = false,
  savedForOffline = false,
  offlineIncomplete = false,
  savingOffline = false,
  offlineProgress = null,
  onToggleOffline,
  onStart,
  onDelete,
  onOpenShare,
  onSetPrimary,
  deleting = false,
  settingPrimary = false,
  pending = false,
}: WorkoutSplitCardProps) {
  const t = useTranslations('workout')
  const tShare = useTranslations('splitShare')
  const tone = ACCENT[toneForFocus(split.focus)]
  const isPrimary =
    Boolean(primarySplitId) &&
    (split.id === primarySplitId || split.slug === primarySplitId)

  return (
    <article
      className={`workout-split-card group relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-200 hover:border-gold/30 sm:p-6 ${tone.edge} ${
        isPrimary ? 'border-gold/45 ring-1 ring-gold/20' : 'border-border'
      }`}
    >
      <div className="mb-4 flex min-w-0 items-start justify-between gap-3">
        <div
          className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone.chip}`}
        >
          <Dumbbell className="size-5" aria-hidden="true" />
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
          {isPrimary ? (
            <span className="inline-flex max-w-full items-center rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-gold">
              {t('activeProgramBadge')}
            </span>
          ) : null}
          {offlineIncomplete ? (
            <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-destructive">
              <Download className="size-3 shrink-0" aria-hidden="true" />
              {t('offlineIncompleteBadge')}
            </span>
          ) : savedForOffline ? (
            <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-gold/35 bg-gold/10 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-gold">
              <Download className="size-3 shrink-0" aria-hidden="true" />
              {t('offlineSavedBadge')}
            </span>
          ) : null}
          {isShared ? (
            <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-blue/35 bg-blue-tint/40 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-blue">
              <Share2 className="size-3 shrink-0" aria-hidden="true" />
              {t('sharedBadge')}
            </span>
          ) : null}
          <span
            className={`max-w-full truncate rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em] ${tone.badge}`}
          >
            {isLatinFragment(split.focus)
              ? split.focus.toUpperCase()
              : split.focus}
          </span>
          {!compact && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(split.id, split.name)}
              disabled={deleting || pending}
              aria-label={t('deleteAria', { name: split.name })}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-silver/15 bg-background/50 text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      <h3 className="workout-split-copy font-heading text-xl font-bold text-foreground">
        {split.name}
      </h3>
      {split.description ? (
        <p className="workout-split-copy mt-1.5 line-clamp-3 text-sm text-muted-foreground">
          {split.description}
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className={`size-3.5 shrink-0 ${tone.text}`} aria-hidden="true" />
          {t('daysPerWeek', { count: split.days })}
        </span>
        {split.savedDate ? (
          <span className="inline-flex min-w-0 items-center gap-1.5">
            <Clock3 className={`size-3.5 shrink-0 ${tone.text}`} aria-hidden="true" />
            <LtrIsolate when={isLatinFragment(split.savedDate)} className="truncate">
              {split.savedDate}
            </LtrIsolate>
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-5">
        {compact ? null : (
          <button
            type="button"
            onClick={() => onStart(split.slug)}
            className={START_CTA}
          >
            <Play className="size-4 fill-current" aria-hidden="true" />
            {t('startSession')}
          </button>
        )}
        <Link
          href={`/dashboard/splits/${split.slug}`}
          prefetch={false}
          className={
            compact
              ? 'inline-flex min-h-11 w-full items-center justify-center text-sm font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline'
              : 'inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground'
          }
        >
          {t('viewSplit')}
        </Link>
        {onToggleOffline ? (
          <button
            type="button"
            data-tour="workout-offline-toggle"
            onClick={() =>
              onToggleOffline(
                split.id,
                offlineIncomplete ? true : !savedForOffline,
              )
            }
            disabled={savingOffline || pending}
            aria-pressed={savedForOffline && !offlineIncomplete}
            aria-busy={savingOffline}
            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border text-xs font-semibold tracking-[0.12em] transition disabled:opacity-60 ${
              offlineIncomplete
                ? 'border-destructive/40 bg-destructive/10 text-destructive hover:border-destructive/55'
                : savedForOffline
                  ? 'border-gold/40 bg-gold/10 text-gold hover:border-gold/55'
                  : 'border-silver/15 text-muted-foreground hover:border-gold/35 hover:text-gold'
            }`}
          >
            {savingOffline ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-3.5" aria-hidden="true" />
            )}
            {savingOffline
              ? offlineProgress != null
                ? t('offlineDownloading', { percent: offlineProgress })
                : t('offlineDownloadingSimple')
              : offlineIncomplete
                ? t('offlineRetryToggle')
                : savedForOffline
                  ? t('offlineSavedToggle')
                  : t('saveForOffline')}
          </button>
        ) : null}
        {!compact && !isPrimary && onSetPrimary ? (
          <button
            type="button"
            onClick={() => onSetPrimary(split.id)}
            disabled={settingPrimary || pending}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-gold/30 text-xs font-semibold tracking-[0.12em] text-gold transition hover:bg-gold/10 disabled:opacity-50"
          >
            {settingPrimary ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Star className="size-3.5" aria-hidden="true" />
            )}
            {t('setAsPrimary')}
          </button>
        ) : null}
        {!compact && onOpenShare ? (
          <button
            type="button"
            onClick={() => onOpenShare(split)}
            disabled={pending}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-gold/30 bg-gold/10 text-xs font-semibold tracking-[0.12em] text-gold transition hover:border-gold/50 disabled:opacity-60"
          >
            <Share2 className="size-3.5" aria-hidden="true" />
            {tShare('shareSplit')}
          </button>
        ) : null}
      </div>
    </article>
  )
}
