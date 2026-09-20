'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { CloudOff } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/page-states'
import { CTA_SECONDARY } from '@/lib/accent'
import { useOfflineStatus } from '@/lib/offline/provider'

export type OfflineGateFeature =
  | 'coach'
  | 'messages'
  | 'leaderboard'
  | 'notifications'
  | 'homeWorkouts'
  | 'splitsManage'

type OfflineConnectionGateProps = {
  feature: OfflineGateFeature
  children: ReactNode
  /** When true, render nothing until hydration (avoids flash). */
  waitForHydration?: boolean
}

export function OfflineConnectionGate({
  feature,
  children,
  waitForHydration = false,
}: OfflineConnectionGateProps) {
  const t = useTranslations('offline')
  const { online, hydrated } = useOfflineStatus()
  const offline = hydrated && !online

  if (waitForHydration && !hydrated) {
    return null
  }

  if (!offline) {
    return children
  }

  const title = t(`offlineBlocked.${feature}.title`)
  const body = t(`offlineBlocked.${feature}.body`)

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <EmptyState
        icon={CloudOff}
        title={title}
        body={body}
        tone="gold"
      />
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/dashboard/home" className={CTA_SECONDARY}>
          {t('floorBackHome')}
        </Link>
      </div>
    </main>
  )
}
