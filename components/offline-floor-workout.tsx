'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { WifiOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DashboardNav } from '@/components/dashboard-nav'
import { ActiveWorkoutBanner } from '@/components/active-workout-banner'
import { OfflineStartSessionFlow } from '@/components/offline-start-session-flow'
import { OfflineSessionLaunch } from '@/components/offline-session-launch'
import { CTA_SECONDARY } from '@/lib/accent'
import { initialsFrom } from '@/lib/dashboard-utils'
import { getHomeSnapshot } from '@/lib/offline/cache'
import { useOfflineStatus } from '@/lib/offline/provider'
import { profileHref as buildProfileHref } from '@/lib/profile-path'
import type { WeightUnit } from '@/lib/units'

type OfflineFloorWorkoutProps = {
  displayName: string
  avatarUrl?: string | null
  profileHref?: string
  isGuest?: boolean
  includeNav?: boolean
}

export function OfflineFloorWorkout({
  displayName,
  avatarUrl,
  profileHref,
  isGuest = false,
  includeNav = true,
}: OfflineFloorWorkoutProps) {
  const t = useTranslations('offline')
  const { pendingCount } = useOfflineStatus()
  const [cachedName, setCachedName] = useState(displayName)
  const [cachedAvatar, setCachedAvatar] = useState(avatarUrl)
  const [cachedHref, setCachedHref] = useState(profileHref)
  const [cachedGuest, setCachedGuest] = useState(isGuest)
  const [resumeSlug, setResumeSlug] = useState<string | null>(null)
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg')

  useEffect(() => {
    let cancelled = false
    void getHomeSnapshot()
      .then((snap) => {
        if (cancelled || !snap) return
        if (snap.displayName) setCachedName(snap.displayName)
        if (snap.avatarUrl) setCachedAvatar(snap.avatarUrl)
        if (snap.weightUnit === 'lb' || snap.weightUnit === 'kg') {
          setWeightUnit(snap.weightUnit)
        }
        setCachedHref(
          buildProfileHref(snap.username, snap.userId) || profileHref,
        )
        setCachedGuest(snap.isGuest)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [profileHref])

  // Resume only via ActiveWorkoutBanner — never auto-open a leftover session.

  if (resumeSlug) {
    return (
      <OfflineSessionLaunch
        slug={resumeSlug}
        displayName={cachedName}
        initials={initialsFrom(cachedName)}
        weightUnit={weightUnit}
        onExit={() => setResumeSlug(null)}
        onSwitchSplit={setResumeSlug}
      />
    )
  }

  return (
    <div className="relative min-h-svh">
      <div className="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
        <div className="absolute inset-0 gold-radial-wash" />
      </div>

      {includeNav ? (
        <DashboardNav
          userName={cachedName}
          initials={initialsFrom(cachedName)}
          avatarUrl={cachedAvatar}
          profileHref={cachedHref}
          isGuest={cachedGuest}
        />
      ) : null}

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <ActiveWorkoutBanner onResumeOffline={setResumeSlug} />
        <p className="inline-flex items-center gap-2 rounded-full border border-silver/25 bg-card px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-muted-foreground">
          <WifiOff className="size-3 text-gold" aria-hidden="true" />
          {t('floorKicker')}
        </p>
        <h1 className="font-heading mt-4 text-3xl font-bold tracking-tight text-headline sm:text-4xl">
          {t('floorTrainTitle')}
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {t('floorTrainBody')}
        </p>

        {pendingCount > 0 ? (
          <p className="mt-4 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
            {t('queued', { count: pendingCount })}
          </p>
        ) : null}

        <div className="mt-8">
          <Link
            href="/dashboard/home"
            className={`${CTA_SECONDARY} inline-flex min-h-12 items-center justify-center px-6`}
          >
            {t('floorBackHome')}
          </Link>
        </div>

        <OfflineStartSessionFlow
          displayName={cachedName}
          initials={initialsFrom(cachedName)}
          avatarUrl={cachedAvatar}
          profileHref={cachedHref}
          isGuest={cachedGuest}
          weightUnit={weightUnit}
          className="mt-10"
          onLaunch={setResumeSlug}
        />
      </main>
    </div>
  )
}
