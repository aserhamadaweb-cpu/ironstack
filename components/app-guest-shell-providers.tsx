'use client'

import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { GuestGateProvider } from '@/components/guest-gate-provider'
import { ActiveWorkoutProvider } from '@/lib/active-workout-provider'
import { OfflineProvider } from '@/lib/offline/provider'
import { EmbeddedSessionProvider } from '@/lib/offline/embedded-session'
/**
 * Shell providers for routes that render DashboardNav or call useGuestGate()
 * outside app/dashboard/layout.tsx.
 */
export function AppGuestShellProviders({ children }: { children: ReactNode }) {
  return (
    <OfflineProvider>
      <ActiveWorkoutProvider>
        <EmbeddedSessionProvider>
          <Suspense fallback={null}>
            <GuestGateProvider>{children}</GuestGateProvider>
          </Suspense>
        </EmbeddedSessionProvider>
      </ActiveWorkoutProvider>
    </OfflineProvider>
  )
}
