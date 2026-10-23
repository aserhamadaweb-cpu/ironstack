'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  APP_TOUR_STEPS,
  type AppTourStatus,
} from '@/lib/app-tour'
import { releaseAppScrollLock } from '@/lib/app-tour-scroll-lock'
import {
  setTourNavigationActive,
  subscribeNavigationSettled,
} from '@/lib/navigation-intent'
import {
  completeAppTourAction,
  deferAppTourAction,
  getAppTourStateAction,
  restartAppTourAction,
  saveAppTourProgressAction,
  skipAppTourAction,
} from '@/lib/data/tour-actions'
import { useIsGuest } from '@/components/use-is-guest'
import { useActiveWorkout } from '@/lib/use-active-workout'
import { useOfflineStatus } from '@/lib/offline/provider'
import {
  TourDeferredBanner,
  TourOverlay,
} from '@/components/app-tour/tour-overlay'

type AppTourContextValue = {
  restartTour: () => Promise<void>
  isTourVisible: boolean
}

const AppTourContext = createContext<AppTourContextValue>({
  restartTour: async () => {},
  isTourVisible: false,
})

export function useAppTour() {
  return useContext(AppTourContext)
}

function pathReadyForStep(pathname: string, href: string | null) {
  if (!href) return true
  return pathname === href || pathname.startsWith(`${href}/`)
}

function syncStepToPathname(pathname: string): number | null {
  const matchIdx = APP_TOUR_STEPS.findIndex(
    (s) => s.href && pathReadyForStep(pathname, s.href),
  )
  return matchIdx >= 0 ? matchIdx : null
}

/** Offline document shell + any /offline/* fallback. */
function isOfflineShellPath(pathname: string) {
  return pathname === '/offline' || pathname.startsWith('/offline/')
}

/**
 * Never auto-offer or show deferred tour chrome on offline floors.
 * Same idea as guest exclusion — gym-floor offline UX must stay uncluttered.
 */
function shouldBlockTourAutoOffer(online: boolean, pathname: string) {
  if (!online) return true
  if (isOfflineShellPath(pathname)) return true
  return false
}

