'use client'

import { useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Swords, Trophy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/page-states'
import { ExercisePicker } from '@/components/exercise-picker'
import { ExerciseThumb } from '@/components/exercise-thumb'
import { CTA_PRIMARY } from '@/lib/accent'
import {
  acceptChallengeAction,
  cancelChallengeAction,
  createChallengeAction,
  declineChallengeAction,
} from '@/lib/data/challenges'
import { liftTypeToCatalogItem } from '@/lib/exercise-catalog'
import type { ChallengeWithRelations } from '@/lib/database.types'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'
import { formatWeightKg, type WeightUnit } from '@/lib/units'

type FriendOption = {
  id: string
  name: string
  username?: string | null
  avatarUrl?: string | null
}

type LiftOption = {
  id: string
  name: string
  muscle_group: string | null
  category?: string | null
}

type FriendChallengesPageProps = {
  currentUserId: string
  challenges: ChallengeWithRelations[]
  friends: FriendOption[]
  lifts: LiftOption[]
  unit: WeightUnit
}

function statusTone(status: string) {
  switch (status) {
    case 'active':
      return 'border-gold/40 bg-gold/10 text-gold'
    case 'pending':
      return 'border-heat/35 bg-heat/10 text-heat'
    case 'completed':
      return 'border-silver/25 bg-silver/10 text-foreground'
    default:
      return 'border-silver/15 text-muted-foreground'
  }
}

export function FriendChallengesPage({
  currentUserId,
  challenges,
  friends,
  lifts,
  unit,
}: FriendChallengesPageProps) {
  const t = useTranslations('friendChallenges')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [opponentId, setOpponentId] = useState(friends[0]?.id ?? '')
  const [liftTypeId, setLiftTypeId] = useState(lifts[0]?.id ?? '')
  const [targetWeight, setTargetWeight] = useState('')
  const [targetReps, setTargetReps] = useState('1')

  const buckets = useMemo(() => {
    const incoming = challenges.filter(
      (c) => c.status === 'pending' && c.opponent_id === currentUserId,
    )
    const outgoing = challenges.filter(
      (c) => c.status === 'pending' && c.creator_id === currentUserId,
    )
    const active = challenges.filter((c) => c.status === 'active')
    const finished = challenges.filter((c) =>
      ['completed', 'declined', 'cancelled'].includes(c.status),
    )
    return { incoming, outgoing, active, finished }
  }, [challenges, currentUserId])

  const catalogItems = useMemo(
    () => lifts.map((lift) => liftTypeToCatalogItem(lift)),
    [lifts],
  )

  const selectedLift = useMemo(
    () => catalogItems.find((item) => item.id === liftTypeId) ?? null,
    [catalogItems, liftTypeId],
  )

  const runAction = (
    action: () => Promise<{ ok: true } | { ok: true; id: string } | { ok: false; error: string }>,
  ) => {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setError(result.error)
        return
      }
      setShowForm(false)
      setTargetWeight('')
      setTargetReps('1')
      router.refresh()
    })
  }

  const personName = (c: ChallengeWithRelations, role: 'creator' | 'opponent' | 'winner') => {
    const p = c[role]
    return p?.display_name || p?.username || tCommon('athlete')
  }

  const renderCard = (challenge: ChallengeWithRelations) => {
    const isCreator = challenge.creator_id === currentUserId
    const isOpponent = challenge.opponent_id === currentUserId
    const other = isCreator ? challenge.opponent : challenge.creator
    const otherName =
      other?.display_name || other?.username || tCommon('athlete')
    const otherHref = profileHref(other?.username, other?.id)
    const liftName = challenge.lift_types?.name ?? t('liftFallback')

    return (
      <li
        key={challenge.id}
        className="rounded-2xl border border-silver/10 bg-card/50 p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-[0.14em] ${statusTone(challenge.status)}`}
              >
                {(['pending', 'active', 'completed', 'declined', 'cancelled'] as const).includes(
                  challenge.status as 'pending',
                )
                  ? t(`status.${challenge.status as 'pending'}`)
                  : challenge.status}
              </span>
              {challenge.status === 'completed' && challenge.winner_id && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-[0.12em] text-gold">
                  <Trophy className="size-3" aria-hidden="true" />
                  {challenge.winner_id === currentUserId
                    ? t('youWon')
                    : t('winnerWas', { name: personName(challenge, 'winner') })}
                </span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <ExerciseThumb
                muscle={challenge.lift_types?.muscle_group || 'Core'}
                image={challenge.lift_types?.image_url}
                name={liftName}
                className="size-12"
              />
              <h3 className="min-w-0 font-heading text-lg font-bold text-foreground">
                {liftName}
              </h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('targetLine', {
                weight: formatWeightKg(challenge.target_weight, unit),
                reps: challenge.target_reps,
              })}
            </p>
            {challenge.status === 'completed' && challenge.winner_id && (
              <p className="mt-2 text-sm font-semibold text-gold">
                {t('winningLift', {
                  weight: formatWeightKg(challenge.target_weight, unit),
                  reps: challenge.target_reps,
                })}
              </p>
            )}
            {challenge.status === 'completed' && !challenge.winner_id && (
              <p className="mt-2 text-xs text-muted-foreground">{t('noWinner')}</p>
            )}
            {challenge.status === 'declined' && (
              <p className="mt-2 text-xs text-muted-foreground">{t('wasDeclined')}</p>
            )}
            {challenge.status === 'cancelled' && (
              <p className="mt-2 text-xs text-muted-foreground">{t('wasCancelled')}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {isCreator ? t('vsOpponent') : t('fromCreator')}{' '}
              <Link
                href={otherHref}
                className="font-semibold text-gold hover:opacity-80"
              >
                {otherName}
              </Link>
            </p>
          </div>
          {other?.avatar_url ? (
            <div className="relative size-12 overflow-hidden rounded-full border border-gold/30">
              <Image
                src={other.avatar_url}
                alt=""
                fill
                className="object-cover"
                sizes="48px"
              />
            </div>
          ) : (
            <div className="flex size-12 items-center justify-center rounded-full border border-gold/30 bg-gold-tint text-xs font-bold text-gold">
              {initialsFrom(otherName)}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {challenge.status === 'pending' && isOpponent && (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  runAction(() => acceptChallengeAction(challenge.id))
                }
                className={`px-4 ${CTA_PRIMARY}`}
              >
                {t('accept')}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  runAction(() => declineChallengeAction(challenge.id))
                }
                className="btn-pill btn-pill-ghost px-4"
              >
                {t('decline')}
              </button>
            </>
          )}
          {challenge.status === 'pending' && isCreator && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction(() => cancelChallengeAction(challenge.id))
              }
              className="btn-pill btn-pill-ghost px-4"
            >
              {t('cancel')}
            </button>
          )}
          {challenge.status === 'active' && isCreator && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                runAction(() => cancelChallengeAction(challenge.id))
              }
              className="btn-pill btn-pill-ghost px-4"
            >
              {t('cancel')}
            </button>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-8">
      {error && (
        <p className="rounded-xl border border-heat/30 bg-heat/10 px-4 py-3 text-sm text-heat" role="alert">
          {error}
        </p>
      )}

      <section className="is-panel p-5 sm:p-6" data-tour="challenges-create">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="section-kicker">{t('createKicker')}</p>
            <h2 className="font-heading mt-1 text-xl font-bold text-foreground">
              {t('createTitle')}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('createBody')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className={`w-full shrink-0 px-5 sm:w-auto ${CTA_PRIMARY}`}
          >
            {showForm ? tCommon('cancel') : t('newChallenge')}
          </button>
        </div>

        {showForm && (
          <form
            className="mt-5 space-y-4 border-t border-silver/10 pt-5"
            onSubmit={(e) => {
              e.preventDefault()
              runAction(() =>
                createChallengeAction({
                  opponentId,
                  liftTypeId,
                  targetWeight: Number(targetWeight),
                  targetReps: Number(targetReps),
                  unit,
                }),
              )
            }}
          >
            {friends.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('needFriends')}</p>
            ) : (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                    {t('opponent')}
                  </span>
                  <select
                    value={opponentId}
                    onChange={(e) => setOpponentId(e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                    required
                  >
                    {friends.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                        {f.username ? ` (@${f.username})` : ''}
                      </option>
                    ))}
                  </select>
                </label>

                <div>
                  <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                    {t('exercise')}
                  </span>
                  {selectedLift && (
                    <p className="mb-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-sm font-semibold text-foreground">
                      {selectedLift.name}
                      {selectedLift.muscleGroup
                        ? ` · ${selectedLift.muscleGroup}`
                        : ''}
                    </p>
                  )}
                  <ExercisePicker
                    items={catalogItems}
                    value={liftTypeId || null}
                    onSelect={(item) => setLiftTypeId(item.id)}
                    variant="list"
                    maxHeightClassName="max-h-64"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                      {t('targetWeight', { unit })}
                    </span>
                    <input
                      type="number"
                      min="0.5"
                      step="0.5"
                      value={targetWeight}
                      onChange={(e) => setTargetWeight(e.target.value)}
                      className="h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                      {t('targetReps')}
                    </span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={targetReps}
                      onChange={(e) => setTargetReps(e.target.value)}
                      className="h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                      required
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={pending || !opponentId || !liftTypeId}
                  className={`px-6 ${CTA_PRIMARY}`}
                >
                  {t('sendChallenge')}
                </button>
              </>
            )}
          </form>
        )}
      </section>

      {challenges.length === 0 && (
        <EmptyState
          icon={Swords}
          title={t('emptyTitle')}
          body={t('emptyBody')}
          tone="heat"
        />
      )}

      {buckets.active.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-foreground">
            {t('active')}
          </h2>
          <ul className="space-y-3">{buckets.active.map(renderCard)}</ul>
        </section>
      )}

      {(buckets.incoming.length > 0 || buckets.outgoing.length > 0) && (
        <section className="space-y-5">
          <h2 className="font-heading text-lg font-bold text-foreground">
            {t('pending')}
          </h2>
          {buckets.incoming.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                {t('incoming')}
              </p>
              <ul className="space-y-3">{buckets.incoming.map(renderCard)}</ul>
            </div>
          )}
          {buckets.outgoing.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                {t('outgoing')}
              </p>
              <ul className="space-y-3">{buckets.outgoing.map(renderCard)}</ul>
            </div>
          )}
        </section>
      )}

      {buckets.finished.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-heading text-lg font-bold text-foreground">
            {t('history')}
          </h2>
          <ul className="space-y-3">{buckets.finished.map(renderCard)}</ul>
        </section>
      )}
    </div>
  )
}
