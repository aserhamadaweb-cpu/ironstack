'use client'

import { useEffect } from 'react'
import { trackRouteLoading } from '@/lib/navigation-intent'

/** Tells NavigationProgress a route's content is still streaming in. */
export function RouteLoadingSignal() {
  useEffect(() => trackRouteLoading(), [])
  return null
}
