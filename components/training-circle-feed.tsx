'use client'

import { Plus, Trophy } from 'lucide-react'
import {
  CIRCLE_PRS,
  formatLiftDate,
  formatWeight,
  MOCK_PRS,
} from '@/lib/mock-pr-data'

type TrainingCircleFeedProps = {
  showAvatars?: boolean
}

const FRIENDS = [
  { name: 'Maya Chen', initials: 'MC', tone: 'border chip-amber' },
  { name: 'Jordan Lee', initials: 'JL', tone: 'border chip-blue' },
  { name: 'Sam Okoro', initials: 'SO', tone: 'border chip-green' },
  { name: 'Riley Park', initials: 'RP', tone: 'border chip-amber' },
  { name: 'Chris N.', initials: 'CN', tone: 'border chip-blue' },
  { name: 'Ava Brooks', initials: 'AB', tone: 'border chip-green' },
]

export function TrainingCircleAvatars() {
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
      {FRIENDS.map((friend) => (
        <div
          key={friend.name}
          className="group relative flex w-16 shrink-0 flex-col items-center sm:w-auto"
          title={friend.name}
        >
          <div
            className={`flex size-12 items-center justify-center rounded-full border-2 text-xs font-bold transition-transform hover:z-10 hover:scale-110 sm:size-14 ${friend.tone}`}
          >
            {friend.initials}
          </div>
          <span className="mt-2 max-w-16 truncate text-center text-[10px] text-muted-foreground">
            {friend.name.split(' ')[0]}
          </span>
        </div>
      ))}
      <button
        type="button"
        aria-label="Add friend"
        className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-gold/40 text-gold transition-colors hover:border-gold hover:bg-gold/10 sm:size-14"
      >
        <Plus className="size-5" aria-hidden="true" />
      </button>
    </div>
  )
}

export function PersonalPrBoard() {
  const current = MOCK_PRS.filter((record) => record.isCurrentPr).sort(
    (a, b) => b.weight - a.weight,
  )

  return (
    <section className="glass-card rounded-2xl border border-silver/10 p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
            PERSONAL RECORDS
          </p>
          <h2 className="font-heading mt-1 text-xl font-bold text-foreground">
            Your PR Board
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Best logged weight per exercise.
          </p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-xl border chip-amber">
          <Trophy className="size-5" aria-hidden="true" />
        </div>
      </div>

      <ul className="space-y-2.5">
        {current.map((record) => (
          <li
            key={record.id}
            className="rounded-xl border border-silver/10 bg-zinc-950/40 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-heading text-base font-semibold text-foreground">
                  {record.liftName}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatLiftDate(record.loggedAt)}
                  {record.notes ? ` · ${record.notes}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="font-heading text-lg font-bold tabular-nums text-gold">
                  {formatWeight(record.weight, record.unit)}
                </p>
                <p className="text-[10px] tracking-[0.14em] text-muted-foreground">
                  {record.reps} REP{record.reps === 1 ? '' : 'S'}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

export function TrainingCircleFeed({ showAvatars = true }: TrainingCircleFeedProps) {
  return (
    <section className="rounded-2xl border border-silver/10 bg-zinc-900/40 p-5 backdrop-blur-md sm:p-7">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
            COMMUNITY
          </p>
          <h2 className="font-heading mt-1 text-2xl font-bold text-white">
            Your Training Circle
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Friends who lift with you — cheer recent PRs and stay accountable.
          </p>
        </div>
        <button
          type="button"
          className="hidden min-h-11 rounded-full border border-gold/30 px-4 text-[10px] font-semibold tracking-[0.2em] text-gold transition-colors hover:bg-gold/10 sm:inline-flex sm:items-center"
        >
          SEE ALL
        </button>
      </div>

      {showAvatars && (
        <div className="mb-6">
          <TrainingCircleAvatars />
        </div>
      )}

      <div className="space-y-2.5">
        <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
          RECENT CIRCLE PRS
        </p>
        {CIRCLE_PRS.map((entry) => (
          <article
            key={entry.id}
            className="flex items-center gap-3 rounded-xl border border-silver/10 bg-zinc-950/40 px-3 py-3 sm:px-4"
          >
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold ${entry.tone}`}
            >
              {entry.initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {entry.name}{' '}
                <span className="font-normal text-muted-foreground">hit a PR</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {entry.liftName} · {formatLiftDate(entry.loggedAt)}
              </p>
            </div>
            <p className="shrink-0 font-heading text-sm font-bold tabular-nums text-gold sm:text-base">
              {formatWeight(entry.weight, entry.unit)}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
