'use client'

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { Loader2, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { AppTourStepDef } from '@/lib/app-tour'
import { APP_TOUR_STEP_COUNT } from '@/lib/app-tour'
import { TourCoachMarkContent } from '@/components/app-tour/tour-step-content'
import {
  coachMarkScrollReservePx,
  computeCoachMarkTooltipStyle,
  findTourTarget,
  rectFromElement,
  TOUR_TARGET_POLL_INTERVAL_MS,
  TOUR_TARGET_POLL_MAX_ATTEMPTS,
  type SpotlightRect,
  type TooltipPlacement,
} from '@/components/app-tour/tour-target'

type TargetLocateState = 'pending' | 'found' | 'missed'

function TourCutoutBackdrop({ spot }: { spot: SpotlightRect | null }) {
  const panelClass =
    'pointer-events-auto absolute bg-black/50 transition-[top,left,width,height] duration-300 ease-out'

  if (!spot) {
    return <div className={`${panelClass} inset-0`} aria-hidden="true" />
  }

  const bottom = spot.top + spot.height
  const right = spot.left + spot.width

  return (
    <>
      <div className={panelClass} style={{ top: 0, left: 0, right: 0, height: spot.top }} />
      <div
        className={panelClass}
        style={{ top: bottom, left: 0, right: 0, bottom: 0 }}
      />
      <div
        className={panelClass}
        style={{ top: spot.top, left: 0, width: spot.left, height: spot.height }}
      />
      <div
        className={panelClass}
        style={{ top: spot.top, left: right, right: 0, height: spot.height }}
      />
    </>
  )
}

function TourSpotlightRing({ spot }: { spot: SpotlightRect }) {
  const spotStyle: CSSProperties = {
    top: spot.top,
    left: spot.left,
    width: spot.width,
    height: spot.height,
  }

  return (
    <div
      className="pointer-events-none absolute rounded-xl border-2 border-gold ring-2 ring-gold/35 transition-[top,left,width,height] duration-300 ease-out"
      style={spotStyle}
      aria-hidden="true"
    />
  )
}

function TooltipArrow({
  placement,
  spot,
  tooltipLeft,
  tooltipWidth,
}: {
  placement: TooltipPlacement
  spot: SpotlightRect
  tooltipLeft: number
  tooltipWidth: number
}) {
  const targetCenterX = spot.left + spot.width / 2
  const arrowLeft = Math.max(
    16,
    Math.min(tooltipWidth - 24, targetCenterX - tooltipLeft - 8),
  )

  return (
    <span
      className="absolute size-3 rotate-45 border border-gold/30 bg-card"
      style={{
        left: arrowLeft,
        ...(placement === 'top'
          ? { bottom: -6, borderTop: 'none', borderLeft: 'none' }
          : { top: -6, borderBottom: 'none', borderRight: 'none' }),
      }}
      aria-hidden="true"
    />
  )
}

type TourCoachMarkControlsProps = {
  stepIndex: number
  busy: boolean
  isTransitioning: boolean
  isDone: boolean
  onBack: () => void
  onNext: () => void
  onSkip: () => void
  onFinish: (destination: 'home' | 'workout' | 'coach') => void
}

function TourCoachMarkControls({
  stepIndex,
  busy,
  isTransitioning,
  isDone,
  onBack,
  onNext,
  onSkip,
  onFinish,
}: TourCoachMarkControlsProps) {
  const t = useTranslations('tour')
  const showBack = stepIndex > 0

  if (isDone) {
    return (
      <div className="mt-3 grid gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onFinish('home')}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-gold px-3 text-[11px] font-bold tracking-[0.12em] text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {t('goDashboard')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onFinish('workout')}
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-gold/35 bg-gold/10 px-3 text-[11px] font-semibold tracking-[0.1em] text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-60"
        >
          {t('exploreWorkouts')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onFinish('coach')}
          className="inline-flex min-h-9 items-center justify-center rounded-full border border-silver/25 px-3 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-60"
        >
          {t('askCoach')}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-3 flex gap-2">
      {showBack ? (
        <button
          type="button"
          disabled={busy || isTransitioning}
          onClick={onBack}
          className="inline-flex min-h-9 flex-1 items-center justify-center rounded-full border border-silver/25 px-3 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50"
        >
          {t('back')}
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy || isTransitioning}
        onClick={onNext}
        className={`inline-flex min-h-9 items-center justify-center rounded-full bg-gold px-3 text-[11px] font-bold tracking-[0.12em] text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-60 ${
          showBack ? 'flex-[1.4]' : 'flex-1'
        }`}
      >
        {t('next')}
      </button>
    </div>
  )
}

function TourCoachMarkShell({
  stepIndex,
  busy,
  isTransitioning,
  isDone,
  onBack,
  onNext,
  onSkip,
  onFinish,
  titleId,
  children,
  tooltipStyle,
  tooltipPlacement,
  spot,
  showArrow,
  centered,
}: {
  stepIndex: number
  busy: boolean
  isTransitioning: boolean
  isDone: boolean
  onBack: () => void
  onNext: () => void
  onSkip: () => void
  onFinish: (destination: 'home' | 'workout' | 'coach') => void
  titleId: string
  children: ReactNode
  tooltipStyle?: CSSProperties
  tooltipPlacement?: TooltipPlacement
  spot?: SpotlightRect | null
  showArrow?: boolean
  centered?: boolean
}) {
  const t = useTranslations('tour')
  const tooltipRef = useRef<HTMLDivElement>(null)
  const progressLabel = t('stepOf', {
    current: stepIndex + 1,
    total: APP_TOUR_STEP_COUNT,
  })

  useEffect(() => {
    tooltipRef.current?.focus()
  }, [stepIndex])

  function trapFocus(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab' || !tooltipRef.current) return
    const focusable = tooltipRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      ref={tooltipRef}
      tabIndex={-1}
      role="document"
      onKeyDown={trapFocus}
      className={`pointer-events-auto absolute z-[1] rounded-xl border border-gold/30 bg-card/98 shadow-[0_12px_40px_rgba(0,0,0,0.45)] outline-none backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-gold/40 ${
        isDone || centered
          ? 'inset-x-4 top-1/2 mx-auto w-[min(100%-2rem,20rem)] max-w-sm -translate-y-1/2'
          : ''
      }`}
      style={isDone || centered ? undefined : tooltipStyle}
    >
      {showArrow && spot && tooltipPlacement && tooltipStyle ? (
        <TooltipArrow
          placement={tooltipPlacement}
          spot={spot}
          tooltipLeft={Number(tooltipStyle.left) || 0}
          tooltipWidth={Number(tooltipStyle.width) || 280}
        />
      ) : null}

      <div className="px-3.5 pb-3 pt-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[9px] font-bold tracking-[0.2em] text-gold">
            {t('kicker')} · {progressLabel}
          </p>
          {!isDone ? (
            <button
              type="button"
              onClick={onSkip}
              disabled={busy}
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-silver/20 text-muted-foreground transition hover:border-gold/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50"
              aria-label={t('skip')}
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        <div id={titleId}>{children}</div>

        <TourCoachMarkControls
          stepIndex={stepIndex}
          busy={busy}
          isTransitioning={isTransitioning}
          isDone={isDone}
          onBack={onBack}
          onNext={onNext}
          onSkip={onSkip}
          onFinish={onFinish}
        />
      </div>
    </div>
  )
}

function TourLoadingContent() {
  const t = useTranslations('tour')
  return (
    <div className="flex min-h-[4rem] items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
      <Loader2 className="size-4 animate-spin text-gold" aria-hidden="true" />
      {t('loadingStep')}
    </div>
  )
}

function TourTargetMissedContent() {
  const t = useTranslations('tour')
  return (
    <div className="min-w-0">
      <p className="text-xs leading-relaxed text-muted-foreground">
        {t('targetMissed')}
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/80">
        {t('targetMissedAction')}
      </p>
    </div>
  )
}

type TourCoachMarkProps = {
  step: AppTourStepDef
  stepIndex: number
  busy: boolean
  isTransitioning: boolean
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onFinish: (destination: 'home' | 'workout' | 'coach') => void
  titleId: string
}

export function TourCoachMark({
  step,
  stepIndex,
  busy,
  isTransitioning,
  onNext,
  onBack,
  onSkip,
  onFinish,
  titleId,
}: TourCoachMarkProps) {
  const isDone = step.id === 'done'
  const [spot, setSpot] = useState<SpotlightRect | null>(null)
  const [tooltipLayout, setTooltipLayout] = useState<ReturnType<
    typeof computeCoachMarkTooltipStyle
  > | null>(null)
  const [locateState, setLocateState] = useState<TargetLocateState>('pending')

  useEffect(() => {
    if (isDone || !step.target) {
      setSpot(null)
      setTooltipLayout(null)
      setLocateState('pending')
      return
    }

    if (isTransitioning) {
      setSpot(null)
      setTooltipLayout(null)
      setLocateState('pending')
      return
    }

    let cancelled = false
    let raf = 0
    let pollTimer = 0
    let attempt = 0

    setLocateState('pending')
    setSpot(null)
    setTooltipLayout(null)

    const markFound = (rect: SpotlightRect) => {
      setLocateState('found')
      setSpot(rect)
      setTooltipLayout(
        computeCoachMarkTooltipStyle(
          rect,
          window.innerWidth,
          window.innerHeight,
        ),
      )
    }

    const measureOnly = () => {
      if (cancelled) return
      const el = findTourTarget(step.target)
      if (el) markFound(rectFromElement(el))
    }

    const bringIntoViewThenMeasure = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect()
      const reserve = coachMarkScrollReservePx()
      const needsScroll =
        rect.top < 72 || rect.bottom > window.innerHeight - reserve
      if (needsScroll) {
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'auto' })
      }
      markFound(rectFromElement(el))
      raf = requestAnimationFrame(() => {
        if (cancelled) return
        markFound(rectFromElement(el))
      })
    }

    const markMissed = () => {
      setLocateState('missed')
      setSpot(null)
      setTooltipLayout(null)
    }

    const tryLocate = () => {
      if (cancelled) return
      const el = findTourTarget(step.target)
      if (el) {
        bringIntoViewThenMeasure(el)
        return
      }
      attempt += 1
      if (attempt >= TOUR_TARGET_POLL_MAX_ATTEMPTS) {
        markMissed()
        return
      }
      pollTimer = window.setTimeout(tryLocate, TOUR_TARGET_POLL_INTERVAL_MS)
    }

    pollTimer = window.setTimeout(tryLocate, 80)

    const scheduleMeasure = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measureOnly)
    }
    window.addEventListener('resize', scheduleMeasure)
    window.addEventListener('scroll', scheduleMeasure, true)

    return () => {
      cancelled = true
      window.clearTimeout(pollTimer)
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('scroll', scheduleMeasure, true)
    }
  }, [step.target, stepIndex, isTransitioning, isDone])

  const showSpotlight =
    locateState === 'found' && Boolean(spot && !isTransitioning && !isDone)

  const stepContent = isTransitioning ? (
    <TourLoadingContent />
  ) : locateState === 'missed' ? (
    <>
      <TourCoachMarkContent step={step} />
      <div className="mt-2 border-t border-silver/10 pt-2">
        <TourTargetMissedContent />
      </div>
    </>
  ) : locateState === 'pending' ? (
    <TourLoadingContent />
  ) : (
    <TourCoachMarkContent step={step} />
  )

  const shellProps = {
    stepIndex,
    busy,
    isTransitioning,
    isDone,
    onBack,
    onNext,
    onSkip,
    onFinish,
    titleId,
  }

  if (isDone) {
    return (
      <>
        <div
          className="pointer-events-auto absolute inset-0 bg-black/50"
          aria-hidden="true"
        />
        <TourCoachMarkShell {...shellProps} isDone>
          <TourCoachMarkContent step={step} />
        </TourCoachMarkShell>
      </>
    )
  }

  if (isTransitioning || locateState === 'missed') {
    return (
      <>
        <TourCutoutBackdrop spot={null} />
        <TourCoachMarkShell {...shellProps} centered>
          {stepContent}
        </TourCoachMarkShell>
      </>
    )
  }

  if (locateState === 'pending') {
    return (
      <>
        <TourCutoutBackdrop spot={null} />
        <TourCoachMarkShell {...shellProps} centered>
          <TourLoadingContent />
        </TourCoachMarkShell>
      </>
    )
  }

  return (
    <>
      <TourCutoutBackdrop spot={spot} />
      {showSpotlight && spot ? <TourSpotlightRing spot={spot} /> : null}
      {tooltipLayout ? (
        <TourCoachMarkShell
          {...shellProps}
          tooltipStyle={tooltipLayout.style}
          tooltipPlacement={tooltipLayout.placement}
          spot={spot}
          showArrow
        >
          <TourCoachMarkContent step={step} />
        </TourCoachMarkShell>
      ) : null}
    </>
  )
}
