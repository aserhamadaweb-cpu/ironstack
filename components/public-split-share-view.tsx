'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ArrowLeft,
  BookmarkCheck,
  BookmarkPlus,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Loader2,
} from 'lucide-react'
import { UserAvatar } from '@/components/user-avatar'
import { useGuestGate } from '@/components/guest-gate-provider'
import { LtrIsolate, isLatinFragment } from '@/components/ltr-isolate'
import { ACCENT, CTA_PRIMARY, toneForFocus } from '@/lib/accent'
import { saveSharedSplit } from '@/lib/data/save-split'
import type { PublicSharedSplitView } from '@/lib/data/split-share'
import { profileHref } from '@/lib/profile-path'
import { buildAuthEntryHref } from '@/lib/auth-entry'
import { ShareLinkAppHandoff } from '@/components/share-link-app-handoff'
import { ExerciseThumb } from '@/components/exercise-thumb'

type PublicSplitShareClientProps = {
  split: PublicSharedSplitView
  viewerUserId: string | null
  initialSaved: boolean
  initialOwned: boolean
  initialSavedCopyId?: string | null
  returnPath: string
}

export function PublicSplitShareClient({
  split,
  viewerUserId,
  initialSaved,
  initialOwned,
  initialSavedCopyId = null,
  returnPath,
  loginHref,
}: PublicSplitShareClientProps & { loginHref: string }) {
  const t = useTranslations('splitShare')
  const tMessages = useTranslations('messages')
  const tWorkout = useTranslations('workout')
  const router = useRouter()
  const { requireAccount } = useGuestGate()
  const [saved, setSaved] = useState(initialSaved || initialOwned)
  const [savedSplitId, setSavedSplitId] = useState<string | null>(
    initialSavedCopyId,
  )
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [openDays, setOpenDays] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      split.schedule.length > 0 ? [[split.schedule[0].id, true]] : [],
    ),
  )

  const category = split.category || tWorkout('custom')
  const tone = ACCENT[toneForFocus(split.category || 'Custom')]
  const focusLabel = isLatinFragment(category)
    ? category.toUpperCase()
    : category
  const ownerName =
    split.owner.display_name || split.owner.username || t('athleteFallback')
  const ownerProfile = profileHref(split.owner.username, split.owner.id)
  const backFallback = viewerUserId ? '/dashboard/messages' : '/'

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
      return
    }
    router.push(backFallback)
  }

  const toggleDay = (dayId: string) => {
    setOpenDays((prev) => ({ ...prev, [dayId]: !prev[dayId] }))
  }

  const handleSave = () => {
    if (!viewerUserId || saved || pending || initialOwned) return
    requireAccount('saveSplit', () => {
    setError(null)
    startTransition(async () => {
      const result = await saveSharedSplit(split.id, {
        shareToken: split.shareToken,
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
    <div className="mx-auto max-w-lg px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
      <ShareLinkAppHandoff />
      <header className="sticky top-0 z-10 -mx-4 mb-4 border-b border-silver/10 bg-background/95 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <button
          type="button"
          onClick={handleBack}
          className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:text-gold"
        >
          <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
          {viewerUserId ? tMessages('backInbox') : t('backHome')}
        </button>
      </header>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gold/15 text-gold">
          <Dumbbell className="size-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.2em] text-gold">
            IRONSTACK
          </p>
          <p className="text-xs text-muted-foreground">{t('publicKicker')}</p>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <UserAvatar
          name={ownerName}
          username={split.owner.username}
          avatarUrl={split.owner.avatar_url}
          size="md"
          link={false}
        />
        <div className="min-w-0">
          {ownerProfile ? (
            <Link
              href={ownerProfile}
              className="truncate font-heading text-sm font-semibold text-foreground hover:text-gold"
            >
              @{split.owner.username ?? ownerName}
            </Link>
          ) : (
            <p className="truncate font-heading text-sm font-semibold text-foreground">
              {ownerName}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{t('sharedWithYou')}</p>
        </div>
      </div>

      <article
        className={`overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-gold/10 via-card/80 to-background p-5 shadow-[0_0_40px_-16px_rgba(198,40,40,0.25)] ${tone.edge}`}
      >
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em] ${tone.badge}`}
          >
            {focusLabel}
          </span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          <LtrIsolate when={isLatinFragment(split.name)}>{split.name}</LtrIsolate>
        </h1>
        {split.description ? (
          <p className="mt-2 text-sm text-muted-foreground">{split.description}</p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className={`size-3.5 ${tone.text}`} />
            {t('daysPerWeek', { count: split.daysPerWeek })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Dumbbell className={`size-3.5 ${tone.text}`} />
            {split.exerciseCount === 1
              ? t('exerciseOne')
              : t('exerciseOther', { count: split.exerciseCount })}
          </span>
        </div>
      </article>

      <section className="mt-8 space-y-3">
        <h2 className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
          {t('weeklyOverview')}
        </h2>
        {split.schedule.map((day, index) => {
          const open = Boolean(openDays[day.id])
          return (
            <div
              key={day.id}
              className="overflow-hidden rounded-2xl border border-silver/10 bg-card/50"
            >
              <button
                type="button"
                onClick={() => toggleDay(day.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
              >
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-gold">
                    {t('dayLabel', { number: index + 1 })}
                  </p>
                  <p className="font-heading text-base font-bold text-foreground">
                    {day.name}
                  </p>
                  {day.subtitle ? (
                    <p className="text-xs text-muted-foreground">{day.subtitle}</p>
                  ) : null}
                </div>
                {open ? (
                  <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
              {open ? (
                <ul className="space-y-2 border-t border-silver/10 px-4 py-3">
                  {day.exercises.map((exercise) => (
                    <li
                      key={exercise.id}
                      className="flex items-center gap-3 rounded-xl border border-silver/10 bg-background/40 px-3 py-2.5"
                    >
                      <ExerciseThumb
                        muscle="Core"
                        image={exercise.image}
                        name={exercise.name}
                        className="size-11"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {exercise.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {t('setsReps', {
                            sets: exercise.sets,
                            reps: exercise.reps,
                          })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )
        })}
      </section>

      <div className="sticky bottom-0 mt-8 space-y-3 border-t border-silver/10 bg-background/95 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-xl">
        {viewerUserId ? (
          initialOwned ? (
            <Link
              href={`/dashboard/splits/${split.id}`}
              className={`inline-flex min-h-12 w-full items-center justify-center rounded-full text-sm font-bold tracking-[0.14em] ${CTA_PRIMARY}`}
            >
              {t('openYourSplit')}
            </Link>
          ) : saved && savedSplitId ? (
            <Link
              href={`/dashboard/splits/${savedSplitId}`}
              className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-sm font-bold tracking-[0.14em] ${CTA_PRIMARY}`}
            >
              <BookmarkCheck className="size-4" />
              {t('openYourSplit')}
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
              {saved ? t('saved') : t('saveToSplits')}
            </button>
          )
        ) : (
          <>
            <Link
              href={loginHref}
              className={`inline-flex min-h-12 w-full items-center justify-center rounded-full text-sm font-bold tracking-[0.14em] ${CTA_PRIMARY}`}
            >
              {t('signUpToSave')}
            </Link>
            <p className="text-center text-xs text-muted-foreground">
              {t('alreadyAccount')}{' '}
              <Link
                href={buildAuthEntryHref({ next: returnPath })}
                className="font-semibold text-gold hover:underline"
              >
                {t('logIn')}
              </Link>
            </p>
          </>
        )}
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