export function AppTourProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isGuest, ready: guestReady } = useIsGuest()
  const { active, ready: activeReady } = useActiveWorkout()
  const { online, hydrated: offlineHydrated } = useOfflineStatus()

  const [status, setStatus] = useState<AppTourStatus | null>(null)
  const [step, setStep] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [visible, setVisible] = useState(false)
  const [showDeferred, setShowDeferred] = useState(false)
  /** Why the deferred banner is showing — drives honest copy. */
  const [deferredReason, setDeferredReason] = useState<
    'active-session' | 'wrong-route' | null
  >(null)
  const [awaitingPath, setAwaitingPath] = useState<string | null>(null)
  const bootstrapped = useRef(false)
  const forceOffer = useRef(false)
  const busyDepth = useRef(0)
  const syncingPath = useRef(false)
  const persistTimer = useRef<number | null>(null)
  const pendingPersist = useRef<{ step: number; status: AppTourStatus } | null>(
    null,
  )

  const beginBusy = useCallback(() => {
    busyDepth.current += 1
    setBusy(true)
  }, [])

  const endBusy = useCallback(() => {
    busyDepth.current = Math.max(0, busyDepth.current - 1)
    if (busyDepth.current === 0) setBusy(false)
  }, [])

  /** Flush debounced progress — never apply a stale step back onto local state. */
  const flushPersist = useCallback(async () => {
    if (persistTimer.current) {
      window.clearTimeout(persistTimer.current)
      persistTimer.current = null
    }
    const pending = pendingPersist.current
    if (!pending) return false
    pendingPersist.current = null
    const result = await saveAppTourProgressAction(pending.step, pending.status)
    if (result.ok) {
      setStatus(result.status)
      // Only sync step if the user hasn't already moved past this save.
      if (result.step === stepRef.current) setStep(result.step)
      return true
    }
    return false
  }, [])

  /**
   * Step saves are debounced so Next isn't blocked by a Supabase round-trip
   * (and so we don't thrash auth metadata on every tap).
   */
  const clearPendingPersist = useCallback(() => {
    pendingPersist.current = null
    if (persistTimer.current) {
      window.clearTimeout(persistTimer.current)
      persistTimer.current = null
    }
  }, [])

  const persistQuiet = useCallback(
    (nextStep: number, nextStatus: AppTourStatus = 'active') => {
      pendingPersist.current = { step: nextStep, status: nextStatus }
      if (persistTimer.current) window.clearTimeout(persistTimer.current)
      persistTimer.current = window.setTimeout(() => {
        persistTimer.current = null
        void flushPersist()
      }, 1_200)
    },
    [flushPersist],
  )

  useEffect(() => {
    setTourNavigationActive(visible)
    return () => setTourNavigationActive(false)
  }, [visible])

  useEffect(() => {
    return () => {
      if (persistTimer.current) window.clearTimeout(persistTimer.current)
    }
  }, [])

  const goToStep = useCallback(
    (
      nextStep: number,
      options?: {
        persist?: boolean
        status?: AppTourStatus
        /** Only true for explicit Next/Back — never auto-navigate on bootstrap. */
        navigate?: boolean
      },
    ) => {
      const clamped = Math.max(0, Math.min(APP_TOUR_STEPS.length - 1, nextStep))
      const def = APP_TOUR_STEPS[clamped]
      const nextStatus = options?.status ?? 'active'
      const shouldNavigate = options?.navigate === true

      setStep(clamped)
      setStatus(nextStatus)
      setVisible(true)
      setShowDeferred(false)
      setDeferredReason(null)

      if (
        shouldNavigate &&
        def.href &&
        !pathReadyForStep(pathname, def.href)
      ) {
        setAwaitingPath(def.href)
        syncingPath.current = true
        // Prefetch first so replace can reuse a warm Flight payload.
        try {
          router.prefetch(def.href)
        } catch {
          /* best-effort */
        }
        router.replace(def.href)
      } else {
        setAwaitingPath(null)
        syncingPath.current = false
        if (def.href && !pathReadyForStep(pathname, def.href)) {
          setVisible(false)
        }
      }

      if (options?.persist !== false) {
        persistQuiet(clamped, nextStatus)
      }
    },
    [pathname, persistQuiet, router],
  )

  const startTour = useCallback(
    (fromStep = 0) => {
      const def = APP_TOUR_STEPS[fromStep]
      if (def?.href && !pathReadyForStep(pathname, def.href)) {
        setStep(fromStep)
        setStatus('deferred')
        setVisible(false)
        setShowDeferred(true)
        setDeferredReason('wrong-route')
        void deferAppTourAction(fromStep)
        return
      }
      goToStep(fromStep, { status: 'active', navigate: false })
    },
    [goToStep, pathname],
  )

  const offerTour = useCallback(
    async (fromStep: number) => {
      if (!activeReady) return
      // Offline floors: never surface tour chrome (including the "active
      // session" deferred sheet — confusing when there's no workout).
      if (shouldBlockTourAutoOffer(online, pathname)) {
        setVisible(false)
        setShowDeferred(false)
        setDeferredReason(null)
        return
      }
      if (active) {
        setShowDeferred(true)
        setDeferredReason('active-session')
        setVisible(false)
        setStep(fromStep)
        await deferAppTourAction(fromStep)
        setStatus('deferred')
        return
      }
      startTour(fromStep)
    },
    [active, activeReady, online, pathname, startTour],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const state = await getAppTourStateAction()
      if (cancelled) return
      setStatus(state.status)
      setStep(state.step)
      setHydrated(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const statusRef = useRef(status)
  const stepRef = useRef(step)
  const offerTourRef = useRef(offerTour)
  useEffect(() => {
    statusRef.current = status
    stepRef.current = step
    offerTourRef.current = offerTour
  }, [status, step, offerTour])

  // Drop any leftover tour UI the moment we hit offline / /offline shell.
  useEffect(() => {
    if (!offlineHydrated) return
    if (!shouldBlockTourAutoOffer(online, pathname)) return
    setVisible(false)
    setShowDeferred(false)
    setDeferredReason(null)
  }, [offlineHydrated, online, pathname])

  useEffect(() => {
    if (!hydrated || !activeReady || !guestReady || !offlineHydrated) return
    if (isGuest) return

    // Guests are excluded; offline floors are excluded the same way.
    if (shouldBlockTourAutoOffer(online, pathname)) {
      setVisible(false)
      setShowDeferred(false)
      setDeferredReason(null)
      // Do not set bootstrapped — allow a real offer after reconnect.
      return
    }

    const wantsTourParam = searchParams.get('tour') === '1'
    if (wantsTourParam) {
      forceOffer.current = true
      const url = new URL(window.location.href)
      url.searchParams.delete('tour')
      window.history.replaceState({}, '', url.pathname + url.search)
      void offerTourRef.current(stepRef.current)
      bootstrapped.current = true
      return
    }

    if (bootstrapped.current) return
    bootstrapped.current = true

    const currentStatus = statusRef.current
    const currentPath = pathname

    if (currentStatus === 'active') {
      const savedStep = stepRef.current
      const def = APP_TOUR_STEPS[savedStep]
      if (def?.href && pathReadyForStep(currentPath, def.href)) {
        setVisible(true)
        setShowDeferred(false)
        setDeferredReason(null)
        return
      }
      const onPage = syncStepToPathname(currentPath)
      if (onPage !== null) {
        setStep(onPage)
        setVisible(true)
        setShowDeferred(false)
        setDeferredReason(null)
        void persistQuiet(onPage, 'active')
        return
      }
      setVisible(false)
      setShowDeferred(false)
      setDeferredReason(null)
      return
    }

    // The full tour starts only from Settings or an explicit ?tour=1.
    const shouldOffer = forceOffer.current

    if (!shouldOffer) {
      setVisible(false)
      setShowDeferred(false)
      setDeferredReason(null)
      return
    }

    const def = APP_TOUR_STEPS[stepRef.current]
    if (def?.href && !pathReadyForStep(currentPath, def.href)) {
      // Wrong route for the saved step — show the pause sheet once for
      // this offer (pending / forced). Active-session copy stays separate.
      setShowDeferred(true)
      setDeferredReason('wrong-route')
      setVisible(false)
      if (currentStatus === 'pending') {
        void deferAppTourAction(stepRef.current).then((result) => {
          if (result.ok) setStatus(result.status)
        })
      }
      return
    }

    void offerTourRef.current(stepRef.current)
  }, [
    hydrated,
    activeReady,
    guestReady,
    offlineHydrated,
    isGuest,
    online,
    searchParams,
    pathname,
    persistQuiet,
  ])

  const prevActiveRef = useRef(active)
  useEffect(() => {
    const wasActive = Boolean(prevActiveRef.current)
    prevActiveRef.current = active
    if (!hydrated || !activeReady || !offlineHydrated) return
    if (shouldBlockTourAutoOffer(online, pathname)) return
    if (status !== 'deferred') return
    if (active || !wasActive) return
    if (visible || showDeferred) return
    void offerTour(step)
  }, [
    hydrated,
    activeReady,
    offlineHydrated,
    online,
    pathname,
    status,
    active,
    visible,
    showDeferred,
    step,
    offerTour,
  ])

  useEffect(() => {
    if (!awaitingPath) return
    if (pathReadyForStep(pathname, awaitingPath)) {
      setAwaitingPath(null)
      syncingPath.current = false
    }
  }, [pathname, awaitingPath])

  useEffect(() => {
    if (!awaitingPath) return
    // Step navigation gave up (Stay) or landed elsewhere — re-sync to the page shown.
    return subscribeNavigationSettled(() => {
      setAwaitingPath(null)
      syncingPath.current = false
    })
  }, [awaitingPath])

  useEffect(() => {
    if (!visible || awaitingPath || syncingPath.current) return
    const def = APP_TOUR_STEPS[step]
    if (pathReadyForStep(pathname, def?.href ?? null)) return

    const matchIdx = syncStepToPathname(pathname)
    if (matchIdx !== null) {
      setStep(matchIdx)
      void persistQuiet(matchIdx, 'active')
      return
    }

    setVisible(false)
    void deferAppTourAction(step).then((result) => {
      if (result.ok) {
        setStatus(result.status)
        setStep(result.step)
      }
    })
  }, [pathname, visible, awaitingPath, step, persistQuiet])

  const onNext = useCallback(() => {
    const next = Math.min(APP_TOUR_STEPS.length - 1, step + 1)
    goToStep(next, { navigate: true })
  }, [goToStep, step])

  const onBack = useCallback(() => {
    const prev = Math.max(0, step - 1)
    goToStep(prev, { navigate: true })
  }, [goToStep, step])

  const releaseTourScrollLock = useCallback(() => {
    releaseAppScrollLock()
  }, [])

  // Runs after TourOverlay unmount — also schedule one frame later to beat races.
  useEffect(() => {
    if (visible || showDeferred) return
    releaseTourScrollLock()
    const id = requestAnimationFrame(() => {
      releaseTourScrollLock()
    })
    return () => cancelAnimationFrame(id)
  }, [visible, showDeferred, releaseTourScrollLock])

  useEffect(() => {
    if (visible) return
    releaseTourScrollLock()
  }, [pathname, visible, releaseTourScrollLock])

  const onSkip = useCallback(async () => {
    beginBusy()
    try {
      clearPendingPersist()
      const result = await skipAppTourAction()
      if (result.ok) {
        setStatus(result.status)
        setStep(result.step)
      }
      setVisible(false)
      setShowDeferred(false)
      setDeferredReason(null)
      releaseTourScrollLock()
      router.replace('/dashboard/home')
    } finally {
      endBusy()
    }
  }, [beginBusy, clearPendingPersist, endBusy, releaseTourScrollLock, router])

  const onDismiss = useCallback(async () => {
    beginBusy()
    try {
      clearPendingPersist()
      const result = await deferAppTourAction(step)
      if (result.ok) {
        setStatus(result.status)
        setStep(result.step)
      }
      setVisible(false)
      setShowDeferred(false)
      setDeferredReason(null)
      releaseTourScrollLock()
      router.replace('/dashboard/home')
    } finally {
      endBusy()
    }
  }, [beginBusy, clearPendingPersist, endBusy, releaseTourScrollLock, router, step])

  const onFinish = useCallback(
    async (destination: 'home' | 'workout' | 'coach') => {
      beginBusy()
      try {
        clearPendingPersist()
        const result = await completeAppTourAction()
        if (result.ok) {
          setStatus(result.status)
          setStep(result.step)
        }
        setVisible(false)
        setDeferredReason(null)
        releaseTourScrollLock()
        const href =
          destination === 'workout'
            ? '/dashboard/workout'
            : destination === 'coach'
              ? '/dashboard/ai-coach'
              : '/dashboard/home'
        router.replace(href)
      } finally {
        endBusy()
      }
    },
    [beginBusy, clearPendingPersist, endBusy, releaseTourScrollLock, router],
  )

  const onStartLater = useCallback(async () => {
    beginBusy()
    try {
      clearPendingPersist()
      // Skip (not defer): "later" must not reappear on every cold start.
      // Athletes can still restart the tour from Settings.
      const result = await skipAppTourAction()
      if (result.ok) {
        setStatus(result.status)
        setStep(result.step)
      }
      setShowDeferred(false)
      setDeferredReason(null)
      setVisible(false)
      releaseTourScrollLock()
    } finally {
      endBusy()
    }
  }, [beginBusy, clearPendingPersist, endBusy, releaseTourScrollLock])

  const onStartNow = useCallback(async () => {
    const def = APP_TOUR_STEPS[step]
    if (def?.href && !pathReadyForStep(pathname, def.href)) {
      goToStep(step, { status: 'active', navigate: true })
      return
    }
    startTour(step)
  }, [goToStep, pathname, startTour, step])

  const restartTour = useCallback(async () => {
    if (isGuest) return
    beginBusy()
    try {
      const result = await restartAppTourAction()
      if (result.ok) {
        setStatus(result.status)
        setStep(result.step)
      }
      bootstrapped.current = true
      await offerTour(0)
      if (pathname !== '/dashboard/home') {
        router.replace('/dashboard/home')
      }
    } finally {
      endBusy()
    }
  }, [beginBusy, endBusy, offerTour, pathname, router, isGuest])

  const ctx = useMemo(
    () => ({
      restartTour,
      isTourVisible: visible,
    }),
    [restartTour, visible],
  )

  const stepDef = APP_TOUR_STEPS[step]
  const pathOk = pathReadyForStep(pathname, stepDef?.href ?? null)
  const tourBlocked = shouldBlockTourAutoOffer(online, pathname)
  const showOverlay =
    !tourBlocked && visible && (pathOk || awaitingPath !== null)
  const showDeferredBanner = !tourBlocked && showDeferred

  // Warm every tour route as soon as the tour is visible so Next/Back feel instant.
  useEffect(() => {
    if (!visible || tourBlocked) return
    const hrefs = new Set<string>()
    for (const tourStep of APP_TOUR_STEPS) {
      if (tourStep.href) hrefs.add(tourStep.href)
    }
    for (const href of hrefs) {
      try {
        router.prefetch(href)
      } catch {
        /* prefetch is best-effort */
      }
    }
  }, [visible, tourBlocked, router])

  // Keep the immediate next/prev warm even if the full set was already prefetched.
  useEffect(() => {
    if (!visible || tourBlocked) return
    for (const i of [step - 1, step + 1, step + 2]) {
      const href = APP_TOUR_STEPS[i]?.href
      if (!href) continue
      try {
        router.prefetch(href)
      } catch {
        /* prefetch is best-effort */
      }
    }
  }, [visible, tourBlocked, step, router])

  return (
    <AppTourContext.Provider value={ctx}>
      {children}
      {showDeferredBanner ? (
        <TourDeferredBanner
          busy={busy}
          reason={deferredReason ?? 'wrong-route'}
          onStartLater={onStartLater}
          onStartNow={onStartNow}
        />
      ) : null}
      {showOverlay ? (
        <TourOverlay
          stepIndex={step}
          busy={busy}
          isTransitioning={awaitingPath !== null}
          onNext={onNext}
          onBack={onBack}
          onSkip={onSkip}
          onDismiss={onDismiss}
          onFinish={onFinish}
        />
      ) : null}
    </AppTourContext.Provider>
  )
}
