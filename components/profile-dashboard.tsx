'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Activity, Award, BrainCircuit, Compass, Flame, Medal, MessageSquare, Pencil, Settings, Target, Trophy } from 'lucide-react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { useTranslations } from 'next-intl'
import { AppShortcutGrid } from '@/components/app-shortcuts'
import { AiCoachPanel } from '@/components/ai-coach-panel'
import {
  CoachMemoryPanel,
  type MemoryItem,
} from '@/components/coach-memory-panel'
import { DashboardNav } from '@/components/dashboard-nav'
import { MonthHeatmap } from '@/components/month-heatmap'
import { PersonalRecordsSection,
  type PersonalRecordItem,
} from '@/components/personal-records-section'
import { EASE } from '@/components/reveal'
import { StatCard, type StatCardData } from '@/components/stat-card'
import { UserAvatar } from '@/components/user-avatar'
import { useIsGuest } from '@/components/use-is-guest'
import type { CoachInsightView } from '@/lib/ai/insights'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'

type ProfileDashboardProps = {
  displayName: string
  email: string
  username: string | null
  bio: string | null
  avatarUrl: string | null
  records: PersonalRecordItem[]
  memories: MemoryItem[]
  insight: CoachInsightView
  weightUnit?: 'kg' | 'lb'
  stats: {
    activePrs: number
    totalLogs: number
    heaviest: number
    thisMonth: number
  }
}

export function ProfileDashboard({
  displayName,
  email,
  username,
  bio,
  avatarUrl,
  records,
  memories: initialMemories,
  insight,
  weightUnit = 'kg',
  stats,
}: ProfileDashboardProps) {
  const t = useTranslations('profile')
  const tNav = useTranslations('nav')
  const tGuest = useTranslations('guest')
  const { isGuest } = useIsGuest()
  const reduce = useReducedMotion()
  const [memories, setMemories] = useState(initialMemories)
  const publicHref = profileHref(username)

  const heaviestDisplay =
    weightUnit === 'lb' ? Math.round(stats.heaviest * 2.2046226218) : stats.heaviest

  const statCards: StatCardData[] = [
    { label: t('activePrs'), value: stats.activePrs, icon: Target, accent: 'text-gold' },
    { label: t('prLifts'), value: stats.totalLogs, icon: Activity, accent: 'text-silver' },
    {
      label: t('heaviest'),
      value: heaviestDisplay,
      suffix: ` ${weightUnit}`,
      icon: Flame,
      accent: 'text-success',
      empty: stats.heaviest === 0,
    },
    { label: t('prsThisMonth'), value: stats.thisMonth, icon: Trophy, accent: 'text-silver' },
  ]

  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
  }
  const item: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } },
  }

  return (
    <div className="min-h-svh">
      <DashboardNav
        userName={displayName}
        initials={initialsFrom(displayName)}
        avatarUrl={avatarUrl}
        profileHref={publicHref}
      />

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 md:py-12">
        <motion.div
          className="mb-8 flex flex-col gap-2 sm:mb-10"
          initial={{ opacity: 0, y: reduce ? 0 : 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
            {t('kicker')}
          </p>
          <h1 className="font-heading text-metallic text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl">
            {t('title')}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t('subtitle')}
          </p>
        </motion.div>

        <motion.section
          className="flex flex-col gap-6"
          variants={container}
          initial="hidden"
          animate="visible"
        >
          <motion.article
            variants={item}
            className="glass-card sheen-border flex flex-col items-center gap-4 rounded-2xl p-6 text-center sm:flex-row sm:p-8 sm:text-start"
          >
            <UserAvatar
              name={displayName}
              username={username}
              avatarUrl={avatarUrl}
              size="lg"
              link={Boolean(publicHref)}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-2xl font-bold text-foreground">
                {displayName}
              </p>
              {username && (
                <p className="truncate text-sm text-muted-foreground">
                  @{username}
                </p>
              )}
              {isGuest ? (
                <p className="text-sm text-muted-foreground">
                  {tGuest('accountLabel')}
                </p>
              ) : (
                <p className="break-all text-sm text-muted-foreground">{email}</p>
              )}
              {bio && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {bio}
                </p>
              )}
              <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
                <Link
                  href="/dashboard/profile/edit"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 text-xs font-bold tracking-[0.14em] text-gold"
                >
                  <Pencil className="size-3.5" />
                  {t('edit')}
                </Link>
                <Link
                  href="/dashboard/messages"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-silver/20 px-4 text-xs font-semibold tracking-[0.14em] text-muted-foreground"
                >
                  <MessageSquare className="size-3.5" />
                  {t('messages')}
                </Link>
                {publicHref && (
                  <Link
                    href={publicHref}
                    className="inline-flex min-h-11 items-center rounded-full border border-blue/30 px-4 text-xs font-semibold tracking-[0.14em] text-blue"
                  >
                    {t('viewPublic')}
                  </Link>
                )}
              </div>
            </div>
          </motion.article>

          <motion.section variants={item} className="space-y-3">
            <p className="section-kicker">{t('hubTitle')}</p>
            <AppShortcutGrid
              items={[
                {
                  href: '/dashboard/settings',
                  label: tNav('settings'),
                  icon: Settings,
                },
                {
                  href: '/dashboard/records',
                  label: tNav('prs'),
                  icon: Trophy,
                },
                {
                  href: '/dashboard/achievements',
                  label: tNav('jumpAchievements'),
                  icon: Medal,
                },
                {
                  href: '/dashboard/explore',
                  label: tNav('explore'),
                  icon: Compass,
                },
                {
                  href: '/dashboard/leaderboard',
                  label: tNav('board'),
                  icon: Award,
                },
                {
                  href: '/dashboard/ai-coach',
                  label: tNav('coach'),
                  icon: BrainCircuit,
                },
              ]}
            />
          </motion.section>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            {statCards.map((stat) => (
              <StatCard key={stat.label} stat={stat} variants={item} />
            ))}
          </div>

          <motion.div variants={item}>
            <MonthHeatmap />
          </motion.div>

          <motion.div variants={item}>
            <PersonalRecordsSection records={records} weightUnit={weightUnit} />
          </motion.div>

          <motion.section variants={item} className="space-y-3">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground">
                {t('aiCoach')}
              </p>
              <h2 className="font-heading mt-1 text-xl font-bold text-foreground">
                {t('memoryTitle')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('memoryBody')}
              </p>
            </div>
            <CoachMemoryPanel memories={memories} onChanged={setMemories} />
          </motion.section>

          <motion.div variants={item}>
            <AiCoachPanel insight={insight} />
          </motion.div>
        </motion.section>
      </main>
    </div>
  )
}
