'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CalendarDays,
  ChevronDown,
  Layers,
  Play,
  Plus,
  Trash2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CTA_PRIMARY } from '@/lib/accent'
import { useGuestGate } from '@/components/guest-gate-provider'
import { deleteCustomSplit, saveCustomSplit } from '@/lib/data/save-split'
import { MAX_CUSTOM_SPLITS } from '@/lib/data/split-limits'
import { isNetworkFailure } from '@/lib/log'
import { refreshWorkoutCache } from '@/lib/offline/cache'
import { removeLocalSplit, saveSplitOffline } from '@/lib/offline/split-store'
import { queueSplitSync } from '@/lib/offline/sync'
import {
  HOME_GOALS,
  homeProgramToSavePayload,
  type HomeGoal,
  type ResolvedHomeProgram,
} from '@/lib/home-splits'
import type { LibraryExercise } from '@/lib/exercise-library'
import { useActiveWorkout } from '@/lib/use-active-workout'
import { ActiveWorkoutConflict } from '@/components/active-workout-conflict'
import { createSplitChoiceHref } from '@/lib/split-create-paths'

export type HomeSplitCard = {
  id: string
  name: string
  days: number
  focus: string
}

const PROGRAM_MESSAGE_KEY: Record<
  string,
  'homeFatLoss' | 'homeMuscleGain' | 'homeCombo' | 'homeHybrid'
> = {
  'home-fat-loss': 'homeFatLoss',
  'home-muscle-gain': 'homeMuscleGain',
  'home-combo': 'homeCombo',
  'home-hybrid': 'homeHybrid',
}

type HomeProgramBoardProps = {
  programs: ResolvedHomeProgram[]
  yourSplits: HomeSplitCard[]
  onOpenExercise: (exercise: LibraryExercise) => void
}

