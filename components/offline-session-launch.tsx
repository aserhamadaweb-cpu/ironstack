'use client'

import { ActiveSessionGate } from '@/components/active-session-gate'
import { initialsFrom } from '@/lib/dashboard-utils'
import { useRegisterEmbeddedSession } from '@/lib/offline/embedded-session'
import type { WeightUnit } from '@/lib/units'

type OfflineSessionLaunchProps = {
  slug: string
  displayName: string
  initials?: string
  weightUnit?: WeightUnit
  onExit?: () => void
  onSwitchSplit?: (splitSlug: string) => void
}

export function OfflineSessionLaunch({
  slug,
  displayName,
  initials,
  weightUnit = 'kg',
  onExit,
  onSwitchSplit,
}: OfflineSessionLaunchProps) {
  useRegisterEmbeddedSession()
  return (
    <ActiveSessionGate
      slug={slug}
      displayName={displayName}
      initials={initials || initialsFrom(displayName)}
      isFirstEver={false}
      weightUnit={weightUnit}
      onExit={onExit}
      onSwitchSplit={onSwitchSplit}
    />
  )
}
