'use client'

import type { ReactNode } from 'react'
import { Suspense } from 'react'
import { AppTourProvider } from '@/components/app-tour/app-tour-provider'
import { GuestGateProvider } from '@/components/guest-gate-provider'
import { OfflineProvider } from '@/lib/offline/provider'

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <OfflineProvider>
      <Suspense fallback={null}>
        <AppTourProvider>
          <GuestGateProvider>{children}</GuestGateProvider>
        </AppTourProvider>
      </Suspense>
    </OfflineProvider>
  )
}
