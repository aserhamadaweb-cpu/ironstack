import type { ReactNode } from 'react'
import { getIsGuestAction } from '@/lib/data/profile-actions'
import { GuestBlockedScreen } from '@/components/guest-blocked-screen'
import type { GuestBlockedReason } from '@/lib/guest-access'

type GuestPageGateProps = {
  reason: GuestBlockedReason
  returnPath?: string
  children: ReactNode
}

/** Server gate: guests see an upgrade screen instead of write/AI surfaces. */
export async function GuestPageGate({
  reason,
  returnPath,
  children,
}: GuestPageGateProps) {
  const isGuest = await getIsGuestAction()
  if (isGuest) {
    return <GuestBlockedScreen reason={reason} returnPath={returnPath} />
  }
  return children
}
