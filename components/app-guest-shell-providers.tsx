'use client'

import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { GuestGateProvider } from '@/components/guest-gate-provider'
import { OfflineProvider } from '@/lib/offline/provider'

/**
 * Shell providers for routes that render DashboardNav or call useGuestGate()
 * outside app/dashboard/layout.tsx.
 */
export function AppGuestShellProviders({ children }: { children: ReactNode }) {
  return (
    <OfflineProvider>
      <Suspense fallback={null}>
        <GuestGateProvider>{children}</GuestGateProvider>
      </Suspense>
    </OfflineProvider>
  )
}
