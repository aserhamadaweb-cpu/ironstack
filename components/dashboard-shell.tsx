'use client'

import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { AppTourProvider } from '@/components/app-tour/app-tour-provider'
import { GuestGateProvider } from '@/components/guest-gate-provider'
import { ActiveWorkoutProvider } from '@/lib/active-workout-provider'
import { OfflineProvider } from '@/lib/offline/provider'

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
