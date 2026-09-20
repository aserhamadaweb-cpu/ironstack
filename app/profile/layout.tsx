import type { ReactNode } from 'react'
import { DashboardShell } from '@/components/dashboard-shell'

/**
 * Share the dashboard provider tree so /profile/* stays SPA under the same
 * Offline/Guest/Tour shell (avoids App Router mpaNavigation ↔ React #310).
 */
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
