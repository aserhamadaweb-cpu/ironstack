'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  BookmarkCheck,
  BookmarkPlus,
  CalendarDays,
  Check,
  Dumbbell,
  Loader2,
  Share2,
} from 'lucide-react'
import { LtrIsolate, isLatinFragment } from '@/components/ltr-isolate'
import { useGuestGate } from '@/components/guest-gate-provider'
import { ACCENT, CTA_PRIMARY, toneForFocus } from '@/lib/accent'
import { saveSharedSplit } from '@/lib/data/save-split'
import type { SharedSplitCard as SharedSplitCardData } from '@/lib/data/social'

type SharedSplitCardProps = {
  split: SharedSplitCardData
  /** When true, hide the save button (own profile). */
  isOwner: boolean
}

export function SharedSplitCard({ split, isOwner }: SharedSplitCardProps) {
  const t = useTranslations('sharedSplit')
  const tWorkout = useTranslations('workout')
  const router = useRouter()
  const { requireAccount } = useGuestGate()
  const [saved, setSaved] = useState(split.alreadySaved)
  const [savedSplitId, setSavedSplitId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const category = split.category || tWorkout('custom')
  const tone = ACCENT[toneForFocus(split.category || 'Custom')]
  const focusLabel = isLatinFragment(category)
    ? category.toUpperCase()
    : category

  const handleSave = () => {
    if (saved || pending || isOwner) return
    requireAccount('saveSplit', () => {
    setError(null)
    startTransition(async () => {
      const result = await saveSharedSplit(split.id)
      if (result.error || !result.data) {
        setError(result.error ?? t('couldNotSave'))
        return
      }
      setSaved(true)
      setJustSaved(true)
      setSavedSplitId(result.data.id)
      router.refresh()
    })
    })
  }

  return (
    <article
      className={`group relative flex w-[85vw] max-w-sm shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-200 hover:-translate-y-1 hover:border-gold/30 md:w-auto md:max-w-none ${tone.edge}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div
          className={`flex size-11 items-center justify-center rounded-xl ${tone.chip}`}
        >
          <Dumbbell className="size-5" aria-hidden="true" />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em] ${tone.badge}`}
          >
            {focusLabel}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-blue/35 bg-blue-tint/40 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-blue">
            <Share2 className="size-3" aria-hidden="true" />
            {t('shared')}
          </span>
        </div>
      </div>

      <h3 className="font-heading text-xl font-bold text-foreground">
        <LtrIsolate when={isLatinFragment(split.name)}>{split.name}</LtrIsolate>
      </h3>
      {split.description ? (
        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
          {split.description}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className={`size-3.5 ${tone.text}`} aria-hidden="true" />
          {t('daysPerWeek', { count: split.daysPerWeek })}
        </span>
        {split.exerciseCount > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <Dumbbell className={`size-3.5 ${tone.text}`} aria-hidden="true" />
            {split.exerciseCount === 1
              ? t('exerciseOne')
              : t('exerciseOther', { count: split.exerciseCount })}
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-6">
        <Link
          href={`/dashboard/splits/${split.id}`}
          className="inline-flex min-h-10 w-full items-center justify-center rounded-full border border-silver/15 text-xs font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:border-gold/40 hover:text-gold"
        >
          {t('viewSplit')}
        </Link>

        {!isOwner && (
          saved && savedSplitId ? (
            <Link
              href={`/dashboard/splits/${savedSplitId}`}
              className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold tracking-[0.14em] ${CTA_PRIMARY}`}
            >
              <BookmarkCheck className="size-4" />
              {t('openSaved')}
            </Link>
          ) : (
            <button
              type="button"
              disabled={saved || pending}
              onClick={handleSave}
              className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold tracking-[0.14em] transition disabled:opacity-80 ${
                saved
                  ? 'border border-success/35 bg-success/10 text-success'
                  : CTA_PRIMARY
              }`}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : saved ? (
                <BookmarkCheck className="size-4" />
              ) : (
                <BookmarkPlus className="size-4" />
              )}
              {saved
                ? justSaved
                  ? t('saved')
                  : t('alreadySaved')
                : t('save')}
            </button>
          )
        )}

        {justSaved && (
          <p className="inline-flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-success">
            <Check className="size-3.5" />
            {t('saved')}
          </p>
        )}
        {error && (
          <p role="alert" className="text-center text-xs text-destructive">
            {error}
          </p>
        )}
      </div>
    </article>
  )
}
