import type { ReactNode } from 'react'
import { AppGuestShellProviders } from '@/components/app-guest-shell-providers'

export default function OfflineLayout({ children }: { children: ReactNode }) {
  return <AppGuestShellProviders>{children}</AppGuestShellProviders>
}