export function HomeProgramBoard({
  programs,
  yourSplits,
  onOpenExercise,
}: HomeProgramBoardProps) {
  const t = useTranslations('homeWorkouts')
  const tOffline = useTranslations('offline')
  const tWorkout = useTranslations('workout')
  const router = useRouter()
  const { requireAccount } = useGuestGate()
  const [goal, setGoal] = useState<HomeGoal>('fatLoss')
  const [openSlug, setOpenSlug] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [splits, setSplits] = useState(yourSplits)
  const [pending, startTransition] = useTransition()
  const { active: activeWorkout, refresh: refreshActiveWorkout } = useActiveWorkout()
  const [startBlocked, setStartBlocked] = useState(false)
  const adoptingRef = useRef(false)

  useEffect(() => {
    setSplits(yourSplits)
  }, [yourSplits])

  const visible = useMemo(
    () => programs.filter((program) => program.goal === goal),
    [programs, goal],
  )
  const atLimit = splits.length >= MAX_CUSTOM_SPLITS

  const programCopy = (slug: string, field: 'name' | 'blurb') =>
    t(`program.${PROGRAM_MESSAGE_KEY[slug] ?? 'homeFatLoss'}.${field}`)

  const adopt = (program: ResolvedHomeProgram, start: boolean) => {
    if (pending || atLimit || adoptingRef.current) return
    requireAccount(start ? 'startSession' : 'createSplit', () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setError(tOffline('splitRequiresConnection'))
      return
    }
    if (start && activeWorkout) {
      setStartBlocked(true)
      return
    }
    adoptingRef.current = true
    setError(null)
    setPendingSlug(program.slug)
    startTransition(async () => {
      const labels = {
        name: programCopy(program.slug, 'name'),
        description: programCopy(program.slug, 'blurb'),
        category: t(`goal.${program.goal}`),
      }
      const splitId = crypto.randomUUID()
      const payload = {
        ...homeProgramToSavePayload(program, labels),
        id: splitId,
        dayIds: program.days.map(() => crypto.randomUUID()),
      }
      try {
        const local = await saveSplitOffline({
          kind: 'create',
          splitId,
          payload,
          sync: false,
        })
        if (local.error || !local.data) {
          setError(local.error ?? t('adoptFailed'))
          setPendingSlug(null)
          return
        }
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          const remote = await saveCustomSplit(payload)
          if (remote.error) {
            queueSplitSync()
            setError(remote.error)
            setPendingSlug(null)
            router.push(`/dashboard/splits/${splitId}`)
            return
          }
        }
        queueSplitSync()
        router.push(
          start
            ? `/dashboard/splits/${splitId}/session`
            : `/dashboard/splits/${splitId}`,
        )
        router.refresh()
      } catch (err) {
        if (isNetworkFailure(err)) {
          queueSplitSync()
          router.push(`/dashboard/splits/${splitId}`)
          return
        }
        setError(err instanceof Error ? err.message : t('adoptFailed'))
      } finally {
        adoptingRef.current = false
        setPendingSlug(null)
      }
    })
    })
  }

  const handleDelete = (splitId: string, splitName: string) => {
    if (deletingId || pending) return
    requireAccount('editSplit', () => {
    const confirmed = window.confirm(
      tWorkout('deleteConfirm', { name: splitName, max: MAX_CUSTOM_SPLITS }),
    )
    if (!confirmed) return

    setError(null)
    setDeletingId(splitId)
    startTransition(async () => {
      const previous = splits
      setSplits((current) => current.filter((split) => split.id !== splitId))
      try {
        const result = await deleteCustomSplit(splitId)
        if (result.error) {
          setSplits(previous)
          setError(result.error)
          return
        }
        try {
          await removeLocalSplit(splitId)
        } catch {
          /* local cache cleanup is best-effort */
        }
        try {
          await refreshWorkoutCache()
        } catch {
          /* live list already dropped the split */
        }
        router.refresh()
      } catch (err) {
        setSplits(previous)
        setError(
          err instanceof Error
            ? err.message
            : 'Could not delete that split. Please try again.',
        )
      } finally {
        setDeletingId(null)
      }
    })
    })
  }

  const openCreateSplit = () => {
    requireAccount('createSplit', () => {
      router.push(createSplitChoiceHref(true))
    })
  }

  const openSession = (splitId: string) => {
    requireAccount('startSession', () => {
      router.push(`/dashboard/splits/${splitId}/session`)
    })
  }

  return (
    <div className="space-y-8">
      {startBlocked && activeWorkout ? (
        <ActiveWorkoutConflict
          active={activeWorkout}
          onResolved={() => {
            setStartBlocked(false)
            void refreshActiveWorkout()
          }}
          onStay={() => setStartBlocked(false)}
        />
      ) : null}
      {error ? (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={openCreateSplit}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-bold tracking-[0.14em] text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t('createSplit')}
        </button>
        <a
          href="#home-your-splits"
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-silver/20 px-4 text-sm font-bold tracking-[0.14em] text-foreground transition hover:border-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
        >
          <Layers className="size-4" aria-hidden="true" />
          {t('chooseSplit')}
        </a>
      </div>

      <section id="home-your-splits">
        <p className="section-kicker">{t('yourSplitsKicker')}</p>
        <h2 className="font-heading mt-1 text-2xl font-bold text-foreground">
          {t('yourSplits')}
        </h2>
        {splits.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{t('yourSplitsEmpty')}</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {splits.map((split) => {
              const isDeleting = deletingId === split.id
              return (
              <article
                key={split.id}
                className="flex flex-col rounded-2xl border border-silver/15 bg-card/50 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-heading text-lg font-bold text-foreground">
                    {split.name}
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleDelete(split.id, split.name)}
                    disabled={isDeleting || pending}
                    aria-label={tWorkout('deleteAria', { name: split.name })}
                    className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-silver/15 bg-background/50 text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tWorkout('daysPerWeek', { count: split.days })}
                  {split.focus ? ` · ${split.focus}` : ''}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => openSession(split.id)}
                    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full text-xs font-bold tracking-[0.14em] ${CTA_PRIMARY}`}
                  >
                    <Play className="size-3.5 fill-current" aria-hidden="true" />
                    {tWorkout('startSession')}
                  </button>
                  <Link
                    href={`/dashboard/splits/${split.id}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-silver/20 text-xs font-semibold tracking-[0.12em] text-muted-foreground hover:border-gold/40 hover:text-gold"
                  >
                    {tWorkout('viewSplit')}
                  </Link>
                </div>
              </article>
              )
            })}
          </div>
        )}
      </section>

      <section>
        <p className="section-kicker">{t('goalsKicker')}</p>
        <h2 className="font-heading mt-1 text-2xl font-bold text-foreground">
          {t('goalsTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('goalsBody')}</p>
        <div className="-mx-1 mt-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {HOME_GOALS.map((id) => {
            const active = goal === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => setGoal(id)}
                aria-pressed={active}
                className={`min-h-11 shrink-0 rounded-full border px-4 text-[11px] font-semibold tracking-[0.1em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
                  active
                    ? 'border-gold/60 bg-gold/15 text-gold'
                    : 'border-silver/15 bg-card/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(`goal.${id}`)}
              </button>
            )
          })}
        </div>

        {atLimit ? (
          <p className="mt-4 text-sm text-muted-foreground">
            {tWorkout('limitBody', { max: MAX_CUSTOM_SPLITS })}
          </p>
        ) : null}

        <div className="mt-4 grid gap-4">
          {visible.map((program) => {
            const open = openSlug === program.slug
            const busy = pending && pendingSlug === program.slug
            return (
              <article
                key={program.slug}
                className="rounded-2xl border border-silver/15 bg-card/50 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold tracking-[0.18em] text-gold">
                      {t(`goal.${program.goal}`)}
                    </p>
                    <h3 className="font-heading mt-1 text-xl font-bold text-foreground">
                      {programCopy(program.slug, 'name')}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {programCopy(program.slug, 'blurb')}
                    </p>
                    <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarDays className="size-3.5" aria-hidden="true" />
                      {tWorkout('daysPerWeek', { count: program.daysPerWeek })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenSlug((current) =>
                        current === program.slug ? null : program.slug,
                      )
                    }
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-full border border-silver/20 px-4 text-xs font-semibold tracking-[0.12em] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                    aria-expanded={open}
                  >
                    {open ? t('hideDays') : t('showDays')}
                    <ChevronDown
                      className={`size-4 transition ${open ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>

                {open ? (
                  <ol className="mt-4 space-y-4">
                    {program.days.map((day) => (
                      <li key={day.name}>
                        <p className="text-sm font-semibold text-foreground">
                          {day.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{day.subtitle}</p>
                        <ul className="mt-2 space-y-1.5">
                          {day.exercises.map((entry) => (
                            <li key={entry.exercise.id}>
                              <button
                                type="button"
                                onClick={() => onOpenExercise(entry.exercise)}
                                className="flex w-full min-h-11 items-center justify-between gap-3 rounded-xl border border-silver/10 bg-background/50 px-3 text-start hover:border-gold/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-semibold text-foreground">
                                    {entry.exercise.name}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {entry.exercise.equipment} · {entry.sets} × {entry.reps}
                                  </span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ol>
                ) : null}

                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={busy || atLimit}
                    onClick={() => adopt(program, true)}
                    className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full text-sm font-bold tracking-[0.14em] disabled:opacity-50 ${CTA_PRIMARY}`}
                  >
                    <Play className="size-4 fill-current" aria-hidden="true" />
                    {busy ? t('adopting') : tWorkout('startSession')}
                  </button>
                  <button
                    type="button"
                    disabled={busy || atLimit}
                    onClick={() => adopt(program, false)}
                    className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full border border-silver/20 text-xs font-semibold tracking-[0.12em] text-muted-foreground hover:border-gold/40 hover:text-gold disabled:opacity-50"
                  >
                    {t('saveToSplits')}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </section>
    </div>
  )
}
