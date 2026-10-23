'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  detectInstallTutorialPlatform,
  tutorialStepsForPlatform,
  type InstallTutorialPlatform,
  type InstallTutorialStepDef,
} from '@/lib/install-tutorial'

type InstallTutorialProps = {
  /** Override auto-detected platform (e.g. preview). */
  platform?: InstallTutorialPlatform
  className?: string
  /** Large photo-first layout for the iPhone install sheet. */
  prominent?: boolean
  onClose?: () => void
}

function StepImage({
  src,
  alt,
  onMissing,
  prominent,
}: {
  src: string
  alt: string
  onMissing: () => void
  prominent?: boolean
}) {
  return (
    <div
      className={`relative mx-auto w-full ${
        prominent ? 'max-w-[min(100%,28rem)]' : 'max-w-[min(100%,20rem)]'
      }`}
    >
      <div
        className={`relative w-full overflow-hidden rounded-2xl border border-gold/35 bg-black shadow-[0_0_0_1px_rgba(212,175,55,0.15),0_18px_50px_-20px_rgba(0,0,0,0.85)] ${
          prominent ? 'aspect-[9/16]' : 'aspect-[9/19.5] rounded-xl border-silver/20'
        }`}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes={
            prominent
              ? '(max-width: 480px) 96vw, 448px'
              : '(max-width: 375px) 100vw, 320px'
          }
          className="object-contain object-top"
          onError={onMissing}
          priority
        />
      </div>
    </div>
  )
}

export function InstallTutorial({
  platform,
  className = '',
  prominent = false,
  onClose,
}: InstallTutorialProps) {
  const t = useTranslations('installTutorial')
  const resolvedPlatform = platform ?? detectInstallTutorialPlatform()
  const stepDefs = useMemo(
    () => tutorialStepsForPlatform(resolvedPlatform),
    [resolvedPlatform],
  )
  const [stepIndex, setStepIndex] = useState(0)
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setStepIndex(0)
    setBrokenImages({})
  }, [resolvedPlatform])

  const markBroken = useCallback((id: string) => {
    setBrokenImages((prev) => ({ ...prev, [id]: true }))
  }, [])

  if (resolvedPlatform === 'generic' || stepDefs.length === 0) {
    return (
      <p className={`text-sm leading-relaxed text-muted-foreground ${className}`}>
        {t('generic.body')}
      </p>
    )
  }

  const current: InstallTutorialStepDef = stepDefs[stepIndex]!
  const stepKey = `${resolvedPlatform}.${current.id}` as const
  const title = t(`${stepKey}.title`)
  const caption = t(`${stepKey}.caption`)
  const hasImageSlot = current.imageSrc != null
  const showImage = hasImageSlot && !brokenImages[current.id]
  const isLast = stepIndex >= stepDefs.length - 1

  return (
    <div
      className={`flex w-full flex-col ${
        prominent ? 'max-w-none gap-4' : 'max-w-[min(100%,23rem)]'
      } ${hasImageSlot && !prominent ? 'gap-3' : ''} ${
        !hasImageSlot ? 'gap-4' : ''
      } ${className}`}
      data-install-tutorial={resolvedPlatform}
      data-install-layout={hasImageSlot ? 'image' : 'text'}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.28em] text-gold uppercase">
            {t('title')}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('stepOf', { current: stepIndex + 1, total: stepDefs.length })}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('close')}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-silver/20 text-muted-foreground transition hover:border-gold/40 hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* Progress bar — mirrors the baked-in photo headers for clarity */}
      <div className="h-1 overflow-hidden rounded-full bg-silver/20">
        <div
          className="h-full rounded-full bg-gold transition-all duration-300"
          style={{
            width: `${((stepIndex + 1) / stepDefs.length) * 100}%`,
          }}
        />
      </div>

      {hasImageSlot ? (
        <>
          <div className="space-y-1.5 text-center sm:text-start">
            <h3
              className={`font-semibold text-foreground ${
                prominent ? 'font-heading text-xl sm:text-2xl' : 'text-sm'
              }`}
            >
              {title}
            </h3>
            <p
              className={`leading-relaxed text-muted-foreground ${
                prominent ? 'text-sm sm:text-base' : 'text-xs'
              }`}
            >
              {caption}
            </p>
          </div>
          {showImage ? (
            <StepImage
              src={current.imageSrc!}
              alt={title}
              prominent={prominent}
              onMissing={() => markBroken(current.id)}
            />
          ) : null}
        </>
      ) : (
        <div className="rounded-xl border border-silver/15 bg-background/50 px-4 py-4 sm:px-5 sm:py-5">
          <h3 className="font-heading text-base font-semibold leading-snug text-foreground sm:text-lg">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {caption}
          </p>
        </div>
      )}

      {stepDefs.length > 1 ? (
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            disabled={stepIndex <= 0}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            aria-label={t('previous')}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-silver/20 px-3 text-sm text-muted-foreground transition hover:border-gold/35 hover:text-foreground disabled:opacity-40"
          >
            <ChevronLeft className="size-4 rtl-flip" aria-hidden="true" />
            {prominent ? t('previous') : null}
          </button>

          <div
            className="flex flex-1 justify-center gap-2"
            role="tablist"
            aria-label={t('stepsLabel')}
          >
            {stepDefs.map((def, index) => (
              <button
                key={def.id}
                type="button"
                role="tab"
                aria-selected={index === stepIndex}
                aria-label={t('goToStep', { step: index + 1 })}
                onClick={() => setStepIndex(index)}
                className={`rounded-full transition ${
                  index === stepIndex
                    ? 'size-2.5 bg-gold'
                    : 'size-2 bg-silver/30 hover:bg-silver/50'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              if (isLast) {
                onClose?.()
                return
              }
              setStepIndex((i) => Math.min(stepDefs.length - 1, i + 1))
            }}
            aria-label={isLast && onClose ? t('done') : t('next')}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-3 text-sm font-semibold text-gold transition hover:bg-gold/20"
          >
            {isLast && onClose ? t('done') : t('next')}
            {!isLast || !onClose ? (
              <ChevronRight className="size-4 rtl-flip" aria-hidden="true" />
            ) : null}
          </button>
        </div>
      ) : null}
    </div>
  )
}
