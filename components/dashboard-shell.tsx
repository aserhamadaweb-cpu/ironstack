'use client'

import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { AppTourProvider } from '@/components/app-tour/app-tour-provider'
import { EnableNotificationsPrompt } from '@/components/enable-notifications-prompt'
import { GuestGateProvider } from '@/components/guest-gate-provider'
import { ActiveWorkoutProvider } from '@/lib/active-workout-provider'
import { OfflineProvider } from '@/lib/offline/provider'
import { EmbeddedSessionProvider } from '@/lib/offline/embedded-session'
import { AuthSessionBootstrap } from '@/components/auth-session-bootstrap'

export function DashboardShell({
  children,
  createdAt = null,
}: {
  children: ReactNode
  createdAt?: string | null
}) {
  return (
    <OfflineProvider>
      <AuthSessionBootstrap />
      <ActiveWorkoutProvider>
        <EmbeddedSessionProvider>
          <Suspense fallback={null}>
            <AppTourProvider>
              <GuestGateProvider>
                {children}
                <EnableNotificationsPrompt createdAt={createdAt} />
              </GuestGateProvider>
            </AppTourProvider>
          </Suspense>
        </EmbeddedSessionProvider>
      </ActiveWorkoutProvider>
    </OfflineProvider>
  )
}
