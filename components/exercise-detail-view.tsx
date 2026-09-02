'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import type { ExerciseDetailDto } from '@/lib/exercises/actions'
import {
  INSTRUCTION_LANGUAGE_LABELS,
  instructionLocalesFor,
  resolveInstructionLocale,
  stepsForLocale,
  supportingMuscles,
} from '@/lib/exercises/content'
import { titleCase } from '@/lib/exercises/normalizers'

type ExerciseDetailViewProps = {
  exercise: ExerciseDetailDto
  onBack?: () => void
  backLabel?: string
  onAdd?: () => void
  addLabel?: string
  addedLabel?: string
  added?: boolean
  addingTo?: string
}

export function ExerciseDetailView({
  exercise,
  onBack,
  backLabel,
  onAdd,
  addLabel,
  addedLabel,
  added = false,
  addingTo,
}: ExerciseDetailViewProps) {
  const t = useTranslations('exerciseCatalog')
  const appLocale = useLocale()
  const locales = useMemo(() => instructionLocalesFor(exercise), [exercise])
  const [locale, setLocale] = useState(() =>
    resolveInstructionLocale(exercise.instructionSteps, appLocale),
  )
  const steps = stepsForLocale(exercise, locale)
  const supporting = supportingMuscles(exercise)
  const [gifReady, setGifReady] = useState(false)
  const poster = exercise.image || null

  useEffect(() => {
    setGifReady(false)
    if (!exercise.gifUrl || !poster || exercise.gifUrl === poster) {
      setGifReady(true)
      return
    }
    const img = new Image()
    img.src = exercise.gifUrl
    img.onload = () => setGifReady(true)
    return () => {
      img.onload = null
    }
  }, [exercise.gifUrl, exercise.mediaId, poster])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-semibold tracking-[0.12em] text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          >
            <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
            {backLabel ?? t('backToCatalog')}
          </button>
        ) : null}

        <header className="space-y-2">
          <p className="section-kicker">{t('kicker')}</p>
          <h1 className="font-heading text-3xl font-bold text-foreground">
            {exercise.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[
              titleCase(exercise.bodyPart),
              titleCase(exercise.target),
              titleCase(exercise.equipment),
            ].join(' · ')}
          </p>
        </header>

        <section className="overflow-hidden rounded-2xl border border-silver/15 bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gifReady ? exercise.gifUrl : poster ?? exercise.gifUrl}
            alt={exercise.name}
            width={360}
            height={360}
            loading="lazy"
            decoding="async"
            className="mx-auto aspect-square w-full max-w-md object-contain bg-background"
          />
          <p className="border-t border-silver/10 px-4 py-2 text-center text-[11px] text-muted-foreground">
            {t('gifCaption')}
          </p>
        </section>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Meta label={t('bodyPart')} value={titleCase(exercise.bodyPart)} />
          <Meta label={t('targetMuscle')} value={titleCase(exercise.target)} />
          <Meta label={t('muscleGroup')} value={titleCase(exercise.muscleGroup)} />
          <Meta label={t('equipment')} value={titleCase(exercise.equipment)} />
          <Meta label={t('category')} value={titleCase(exercise.category)} />
          <Meta label={t('mediaId')} value={exercise.mediaId} />
        </dl>

        {supporting.length > 0 && (
          <section>
            <h2 className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
              {t('supporting')}
            </h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {supporting.map((muscle) => (
                <span
                  key={muscle}
                  className="rounded-full border border-silver/20 bg-card px-3 py-1 text-xs text-foreground"
                >
                  {titleCase(muscle)}
                </span>
              ))}
            </div>
          </section>
        )}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-bold text-foreground">
              {t('instructions')}
            </h2>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
                {t('language')}
              </span>
              <select
                value={locale}
                onChange={(event) => setLocale(event.target.value)}
                className="h-11 rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                {locales.map((code) => (
                  <option key={code} value={code}>
                    {INSTRUCTION_LANGUAGE_LABELS[code] ?? code}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {appLocale === 'ar' && locale === 'en' && (
            <p className="text-xs text-muted-foreground">{t('arabicFallback')}</p>
          )}
          <ol className="space-y-2">
            {steps.map((step, index) => (
              <li
                key={`${locale}-${index}`}
                className="rounded-xl border border-silver/10 bg-card/60 px-4 py-3 text-sm text-foreground"
              >
                <span className="me-2 text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {String(index + 1).padStart(2, '0')}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </section>
      </div>

      {onAdd ? (
        <div className="shrink-0 border-t border-silver/10 bg-background/95 p-4">
          {addingTo ? (
            <p className="mb-2 text-center text-xs text-muted-foreground">
              {t('addingToDay', { day: addingTo })}
            </p>
          ) : null}
          <button
            type="button"
            onClick={onAdd}
            className={`flex h-12 w-full items-center justify-center rounded-full text-sm font-bold tracking-[0.15em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
              added
                ? 'border border-gold/50 bg-gold/15 text-gold'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {added ? (addedLabel ?? t('added')) : (addLabel ?? t('addToSplit'))}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-silver/10 bg-card/60 px-3 py-2">
      <dt className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-foreground">{value || '—'}</dd>
    </div>
  )
}
