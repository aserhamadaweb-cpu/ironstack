import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  Clock3,
  Layers,
  SkipForward,
  Weight,
} from 'lucide-react'
import { ExerciseThumb } from '@/components/exercise-thumb'
import {
  formatClock,
  formatRelativeFinishedAt,
  formatSessionDate,
  formatVolume,
} from '@/lib/session-store'
import {
  formatLiftSetDisplay,
  type WeightUnit,
} from '@/lib/units'

export type SessionDetailLift = {
  name: string
  image?: string | null
  muscle?: string | null
  isCardio?: boolean
  repsOnly?: boolean
  sets: Array<{
    setNumber: number
    weight: number
    reps: number
    durationSeconds?: number | null
    skipped: boolean
    repsOnly?: boolean
  }>
}

export type SessionDetailViewProps = {
  displayName: string
  initials: string
  avatarUrl?: string | null
  title: string
  finishedAt: string
  durationSeconds: number
  totalVolume: number
  setsCompleted: number
  setsSkipped: number
  lifts: SessionDetailLift[]
  weightUnit?: WeightUnit
  backHref?: string
  backLabel?: string
}

export function SessionDetailView({
  displayName,
  initials,
  avatarUrl,
  title,
  finishedAt,
  durationSeconds,
  totalVolume,
  setsCompleted,
  setsSkipped,
  lifts,
  weightUnit = 'kg',
  backHref = '/dashboard/history',
  backLabel = 'BACK TO HISTORY',
}: SessionDetailViewProps) {
  const badge = formatRelativeFinishedAt(finishedAt)
  const dateLabel = formatSessionDate(finishedAt)

  return (
    <div className="relative min-h-svh overflow-x-clip">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_-5%,rgba(198,40,40,0.12),transparent_60%)]" />
        <div className="absolute top-[35%] -right-40 h-96 w-96 rounded-full bg-gold/[0.06] blur-3xl" />
        <div className="absolute bottom-[20%] left-[-6rem] h-80 w-80 rounded-full bg-gold/[0.08] blur-3xl" />
      </div>


      <main className="mx-auto max-w-3xl px-4 pt-6 sm:px-6 md:pt-10">
        <Link
          href={backHref}
          className="mb-6 inline-flex min-h-11 items-center gap-2 text-xs font-semibold tracking-[0.15em] text-muted-foreground transition-colors hover:text-gold"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {backLabel}
        </Link>

        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full border badge-amber px-2.5 py-1 text-[10px] font-semibold tracking-[0.15em]">
            {badge}
          </span>
          <span className="text-xs text-muted-foreground">{dateLabel}</span>
        </div>

        <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
          SESSION DETAIL
        </p>
        <h1 className="font-heading mt-1 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Every set you logged this session — completed and skipped.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              label: 'DURATION',
              value: formatClock(durationSeconds),
              icon: Clock3,
            },
            {
              label: 'VOLUME',
              value: formatVolume(totalVolume, weightUnit),
              icon: Weight,
            },
            {
              label: 'SETS',
              value:
                setsSkipped > 0
                  ? `${setsCompleted} done · ${setsSkipped} skipped`
                  : `${setsCompleted} completed`,
              icon: Layers,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-silver/10 bg-card/50 p-4"
            >
              <stat.icon className="mb-2 size-4 text-gold" aria-hidden="true" />
              <p className="font-heading text-lg font-bold tabular-nums text-foreground">
                {stat.value}
              </p>
              <p className="mt-0.5 text-[10px] tracking-[0.15em] text-muted-foreground">
                {stat.label}
              </p>
            </div>
          ))}
        </div>

        <section className="mt-10">
          <p className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground">
            LIFTS
          </p>
          <h2 className="font-heading mt-1 text-2xl font-bold text-foreground">
            What you logged
          </h2>

          {lifts.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-silver/20 bg-card/35 px-6 py-12 text-center">
              <p className="font-heading text-lg font-semibold text-foreground">
                No sets logged
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                This session has no lift logs on record.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {lifts.map((lift) => {
                const completed = lift.sets.filter((s) => !s.skipped)
                const liftVolume =
                  lift.isCardio || lift.repsOnly
                    ? 0
                    : completed.reduce(
                        (sum, s) => (s.repsOnly ? sum : sum + s.weight * s.reps),
                        0,
                      )
                return (
                  <article
                    key={lift.name}
                    className="rounded-2xl border border-border bg-card p-5"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <ExerciseThumb
                          muscle={lift.muscle || 'Core'}
                          image={lift.image}
                          name={lift.name}
                          className="size-12"
                        />
                        <div className="min-w-0">
                          <h3 className="font-heading truncate text-lg font-bold text-foreground">
                            {lift.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {completed.length} completed
                            {lift.sets.length - completed.length > 0
                              ? ` · ${lift.sets.length - completed.length} skipped`
                              : ''}
                            {liftVolume > 0
                              ? ` · ${formatVolume(liftVolume)}`
                              : ''}
                          </p>
                        </div>
                      </div>
                    </div>

                    <ul className="space-y-2">
                      {lift.sets.map((set) => (
                        <li
                          key={`${lift.name}-${set.setNumber}`}
                          className={`flex min-h-11 items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-sm ${
                            set.skipped
                              ? 'border-silver/10 bg-background/30 text-muted-foreground'
                              : 'border-silver/10 bg-background/50 text-foreground'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2">
                            {set.skipped ? (
                              <SkipForward
                                className="size-3.5 text-muted-foreground"
                                aria-hidden="true"
                              />
                            ) : (
                              <Check
                                className="size-3.5 text-success"
                                aria-hidden="true"
                              />
                            )}
                            Set {set.setNumber}
                            {set.skipped ? ' · skipped' : ''}
                          </span>
                          {!set.skipped && (
                            <span className="font-semibold tabular-nums text-gold">
                              {formatLiftSetDisplay({
                                weightKg: set.weight,
                                reps: set.reps,
                                durationSeconds: set.durationSeconds,
                                weightUnit,
                                isCardio: lift.isCardio,
                                repsOnly: set.repsOnly || lift.repsOnly,
                              })}
                            </span>
                          )}
                          {set.skipped &&
                            (lift.isCardio
                              ? (set.durationSeconds ?? 0) > 0
                              : set.weight > 0 && set.reps > 0) && (
                            <span className="tabular-nums text-muted-foreground">
                              {formatLiftSetDisplay({
                                weightKg: set.weight,
                                reps: set.reps,
                                durationSeconds: set.durationSeconds,
                                weightUnit,
                                isCardio: lift.isCardio,
                                repsOnly: set.repsOnly || lift.repsOnly,
                              })}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>

    </div>
  )
}
