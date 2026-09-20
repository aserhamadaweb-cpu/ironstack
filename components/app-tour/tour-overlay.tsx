'use client'

import { useEffect, useId, useRef } from 'react'
import { useTranslations } from 'next-intl'
import {
  lockTourScroll,
  registerTourKeydownTrap,
  unregisterTourKeydownTrap,
} from '@/lib/app-tour-scroll-lock'
import {
  APP_TOUR_CLOSE_SIDEBAR_EVENT,
  APP_TOUR_OPEN_SIDEBAR_EVENT,
  APP_TOUR_STEPS,
} from '@/lib/app-tour'
import { TourCoachMark } from '@/components/app-tour/tour-coach-mark'

type TourOverlayProps = {
  stepIndex: number
  busy: boolean
  isTransitioning: boolean
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onDismiss: () => void
  onFinish: (destination: 'home' | 'workout' | 'coach') => void
}

export function TourOverlay({
  stepIndex,
  busy,
  isTransitioning,
  onNext,
  onBack,
  onSkip,
  onDismiss,
  onFinish,
}: TourOverlayProps) {
  const titleId = useId()
  const step = APP_TOUR_STEPS[stepIndex] ?? APP_TOUR_STEPS[0]

  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    lockTourScroll()
    const ac = registerTourKeydownTrap(() => onDismissRef.current())

    return () => {
      unregisterTourKeydownTrap(ac)
      window.dispatchEvent(new CustomEvent(APP_TOUR_CLOSE_SIDEBAR_EVENT))
    }
  }, [])

  useEffect(() => {
    if (step.openSidebar) {
      window.dispatchEvent(new CustomEvent(APP_TOUR_OPEN_SIDEBAR_EVENT))
    } else {
      window.dispatchEvent(new CustomEvent(APP_TOUR_CLOSE_SIDEBAR_EVENT))
    }
  }, [stepIndex, step.openSidebar])

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[90]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <TourCoachMark
        step={step}
        stepIndex={stepIndex}
        busy={busy}
        isTransitioning={isTransitioning}
        onNext={onNext}
        onBack={onBack}
        onSkip={onSkip}
        onFinish={onFinish}
        titleId={titleId}
      />
    </div>
  )
}

type TourDeferredBannerProps = {
  busy: boolean
  /** active-session = real workout; wrong-route = tour waiting for the right page. */
  reason?: 'active-session' | 'wrong-route'
  onStartLater: () => void
  onStartNow: () => void
}

export function TourDeferredBanner({
  busy,
  reason = 'wrong-route',
  onStartLater,
  onStartNow,
}: TourDeferredBannerProps) {
  const t = useTranslations('tour')
  const title =
    reason === 'active-session' ? t('deferredTitle') : t('deferredRouteTitle')
  const body =
    reason === 'active-session' ? t('deferredBody') : t('deferredRouteBody')
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-[85] mx-auto w-[min(100%-1.5rem,28rem)] rounded-2xl border border-gold/30 bg-card/95 p-4 shadow-xl"
    >
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onStartLater}
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full border border-silver/25 px-3 text-[10px] font-semibold tracking-[0.1em] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
        >
          {t('startLater')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onStartNow}
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full bg-gold px-3 text-[10px] font-bold tracking-[0.1em] text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
        >
          {t('startNow')}
        </button>
      </div>
    </div>
  )
}
