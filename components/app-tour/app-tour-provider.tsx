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
  completeAppTourAction,
  deferAppTourAction,
  getAppTourStateAction,
  restartAppTourAction,
  saveAppTourProgressAction,
  skipAppTourAction,
} from '@/lib/data/tour-actions'
import { useIsGuest } from '@/components/use-is-guest'
import { useActiveWorkout } from '@/lib/use-active-workout'
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

export function AppTourProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isGuest, ready: guestReady } = useIsGuest()
  const { active, ready: activeReady } = useActiveWorkout()

  const [status, setStatus] = useState<AppTourStatus | null>(null)
  const [step, setStep] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const [busy, setBusy] = useState(false)
  const [visible, setVisible] = useState(false)
  const [showDeferred, setShowDeferred] = useState(false)
  const [awaitingPath, setAwaitingPath] = useState<string | null>(null)
  const bootstrapped = useRef(false)
  const forceOffer = useRef(false)
  const busyDepth = useRef(0)
  const syncingPath = useRef(false)

  const beginBusy = useCallback(() => {
    busyDepth.current += 1
    setBusy(true)
  }, [])

  const endBusy = useCallback(() => {
    busyDepth.current = Math.max(0, busyDepth.current - 1)
    if (busyDepth.current === 0) setBusy(false)
  }, [])

  const persistQuiet = useCallback(
    async (nextStep: number, nextStatus: AppTourStatus = 'active') => {
      const result = await saveAppTourProgressAction(nextStep, nextStatus)
      if (result.ok) {
        setStatus(result.status)
        setStep(result.step)
        return true
      }
      return false
    },
    [],
  )

  const persist = useCallback(
    async (nextStep: number, nextStatus: AppTourStatus = 'active') => {
      beginBusy()
      try {
        return await persistQuiet(nextStep, nextStatus)
      } finally {
        endBusy()
      }
    },
    [beginBusy, endBusy, persistQuiet],
  )

  const goToStep = useCallback(
    (
      nextStep: number,
      options?: { persist?: boolean; status?: AppTourStatus },
    ) => {
      const clamped = Math.max(0, Math.min(APP_TOUR_STEPS.length - 1, nextStep))
      const def = APP_TOUR_STEPS[clamped]
      const nextStatus = options?.status ?? 'active'

      setStep(clamped)
      setStatus(nextStatus)
      setVisible(true)
      setShowDeferred(false)

      if (def.href && !pathReadyForStep(pathname, def.href)) {
        setAwaitingPath(def.href)
        syncingPath.current = true
        router.replace(def.href)
      } else {
        setAwaitingPath(null)
      }

      if (options?.persist !== false) {
        void persistQuiet(clamped, nextStatus)
      }
    },
    [pathname, persistQuiet, router],
  )

  const startTour = useCallback(
    (fromStep = 0) => {
      goToStep(fromStep, { status: 'active' })
    },
    [goToStep],
  )

  const offerTour = useCallback(
    async (fromStep: number) => {
      if (!activeReady) return
      if (active) {
        setShowDeferred(true)
        setVisible(false)
        setStep(fromStep)
        await deferAppTourAction(fromStep)
        setStatus('deferred')
        return
      }
      startTour(fromStep)
    },
    [active, activeReady, startTour],
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

  useEffect(() => {
    if (!hydrated || !activeReady || !guestReady) return
    if (isGuest) return

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
    const shouldOffer =
      forceOffer.current ||
      currentStatus === 'pending' ||
      currentStatus === 'active' ||
      currentStatus === 'deferred'

    if (!shouldOffer) return

    void offerTourRef.current(stepRef.current)
  }, [hydrated, activeReady, guestReady, isGuest, searchParams])

  const prevActiveRef = useRef(active)
  useEffect(() => {
    const wasActive = Boolean(prevActiveRef.current)
    prevActiveRef.current = active
    if (!hydrated || !activeReady) return
    if (status !== 'deferred') return
    if (active || !wasActive) return
    if (visible || showDeferred) return
    void offerTour(step)
  }, [
    hydrated,
    activeReady,
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
    if (!visible || awaitingPath || syncingPath.current) return
    const def = APP_TOUR_STEPS[step]
    if (pathReadyForStep(pathname, def?.href ?? null)) return

    const matchIdx = APP_TOUR_STEPS.findIndex(
      (s) => s.href && pathReadyForStep(pathname, s.href),
    )
    if (matchIdx >= 0) {
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
    goToStep(next)
  }, [goToStep, step])

  const onBack = useCallback(() => {
    const prev = Math.max(0, step - 1)
    goToStep(prev)
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
      const result = await skipAppTourAction()
      if (result.ok) {
        setStatus(result.status)
        setStep(result.step)
      }
      setVisible(false)
      setShowDeferred(false)
      releaseTourScrollLock()
      router.replace('/dashboard/home')
    } finally {
      endBusy()
    }
  }, [beginBusy, endBusy, releaseTourScrollLock, router])

  const onDismiss = useCallback(async () => {
    beginBusy()
    try {
      const result = await deferAppTourAction(step)
      if (result.ok) {
        setStatus(result.status)
        setStep(result.step)
      }
      setVisible(false)
      setShowDeferred(false)
      releaseTourScrollLock()
      router.replace('/dashboard/home')
    } finally {
      endBusy()
    }
  }, [beginBusy, endBusy, releaseTourScrollLock, router, step])

  const onFinish = useCallback(
    async (destination: 'home' | 'workout' | 'coach') => {
      beginBusy()
      try {
        const result = await completeAppTourAction()
        if (result.ok) {
          setStatus(result.status)
          setStep(result.step)
        }
        setVisible(false)
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
    [beginBusy, endBusy, releaseTourScrollLock, router],
  )

  const onStartLater = useCallback(async () => {
    beginBusy()
    try {
      const result = await deferAppTourAction(step)
      if (result.ok) {
        setStatus(result.status)
        setStep(result.step)
      }
      setShowDeferred(false)
    } finally {
      endBusy()
    }
  }, [beginBusy, endBusy, step])

  const onStartNow = useCallback(async () => {
    startTour(step)
  }, [startTour, step])

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
  const showOverlay = visible && (pathOk || awaitingPath !== null)

  return (
    <AppTourContext.Provider value={ctx}>
      {children}
      {showDeferred ? (
        <TourDeferredBanner
          busy={busy}
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
