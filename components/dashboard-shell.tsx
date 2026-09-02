'use client'

import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { GuestGateProvider } from '@/components/guest-gate-provider'
import { ActiveWorkoutProvider } from '@/lib/active-workout-provider'
import { OfflineProvider } from '@/lib/offline/provider'

const AppTourProvider = dynamic(
  () =>
    import('@/components/app-tour/app-tour-provider').then(
      (mod) => mod.AppTourProvider,
    ),
  { ssr: false },
)

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <OfflineProvider>
      <ActiveWorkoutProvider>
        <Suspense fallback={null}>
          <AppTourProvider>
            <GuestGateProvider>{children}</GuestGateProvider>
          </AppTourProvider>
        </Suspense>
      </ActiveWorkoutProvider>
    </OfflineProvider>
  )
}
