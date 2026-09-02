'use client'

import type { ComponentProps } from 'react'
import { Layers } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { SplitBuilder } from '@/components/split-builder'
import { EmptyState } from '@/components/page-states'
import { useOfflineStatus } from '@/lib/offline/provider'

type SplitEditOfflineGuardProps = ComponentProps<typeof SplitBuilder>

export function SplitEditOfflineGuard(props: SplitEditOfflineGuardProps) {
  const t = useTranslations('offline')
  const { online, hydrated } = useOfflineStatus()
  const offline = hydrated && !online

  if (offline) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <EmptyState
          icon={Layers}
          title={t('floorPaused5')}
          body={t('splitRequiresConnection')}
          actionLabel={t('openWorkout')}
          actionHref="/dashboard/workout"
        />
      </main>
    )
  }

  return <SplitBuilder {...props} />
}
