'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { GuestUpgradePrompt } from '@/components/guest-upgrade-prompt'
import { useIsGuest } from '@/components/use-is-guest'
import type { GuestBlockedReason } from '@/lib/guest-access'

type GuestGateContextValue = {
  isGuest: boolean
  requireAccount: (reason: GuestBlockedReason, action?: () => void) => boolean
  openUpgrade: (reason: GuestBlockedReason) => void
}

const GuestGateContext = createContext<GuestGateContextValue | null>(null)

export function GuestGateProvider({ children }: { children: ReactNode }) {
  const { isGuest } = useIsGuest()
  const [prompt, setPrompt] = useState<{
    open: boolean
    reason: GuestBlockedReason
  }>({ open: false, reason: 'generic' })

  const openUpgrade = useCallback((reason: GuestBlockedReason) => {
    setPrompt({ open: true, reason })
  }, [])

  const requireAccount = useCallback(
    (reason: GuestBlockedReason, action?: () => void) => {
      if (isGuest) {
        openUpgrade(reason)
        return false
      }
      action?.()
      return true
    },
    [isGuest, openUpgrade],
  )

  const value = useMemo(
    () => ({ isGuest, requireAccount, openUpgrade }),
    [isGuest, requireAccount, openUpgrade],
  )

  return (
    <GuestGateContext.Provider value={value}>
      {children}
      <GuestUpgradePrompt
        open={prompt.open}
        onClose={() => setPrompt((current) => ({ ...current, open: false }))}
        reason={prompt.reason}
      />
    </GuestGateContext.Provider>
  )
}

export function useGuestGate() {
  const ctx = useContext(GuestGateContext)
  if (!ctx) {
    throw new Error('useGuestGate must be used within GuestGateProvider')
  }
  return ctx
}
