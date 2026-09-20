'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Loader2, Sparkles, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { SplitRecommendation } from '@/lib/split-recommendations'
import {
  applySplitRecommendationAction,
  generateCustomSplitFromPromptAction,
} from '@/lib/data/split-recommendation-actions'
import { SplitRecommendationCard } from '@/components/split-recommendation-card'
import {
  AI_INTERVIEW_STEPS,
  compileAiSplitInterviewPrompt,
  emptyAiInterviewAnswers,
  getAiInterviewStepDef,
  isAiInterviewStepComplete,
  type AiInterviewAnswers,
} from '@/lib/split-recommendations/ai-interview'

type SplitRecommendationAiBuilderProps = {
  onSaved?: (splitId: string, programName?: string) => void
  /** When true, composer is expanded on load and cannot collapse to teaser. */
  defaultOpen?: boolean
}

export function SplitRecommendationAiBuilder({
  onSaved,
  defaultOpen = false,
}: SplitRecommendationAiBuilderProps) {
  const t = useTranslations('splitRecommendations')
  const [open, setOpen] = useState(defaultOpen || false)
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState<AiInterviewAnswers>(emptyAiInterviewAnswers)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<SplitRecommendation | null>(null)
  const [pending, startTransition] = useTransition()

  const isExpanded = defaultOpen || open
  const stepId = AI_INTERVIEW_STEPS[stepIndex]!
  const stepDef = getAiInterviewStepDef(stepId)
  const answer = answers[stepId]
  const stepReady = isAiInterviewStepComplete(stepDef, answer)
  const isLastStep = stepIndex === AI_INTERVIEW_STEPS.length - 1
  const progressLabel = t('aiInterviewProgress', {
    current: stepIndex + 1,
    total: AI_INTERVIEW_STEPS.length,
  })

  function resetInterview() {
    setStepIndex(0)
    setAnswers(emptyAiInterviewAnswers())
    setPreview(null)
    setError(null)
  }

  function toggleChoice(choiceId: string) {
    setAnswers((prev) => {
      const current = prev[stepId]
      let nextIds: string[]
      if (stepDef.multi) {
        nextIds = current.choiceIds.includes(choiceId)
          ? current.choiceIds.filter((id) => id !== choiceId)
          : [...current.choiceIds, choiceId]
      } else {
        nextIds = current.choiceIds[0] === choiceId ? [] : [choiceId]
      }
      return {
        ...prev,
        [stepId]: { ...current, choiceIds: nextIds },
      }
    })
  }

  function setCustom(value: string) {
    setAnswers((prev) => ({
      ...prev,
      [stepId]: { ...prev[stepId], custom: value },
    }))
  }

  function handleGenerate() {
    if (pending) return
    const prompt = compileAiSplitInterviewPrompt(answers)
    if (prompt.length < 8) return
    setError(null)
    startTransition(async () => {
      const result = await generateCustomSplitFromPromptAction(prompt)
      if (result.error || !result.data) {
        setError(result.error ?? t('aiGenerateFailed'))
        setPreview(null)
        return
      }
      setPreview(result.data)
    })
  }

  function handleContinue() {
    if (!stepReady || pending) return
    if (isLastStep) {
      handleGenerate()
      return
    }
    setStepIndex((i) => Math.min(i + 1, AI_INTERVIEW_STEPS.length - 1))
  }

  function handleSave(rec: SplitRecommendation) {
    setError(null)
    startTransition(async () => {
      const result = await applySplitRecommendationAction(rec)
      if (result.error || !result.data?.splitId) {
        setError(result.error ?? t('saveFailed'))
        return
      }
      onSaved?.(result.data.splitId, rec.name)
      resetInterview()
      if (!defaultOpen) {
        setOpen(false)
      }
    })
  }

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="split-recommendation-card flex min-h-11 w-full max-w-full min-w-0 items-start gap-3 rounded-2xl border border-gold/30 bg-gold/5 px-4 py-4 text-start transition hover:border-gold/50 hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <p className="rec-copy font-heading text-base font-bold text-headline">
            {t('aiBuilderTitle')}
          </p>
          <p className="rec-copy mt-1 break-words text-sm text-muted-foreground">
            {t('aiBuilderBody')}
          </p>
        </span>
      </button>
    )
  }

  return (
    <section
      className="split-recommendation-card rounded-2xl border border-gold/30 bg-background/60"
      data-tour="ai-split-builder"
    >
      <div className="flex items-start justify-between gap-3 border-b border-silver/15 px-4 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-base font-bold">{t('aiBuilderTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('aiBuilderHint')}</p>
          </div>
        </div>
        {!defaultOpen ? (
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              resetInterview()
            }}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-silver/20 text-muted-foreground transition hover:text-foreground"
            aria-label={t('aiBuilderClose')}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="space-y-4 px-4 py-4">
        {!preview ? (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
                  {progressLabel}
                </p>
                <p className="text-[10px] font-semibold tracking-[0.14em] text-gold">
                  {t(`aiInterview.${stepId}.kicker` as 'aiInterview.days.kicker')}
                </p>
              </div>
              <div
                className="h-1 overflow-hidden rounded-full bg-silver/15"
                role="progressbar"
                aria-valuenow={stepIndex + 1}
                aria-valuemin={1}
                aria-valuemax={AI_INTERVIEW_STEPS.length}
                aria-label={progressLabel}
              >
                <div
                  className="h-full rounded-full bg-gold transition-[width] duration-300"
                  style={{
                    width: `${((stepIndex + 1) / AI_INTERVIEW_STEPS.length) * 100}%`,
                  }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-silver/15 bg-card/50 px-4 py-4">
              <p className="font-heading text-lg font-semibold text-headline">
                {t(`aiInterview.${stepId}.question` as 'aiInterview.days.question')}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {t(`aiInterview.${stepId}.help` as 'aiInterview.days.help')}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {stepDef.choices.map((choice) => {
                const selected = answer.choiceIds.includes(choice.id)
                return (
                  <button
                    key={choice.id}
                    type="button"
                    disabled={pending}
                    onClick={() => toggleChoice(choice.id)}
                    aria-pressed={selected}
                    className={`min-h-11 rounded-xl border px-4 py-3 text-start text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50 ${
                      selected
                        ? 'border-gold/50 bg-gold-tint text-headline'
                        : 'border-silver/20 bg-background/40 text-muted-foreground hover:border-silver/40 hover:text-foreground'
                    }`}
                  >
                    {t(
                      `aiInterview.${stepId}.choices.${choice.id}` as `aiInterview.days.choices.days_3`,
                    )}
                  </button>
                )
              })}
            </div>

            <div className="space-y-2">
              <label
                htmlFor={`ai-interview-custom-${stepId}`}
                className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground"
              >
                {t('aiInterviewCustomLabel')}
              </label>
              <textarea
                id={`ai-interview-custom-${stepId}`}
                value={answer.custom}
                onChange={(e) => setCustom(e.target.value)}
                rows={stepId === 'notes' ? 4 : 2}
                placeholder={t(
                  `aiInterview.${stepId}.customPlaceholder` as 'aiInterview.days.customPlaceholder',
                )}
                disabled={pending}
                dir="auto"
                className="max-h-40 min-h-11 w-full resize-y rounded-xl border border-border bg-card/90 px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-60"
              />
              {stepDef.multi ? (
                <p className="text-xs text-muted-foreground">{t('aiInterviewMultiHint')}</p>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                disabled={pending || stepIndex === 0}
                onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-silver/25 px-4 text-xs font-semibold tracking-[0.12em] text-muted-foreground transition hover:text-foreground disabled:opacity-40"
              >
                <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
                {t('aiInterviewBack')}
              </button>
              <button
                type="button"
                disabled={pending || !stepReady}
                onClick={handleContinue}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold tracking-[0.12em] text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
              >
                {pending && isLastStep ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : isLastStep ? (
                  <Sparkles className="size-4" aria-hidden="true" />
                ) : (
                  <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
                )}
                {isLastStep ? t('aiBuilderGenerate') : t('aiInterviewNext')}
              </button>
            </div>
          </>
        ) : (
          <SplitRecommendationCard
            rec={preview}
            selected
            expanded
            busy={pending}
            onToggle={() => undefined}
            onSelect={() => handleSave(preview)}
          />
        )}

        {error ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            {/profile|fitness/i.test(error) ? (
              <Link
                href="/onboarding/continue"
                className="inline-flex min-h-11 items-center text-xs font-bold tracking-[0.12em] text-gold"
              >
                {t('completeProfileCta')} →
              </Link>
            ) : null}
          </div>
        ) : null}

        {preview ? (
          <button
            type="button"
            disabled={pending}
            onClick={resetInterview}
            className="min-h-11 text-sm text-muted-foreground transition hover:text-gold disabled:opacity-50"
          >
            {t('aiBuilderTryAgain')}
          </button>
        ) : null}
      </div>
    </section>
  )
}
