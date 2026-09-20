'use client'

import { useEffect, useState } from 'react'
import {
  CloudOff,
  WifiOff,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { DashboardNav } from '@/components/dashboard-nav'
import { OfflineStartSessionFlow } from '@/components/offline-start-session-flow'
import { OfflineSessionLaunch } from '@/components/offline-session-launch'
import { StreakFlame } from '@/components/streak-flame'
import { ActiveWorkoutBanner } from '@/components/active-workout-banner'
import { initialsFrom } from '@/lib/dashboard-utils'
import { getHomeSnapshot } from '@/lib/offline/cache'
import { useOfflineStatus } from '@/lib/offline/provider'
import type { WeightUnit } from '@/lib/units'

type WeekDay = { day: string; done: boolean }

type OfflineFloorHomeProps = {
  displayName: string
  initials: string
  avatarUrl?: string | null
  profileHref?: string
  isGuest?: boolean
  weekActivity: WeekDay[]
  lastSessionCaption: string
}

export function OfflineFloorHome({
  displayName,
  initials,
  avatarUrl,
  profileHref,
  isGuest = false,
  weekActivity,
  lastSessionCaption,
}: OfflineFloorHomeProps) {
  const t = useTranslations('offline')
  const tHome = useTranslations('home')
  const { pendingCount } = useOfflineStatus()
  const [resumeSlug, setResumeSlug] = useState<string | null>(null)
  const [weightUnit, setWeightUnit] = useState<WeightUnit>('kg')
  const firstName = displayName.trim().split(/\s+/)[0] || displayName
  const safeInitials = initials || initialsFrom(displayName)

  useEffect(() => {
    void getHomeSnapshot()
      .then((snap) => {
        if (snap?.weightUnit === 'lb' || snap?.weightUnit === 'kg') {
          setWeightUnit(snap.weightUnit)
        }
      })
      .catch(() => undefined)
  }, [])

  // Do not auto-open an in-progress session — that hijacked Profile/Home.
  // Resume only via ActiveWorkoutBanner / explicit Start Session.

  if (resumeSlug) {
    return (
      <OfflineSessionLaunch
        slug={resumeSlug}
        displayName={displayName}
        initials={safeInitials}
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_30%_at_0%_80%,rgba(198,40,40,0.12),transparent_50%)]" />
      </div>

      <DashboardNav
        userName={displayName}
        initials={safeInitials}
        avatarUrl={avatarUrl}
        profileHref={profileHref}
        isGuest={isGuest}
      />

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <ActiveWorkoutBanner onResumeOffline={setResumeSlug} />
        <p className="inline-flex items-center gap-2 rounded-full border border-silver/25 bg-card px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-muted-foreground">
          <WifiOff className="size-3 text-gold" aria-hidden="true" />
          {t('floorKicker')}
        </p>
        <h1 className="font-heading mt-4 text-3xl font-bold tracking-tight text-headline sm:text-4xl">
          {t('floorHey', { name: firstName })}
        </h1>
        <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {t('floorHomeBody')}
        </p>

        {pendingCount > 0 ? (
          <p className="mt-4 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
            {t('queued', { count: pendingCount })}
          </p>
        ) : null}

        <OfflineStartSessionFlow
          displayName={displayName}
          initials={safeInitials}
          avatarUrl={avatarUrl}
          profileHref={profileHref}
          isGuest={isGuest}
          weightUnit={weightUnit}
          className="mt-8"
          onLaunch={setResumeSlug}
        />

        {weekActivity.length > 0 ? (
          <section className="mt-10">
            <p className="section-kicker mb-3">{tHome('thisWeek')}</p>
            <div className="grid grid-cols-7 gap-1.5">
              {weekActivity.map((day) => (
                <div key={day.day} className="flex flex-col items-center gap-2">
                  <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl">
                    <StreakFlame active={day.done} className="h-[88%] w-[88%]" />
                  </div>
                  <span className="text-[10px] tracking-wider text-muted-foreground">
                    {day.day}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{lastSessionCaption}</p>
          </section>
        ) : null}

        <section className="mt-10 grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-gold/25 bg-gold/5 p-5">
            <p className="text-[10px] font-bold tracking-[0.18em] text-gold">
              {t('floorLiveKicker')}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-foreground">
              <li>{t('floorLive1')}</li>
              <li>{t('floorLive2')}</li>
              <li>{t('floorLive3')}</li>
            </ul>
          </article>
          <article className="rounded-2xl border border-silver/20 bg-card/50 p-5">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.18em] text-muted-foreground">
              <CloudOff className="size-3" aria-hidden="true" />
              {t('floorPausedKicker')}
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <li>{t('floorPaused1')}</li>
              <li>{t('floorPaused2')}</li>
              <li>{t('floorPaused3')}</li>
              <li>{t('floorPaused4')}</li>
              <li>{t('floorPaused5')}</li>
            </ul>
          </article>
        </section>
      </main>
    </div>
  )
}
