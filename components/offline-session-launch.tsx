'use client'

import { ActiveSessionGate } from '@/components/active-session-gate'
import { initialsFrom } from '@/lib/dashboard-utils'
import type { WeightUnit } from '@/lib/units'

type OfflineSessionLaunchProps = {
  slug: string
  displayName: string
  initials?: string
  weightUnit?: WeightUnit
}

export function OfflineSessionLaunch({
  slug,
  displayName,
  initials,
  weightUnit = 'kg',
}: OfflineSessionLaunchProps) {
  return (
    <ActiveSessionGate
      slug={slug}
      displayName={displayName}
      initials={initials || initialsFrom(displayName)}
      isFirstEver={false}
      weightUnit={weightUnit}
    />
  )
}
