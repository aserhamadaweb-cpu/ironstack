'use client'

import Image from 'next/image'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
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
}

function StepImage({
  src,
  alt,
  onMissing,
}: {
  src: string
  alt: string
  onMissing: () => void
}) {
  return (
    <div className="relative mx-auto w-full max-w-[min(100%,20rem)]">
      <div className="relative aspect-[9/19.5] w-full overflow-hidden rounded-xl border border-silver/20 bg-black/50">
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 375px) 100vw, 320px"
          className="object-contain object-top"
          onError={onMissing}
          priority
        />
      </div>
    </div>
  )
}

export function InstallTutorial({ platform, className = '' }: InstallTutorialProps) {
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

  return (
    <div
      className={`flex w-full max-w-[min(100%,23rem)] flex-col ${
        hasImageSlot ? 'gap-3' : 'gap-4'
      } ${className}`}
      data-install-tutorial={resolvedPlatform}
      data-install-layout={hasImageSlot ? 'image' : 'text'}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold tracking-[0.28em] text-gold uppercase">
          {t('title')}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('stepOf', { current: stepIndex + 1, total: stepDefs.length })}
        </p>
      </div>

      {hasImageSlot ? (
        <>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {caption}
            </p>
          </div>
          {showImage ? (
            <StepImage
              src={current.imageSrc!}
              alt={title}
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
        <div
          className={`flex items-center justify-between gap-2 ${
            hasImageSlot ? 'pt-1' : 'pt-0'
          }`}
        >
          <button
            type="button"
            disabled={stepIndex <= 0}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
            aria-label={t('previous')}
            className="inline-flex size-10 items-center justify-center rounded-full border border-silver/20 text-muted-foreground transition hover:border-gold/35 hover:text-foreground disabled:opacity-40"
          >
            <ChevronLeft className="size-4 rtl-flip" aria-hidden="true" />
          </button>

          <div
            className="flex flex-1 justify-center gap-1.5"
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
                className={`size-2 rounded-full transition ${
                  index === stepIndex
                    ? 'bg-gold'
                    : 'bg-silver/30 hover:bg-silver/50'
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            disabled={stepIndex >= stepDefs.length - 1}
            onClick={() =>
              setStepIndex((i) => Math.min(stepDefs.length - 1, i + 1))
            }
            aria-label={t('next')}
            className="inline-flex size-10 items-center justify-center rounded-full border border-silver/20 text-muted-foreground transition hover:border-gold/35 hover:text-foreground disabled:opacity-40"
          >
            <ChevronRight className="size-4 rtl-flip" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  )
}
