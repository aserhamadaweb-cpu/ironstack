'use client'

import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { AppTourProvider } from '@/components/app-tour/app-tour-provider'
import { GuestGateProvider } from '@/components/guest-gate-provider'
import { ActiveWorkoutProvider } from '@/lib/active-workout-provider'
import { OfflineProvider } from '@/lib/offline/provider'
import { EmbeddedSessionProvider } from '@/lib/offline/embedded-session'
import { NavigationIntentTracker } from '@/components/navigation-intent-tracker'
import { NavigationProgress } from '@/components/navigation-progress'
import { AuthSessionBootstrap } from '@/components/auth-session-bootstrap'

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <OfflineProvider>
      <AuthSessionBootstrap />
      <NavigationIntentTracker />
      <NavigationProgress />
      <ActiveWorkoutProvider>
        <EmbeddedSessionProvider>
          <Suspense fallback={null}>
            <AppTourProvider>
              <GuestGateProvider>{children}</GuestGateProvider>
            </AppTourProvider>
          </Suspense>
        </EmbeddedSessionProvider>
      </ActiveWorkoutProvider>
    </OfflineProvider>
  )
}
