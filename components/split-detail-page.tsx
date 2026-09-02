'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BookmarkPlus,
  CalendarDays,
  Check,
  Dumbbell,
  ListOrdered,
  Loader2,
  Pencil,
  Play,
  Share2,
  Sparkles,
} from 'lucide-react'
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { DashboardNav } from '@/components/dashboard-nav'
import { useGuestGate } from '@/components/guest-gate-provider'
import { ExerciseCard } from '@/components/exercise-card'
import { ExerciseDetailOverlay } from '@/components/exercise-detail-overlay'
import { EASE } from '@/components/reveal'
import { splitExerciseDetailRef, type SplitExerciseDetailRef } from '@/lib/exercise-catalog-id'
import { saveRecommendedSplit, saveSharedSplit, setSplitShared } from '@/lib/data/save-split'
import { SplitShareSheet } from '@/components/split-share-sheet'
import { patchCachedSplitShared, refreshWorkoutCache } from '@/lib/offline/cache'
import { useOfflineStatus } from '@/lib/offline/provider'
import { countExercises, type SplitDetail } from '@/lib/split-data'

type SplitDetailPageProps = {
  split: SplitDetail
  displayName: string
  initials: string
  avatarUrl?: string | null
  viewerUserId: string
}

export function SplitDetailPage({
  split,
  displayName,
  initials,
  avatarUrl,
  viewerUserId,
}: SplitDetailPageProps) {
  const router = useRouter()
  const { requireAccount } = useGuestGate()
  const tSplitBuilder = useTranslations('splitBuilder')
  const tCatalog = useTranslations('exerciseCatalog')
  const tOffline = useTranslations('offline')
  const tShare = useTranslations('splitShare')
  const { online, hydrated } = useOfflineStatus()
  const offline = hydrated && !online
  const reduce = useReducedMotion()
  const isOwner =
    Boolean(split.userId) &&
    split.userId === viewerUserId &&
    !split.isSystem &&
    !split.recommended
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isShared, setIsShared] = useState(Boolean(split.isShared))
  const [shareError, setShareError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [sharePending, startShareTransition] = useTransition()
  const [shareSheetOpen, setShareSheetOpen] = useState(false)
  const [selectedExercise, setSelectedExercise] = useState<SplitExerciseDetailRef | null>(null)
  const totalExercises = countExercises(split)

  const list: Variants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: reduce || totalExercises > 12 ? 0 : 0.05 },
    },
  }
  const row: Variants = {
    hidden: { opacity: 0, y: reduce || totalExercises > 12 ? 0 : 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reduce || totalExercises > 12 ? 0 : 0.45, ease: EASE },
    },
  }

  const handleSave = () => {
    if (saved || pending || isOwner || offline) return
    requireAccount('saveSplit', () => {
    setSaveError(null)
    startTransition(async () => {
      const result = split.recommended
        ? await saveRecommendedSplit(split.slug)
        : await saveSharedSplit(split.slug)
      if (result.error || !result.data) {
        setSaveError(result.error ?? 'Could not save that split.')
        return
      }
      setSaved(true)
      router.refresh()
    })
    })
  }

  const handleShareToggle = () => {
    if (!isOwner || sharePending || offline) return
    requireAccount('shareSplit', () => {
    const next = !isShared
    setShareError(null)
    setIsShared(next)
    startShareTransition(async () => {
      const result = await setSplitShared(split.slug, next)
      if (result.error) {
        setIsShared(!next)
        setShareError(result.error)
        return
      }
      try {
        await patchCachedSplitShared(split.slug, next)
      } catch {
        /* cache patch is best-effort */
      }
      try {
        await refreshWorkoutCache()
      } catch {
        /* list refresh is best-effort */
      }
      router.refresh()
    })
    })
  }

  const startSession = () => {
    requireAccount('startSession', () => {
      router.push(`/dashboard/splits/${split.slug}/session`)
    })
  }

  return (
    <div className="relative min-h-svh overflow-x-clip">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-5%,rgba(198,40,40,0.12),transparent_60%)]" />
        <div className="absolute top-[35%] -right-40 h-96 w-96 rounded-full bg-gold/[0.06] blur-3xl" />
        <div className="absolute bottom-[20%] left-[-6rem] h-80 w-80 rounded-full bg-gold/[0.08] blur-3xl" />
      </div>

      <DashboardNav userName={displayName} initials={initials} avatarUrl={avatarUrl} />

      <motion.main
        className="mx-auto max-w-4xl px-6 pt-8 md:pt-12"
        initial={{ opacity: 0, y: reduce ? 0 : 28, scale: reduce ? 1 : 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: EASE }}
      >
        <Link
          href="/dashboard/workout"
          className="mb-6 inline-flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:text-gold"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          BACK TO WORKOUT
        </Link>

        <header className="mb-10 overflow-hidden rounded-3xl border border-gold/25 bg-gradient-to-br from-gold/12 via-card/70 to-background p-6 shadow-[0_0_50px_-18px_rgba(198,40,40,0.35)] sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-[10px] font-bold tracking-[0.18em] text-gold">
              {split.tag.toUpperCase()}
            </span>
            {split.recommended && (
              <span className="inline-flex items-center gap-1 rounded-full border badge-amber px-2.5 py-1 text-[9px] font-bold tracking-[0.15em]">
                <Sparkles className="size-3" aria-hidden="true" />
                RECOMMENDED
              </span>
            )}
            {isShared && (
              <span className="inline-flex items-center gap-1 rounded-full border border-blue/35 bg-blue-tint/40 px-2.5 py-1 text-[9px] font-bold tracking-[0.15em] text-blue">
                <Share2 className="size-3" aria-hidden="true" />
                SHARED
              </span>
            )}
          </div>

          <h1 className="font-heading mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
            {split.name}
          </h1>
          {split.description.trim() &&
          split.description.trim() !== `${split.daysPerWeek} days/week` ? (
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              {split.description}
            </p>
          ) : null}
          {split.summary.trim() &&
          split.summary.trim() !== split.description.trim() ? (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {split.summary}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-2 rounded-xl border border-silver/15 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5 text-gold" aria-hidden="true" />
              {split.daysPerWeek} days / week
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-silver/15 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
              <ListOrdered className="size-3.5 text-gold" aria-hidden="true" />
              {totalExercises} exercises
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-silver/15 bg-background/50 px-3 py-2 text-xs text-muted-foreground">
              <Dumbbell className="size-3.5 text-gold" aria-hidden="true" />
              {split.schedule.length} unique{' '}
              {split.schedule.length === 1 ? 'day' : 'days'}
            </span>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startSession}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-xs font-bold tracking-[0.14em] text-primary-foreground transition hover:bg-primary/90"
            >
              <Play className="size-3.5 fill-current" aria-hidden="true" />
              START SESSION
            </button>
            {isOwner ? (
              <>
                {offline ? (
                  <span
                    className="inline-flex min-h-11 max-w-full flex-wrap items-center gap-2 rounded-full border border-dashed border-silver/20 bg-card/40 px-5 py-2 text-xs font-bold tracking-[0.14em] text-muted-foreground/70"
                    title={tOffline('splitRequiresConnection')}
                  >
                    <Pencil className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
                    <span>EDIT SPLIT</span>
                    <span className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground/80">
                      · {tOffline('editSplitNeedsConnection')}
                    </span>
                  </span>
                ) : (
                  <Link
                    href={`/dashboard/splits/${split.slug}/edit`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-silver/25 px-5 text-xs font-bold tracking-[0.14em] text-muted-foreground transition hover:border-gold/40 hover:text-gold"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    EDIT SPLIT
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => setShareSheetOpen(true)}
                  disabled={offline}
                  title={offline ? tOffline('splitRequiresConnection') : undefined}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-5 text-xs font-bold tracking-[0.14em] text-gold transition hover:border-gold/50 disabled:opacity-60"
                >
                  <Share2 className="size-3.5" aria-hidden="true" />
                  {tShare('share')}
                </button>
                <button
                  type="button"
                  onClick={handleShareToggle}
                  disabled={sharePending || offline}
                  title={offline ? tOffline('splitRequiresConnection') : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-xs font-bold tracking-[0.14em] transition disabled:opacity-60 ${
                    isShared
                      ? 'border-blue/40 bg-blue-tint/40 text-blue'
                      : 'border-silver/25 text-muted-foreground hover:border-blue/40 hover:text-blue'
                  }`}
                >
                  {sharePending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Share2 className="size-3.5" aria-hidden="true" />
                  )}
                  {isShared ? 'Shared on profile · Unshare' : 'Share to profile'}
                </button>
                {shareError ? (
                  <p role="alert" className="mt-2 w-full text-sm text-destructive">
                    {shareError}
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={pending || saved || offline}
                  title={offline ? tOffline('splitRequiresConnection') : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-5 text-xs font-bold tracking-[0.14em] transition disabled:opacity-70 ${
                    saved
                      ? 'border-success bg-success text-background'
                      : 'border-silver/25 text-muted-foreground hover:border-silver/50 hover:text-foreground'
                  }`}
                >
                  {saved ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    <BookmarkPlus className="size-3.5" aria-hidden="true" />
                  )}
                  {saved ? 'SAVED' : pending ? 'SAVING…' : 'SAVE TO YOUR SPLITS'}
                </button>
                {saveError ? (
                  <p role="alert" className="mt-2 w-full text-sm text-destructive">
                    {saveError}
                  </p>
                ) : null}
              </>
            )}
          </div>
        </header>

        <motion.div variants={list} initial="hidden" animate="visible">
          {split.schedule.map((day, dayIndex) => (
            <section key={day.id} className="mb-10">
              <motion.div
                variants={row}
                className="mb-4 flex items-end justify-between gap-4 border-b border-silver/10 pb-3"
              >
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
                    DAY {dayIndex + 1}
                  </p>
                  <h2 className="font-heading mt-1 text-xl font-bold text-foreground sm:text-2xl">
                    {day.focus}
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">{day.note}</p>
                </div>
                <span className="shrink-0 text-[10px] font-semibold tracking-[0.15em] text-muted-foreground">
                  {day.exercises.length} EXERCISES
                </span>
              </motion.div>

              <div className="flex flex-col gap-2.5">
                {day.exercises.map((exercise, index) => {
                  const detailRef = splitExerciseDetailRef(exercise)
                  if (!detailRef) return null
                  return (
                  <motion.div key={exercise.id} variants={row}>
                    <button
                      type="button"
                      onClick={() => setSelectedExercise(detailRef)}
                      aria-label={`${tCatalog('viewDetails')}: ${exercise.name}`}
                      className="group w-full rounded-2xl border border-silver/10 bg-card/50 p-3 text-start transition-all duration-200 hover:-translate-y-0.5 hover:border-silver/25 hover:bg-card/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 sm:p-4"
                    >
                      <ExerciseCard
                        index={index}
                        name={exercise.name}
                        muscles={[exercise.muscle]}
                        image={exercise.image}
                        setsReps={`${exercise.sets} sets × ${exercise.reps} reps`}
                      />
                    </button>
                  </motion.div>
                  )
                })}
              </div>
            </section>
          ))}
        </motion.div>
      </motion.main>

      <AnimatePresence>
        {selectedExercise ? (
          <ExerciseDetailOverlay
            key={`${selectedExercise.id}:${selectedExercise.name}`}
            exerciseId={selectedExercise.id}
            exerciseName={selectedExercise.name}
            onClose={() => setSelectedExercise(null)}
            backLabel={tSplitBuilder('backToSplit')}
          />
        ) : null}
      </AnimatePresence>

      {isOwner ? (
        <SplitShareSheet
          open={shareSheetOpen}
          onClose={() => {
            setShareSheetOpen(false)
            setIsShared(true)
          }}
          splitId={split.slug}
          splitName={split.name}
          daysPerWeek={split.daysPerWeek}
          category={split.tag}
        />
      ) : null}
    </div>
  )
}
