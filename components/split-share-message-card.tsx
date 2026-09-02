'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  BookmarkCheck,
  BookmarkPlus,
  CalendarDays,
  Dumbbell,
  Loader2,
  Share2,
} from 'lucide-react'
import { LtrIsolate, isLatinFragment } from '@/components/ltr-isolate'
import { useGuestGate } from '@/components/guest-gate-provider'
import { ACCENT, CTA_PRIMARY, toneForFocus } from '@/lib/accent'
import { saveSharedSplit } from '@/lib/data/save-split'
import type { SplitSharePayload } from '@/lib/split-share-message'
import { splitSharePath } from '@/lib/split-share-url'

type SplitShareMessageCardProps = {
  payload: SplitSharePayload
  mine?: boolean
  currentUserId?: string
}

export function SplitShareMessageCard({
  payload,
  mine = false,
  currentUserId,
}: SplitShareMessageCardProps) {
  const t = useTranslations('splitShare')
  const tWorkout = useTranslations('workout')
  const router = useRouter()
  const { requireAccount } = useGuestGate()
  const [saved, setSaved] = useState(false)
  const [savedSplitId, setSavedSplitId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const category = payload.category || tWorkout('custom')
  const tone = ACCENT[toneForFocus(payload.category || 'Custom')]
  const focusLabel = isLatinFragment(category)
    ? category.toUpperCase()
    : category

  const handleSave = () => {
    if (saved || pending || mine) return
    requireAccount('saveSplit', () => {
    setError(null)
    startTransition(async () => {
      const result = await saveSharedSplit(payload.splitId, {
        shareToken: payload.shareToken,
      })
      if (result.error || !result.data) {
        setError(result.error ?? t('couldNotSave'))
        return
      }
      setSaved(true)
      setSavedSplitId(result.data.id)
      router.refresh()
    })
    })
  }

  return (
    <div className="space-y-2">
      {payload.note ? (
        <p className="text-sm leading-relaxed text-foreground">{payload.note}</p>
      ) : null}
      <article
        className={`overflow-hidden rounded-2xl border bg-card/90 ${
          mine ? 'border-blue/25' : 'border-silver/15'
        }`}
      >
        <div className="p-3.5 sm:p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div
              className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${tone.chip}`}
            >
              <Dumbbell className="size-4" aria-hidden="true" />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <span
                className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.14em] ${tone.badge}`}
              >
                {focusLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-blue/35 bg-blue-tint/40 px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] text-blue">
                <Share2 className="size-3" aria-hidden="true" />
                {t('sharedSplit')}
              </span>
            </div>
          </div>

          <h3 className="font-heading text-base font-bold text-foreground">
            <LtrIsolate when={isLatinFragment(payload.name)}>
              {payload.name}
            </LtrIsolate>
          </h3>

          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className={`size-3 ${tone.text}`} aria-hidden="true" />
              {t('daysPerWeek', { count: payload.daysPerWeek })}
            </span>
            {payload.exerciseCount > 0 ? (
              <span className="inline-flex items-center gap-1">
                <Dumbbell className={`size-3 ${tone.text}`} aria-hidden="true" />
                {payload.exerciseCount === 1
                  ? t('exerciseOne')
                  : t('exerciseOther', { count: payload.exerciseCount })}
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-col gap-2">
            <Link
              href={splitSharePath(payload.shareToken)}
              className="inline-flex min-h-10 w-full items-center justify-center rounded-full border border-silver/15 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground transition hover:border-gold/40 hover:text-gold"
            >
              {t('viewSplit')}
            </Link>
            {!mine && currentUserId ? (
              saved && savedSplitId ? (
                <Link
                  href={`/dashboard/splits/${savedSplitId}`}
                  className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full text-xs font-bold tracking-[0.14em] ${CTA_PRIMARY}`}
                >
                  <BookmarkCheck className="size-3.5" />
                  {t('openYourSplit')}
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={saved || pending}
                  onClick={handleSave}
                  className={`inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full text-xs font-bold tracking-[0.14em] transition disabled:opacity-80 ${
                    saved
                      ? 'border border-success/35 bg-success/10 text-success'
                      : CTA_PRIMARY
                  }`}
                >
                  {pending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : saved ? (
                    <BookmarkCheck className="size-3.5" />
                  ) : (
                    <BookmarkPlus className="size-3.5" />
                  )}
                  {saved ? t('saved') : t('saveToSplits')}
                </button>
              )
            ) : null}
          </div>
        </div>
      </article>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}
