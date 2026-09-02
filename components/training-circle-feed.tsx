'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Plus, Trophy } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FindPeopleSheet } from '@/components/find-people-sheet'
import { LtrIsolate, isLatinFragment } from '@/components/ltr-isolate'
import { useIsGuest } from '@/components/use-is-guest'
import {
  formatLiftDate,
  formatWeight,
  MOCK_PRS,
} from '@/lib/mock-pr-data'
import { profileHref } from '@/lib/profile-path'

type FriendAvatar = {
  id: string
  name: string
  initials: string
  tone: string
  username?: string | null
  avatarUrl?: string | null
}

type TrainingCircleFeedProps = {
  showAvatars?: boolean
  friends?: FriendAvatar[]
}

export function TrainingCircleAvatars({
  friends = [],
  onAddClick,
  showAdd = true,
}: {
  friends?: FriendAvatar[]
  onAddClick?: () => void
  showAdd?: boolean
}) {
  const t = useTranslations('home')

  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
      {friends.length === 0 && (
        <p className="max-w-xs py-2 text-sm leading-relaxed text-muted-foreground">
          {showAdd
            ? t('noFriendsYet', { plus: '+' })
            : t('guestCircleEmpty')}
        </p>
      )}
      {friends.map((friend) => {
        const href = profileHref(friend.username, friend.id)
        const firstName = friend.name.split(' ')[0]
        const avatar = (
          <div
            className={`relative flex size-12 items-center justify-center overflow-hidden rounded-full border-2 text-xs font-bold transition-transform group-hover:z-10 group-hover:scale-110 sm:size-14 ${friend.tone}`}
          >
            {friend.avatarUrl ? (
              <Image
                src={friend.avatarUrl}
                alt=""
                fill
                className="object-cover"
                sizes="56px"
              />
            ) : (
              friend.initials
            )}
          </div>
        )
        return (
          <div
            key={friend.id}
            className="group relative flex w-16 shrink-0 flex-col items-center sm:w-auto"
            title={friend.name}
          >
            {href ? (
              <Link href={href} className="flex flex-col items-center">
                {avatar}
                <LtrIsolate
                  as="span"
                  when={isLatinFragment(firstName)}
                  className="mt-2 max-w-16 truncate text-center text-[10px] text-muted-foreground"
                >
                  {firstName}
                </LtrIsolate>
              </Link>
            ) : (
              <>
                {avatar}
                <LtrIsolate
                  as="span"
                  when={isLatinFragment(firstName)}
                  className="mt-2 max-w-16 truncate text-center text-[10px] text-muted-foreground"
                >
                  {firstName}
                </LtrIsolate>
              </>
            )}
          </div>
        )
      })}
      {showAdd ? (
        <button
          type="button"
          aria-label={t('findPeopleAria')}
          onClick={onAddClick}
          className="flex size-12 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-gold/40 text-gold transition-colors hover:border-gold hover:bg-gold/10 sm:size-14"
        >
          <Plus className="size-5" aria-hidden="true" />
        </button>
      ) : null}
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
            className="rounded-xl border border-silver/10 bg-background/40 px-4 py-3"
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

export function TrainingCircleFeed({
  showAvatars = true,
  friends = [],
}: TrainingCircleFeedProps) {
  const t = useTranslations('home')
  const [findOpen, setFindOpen] = useState(false)
  const { isGuest } = useIsGuest()

  return (
    <section className="is-panel p-5 sm:p-7">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="section-kicker">{t('community')}</p>
          <h2 className="font-heading mt-1 text-2xl font-bold text-headline">
            {t('trainingCircle')}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('trainingCircleBody')}
          </p>
        </div>
      </div>

      {showAvatars && (
        <div className="mb-2">
          <TrainingCircleAvatars
            friends={friends}
            showAdd={!isGuest}
            onAddClick={() => setFindOpen(true)}
          />
        </div>
      )}

      {!isGuest && (
        <FindPeopleSheet open={findOpen} onClose={() => setFindOpen(false)} />
      )}
    </section>
  )
}
