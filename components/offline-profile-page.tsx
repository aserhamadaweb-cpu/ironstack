'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { DashboardNav } from '@/components/dashboard-nav'
import { BackToTrainLink } from '@/components/back-to-train-link'
import {
  PersonalRecordsSection,
  type PersonalRecordItem,
} from '@/components/personal-records-section'
import { UserAvatar } from '@/components/user-avatar'
import { initialsFrom } from '@/lib/dashboard-utils'
import {
  getCachedLiftTypes,
  getCachedPersonalRecords,
  getHomeSnapshot,
} from '@/lib/offline/cache'
import { useOfflineStatus } from '@/lib/offline/provider'

export function OfflineProfilePage({
  includeNav = true,
}: {
  includeNav?: boolean
}) {
  const t = useTranslations('offline')
  const tProfile = useTranslations('profile')
  const { hydrated } = useOfflineStatus()
  const [name, setName] = useState('Athlete')
  const [username, setUsername] = useState<string | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [isGuest, setIsGuest] = useState(false)
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg')
  const [records, setRecords] = useState<PersonalRecordItem[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const [snapshot, prs, lifts] = await Promise.all([
        getHomeSnapshot().catch(() => null),
        getCachedPersonalRecords().catch(() => []),
        getCachedLiftTypes().catch(() => []),
      ])
      if (cancelled) return

      const displayName = snapshot?.displayName || 'Athlete'
      setName(displayName)
      setUsername(snapshot?.username ?? null)
      setAvatarUrl(snapshot?.avatarUrl ?? null)
      setEmail(snapshot?.email ?? '')
      setIsGuest(snapshot?.isGuest === true)
      setUnit(snapshot?.weightUnit === 'lb' ? 'lb' : 'kg')

      const liftNames = new Map(lifts.map((lift) => [lift.id, lift]))
      setRecords(
        prs.map((row) => {
          const lift = liftNames.get(row.lift_type_id)
          return {
            id: row.id,
            liftName: lift?.name ?? 'Lift',
            muscleGroup: lift?.muscle_group ?? '',
            image: lift?.image_url ?? null,
            weight: Number(row.weight),
            reps: Number(row.reps),
            loggedAt: row.logged_at,
          }
        }),
      )
    })()
    return () => {
      cancelled = true
    }
  }, [hydrated])

  return (
    <div className="min-h-svh">
      {includeNav ? (
        <DashboardNav
          userName={name}
          initials={initialsFrom(name)}
          avatarUrl={avatarUrl}
          profileHref="/dashboard/profile"
          isGuest={isGuest}
        />
      ) : null}
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <BackToTrainLink />
        <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
          {tProfile('kicker')}
        </p>
        <h1 className="font-heading text-metallic mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
          {t('profileTitle')}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t('profileBody')}
        </p>

        <article className="glass-card sheen-border mt-8 flex flex-col items-center gap-4 rounded-2xl p-6 text-center sm:flex-row sm:p-8 sm:text-start">
          <UserAvatar
            name={name}
            username={username}
            avatarUrl={avatarUrl}
            size="lg"
            link={false}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-2xl font-bold text-foreground">
              {name}
            </p>
            {username ? (
              <p className="truncate text-sm text-muted-foreground">@{username}</p>
            ) : null}
            {email ? (
              <p className="break-all text-sm text-muted-foreground">{email}</p>
            ) : null}
          </div>
        </article>

        <div className="mt-8">
          <PersonalRecordsSection records={records} weightUnit={unit} />
        </div>
      </main>
    </div>
  )
}
