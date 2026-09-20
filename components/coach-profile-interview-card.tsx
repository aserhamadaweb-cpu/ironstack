'use client'

import { useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CHOICE_IDLE, CHOICE_SELECTED } from '@/lib/accent'
import type { ProfileInterviewAction } from '@/lib/ai/action-types'
import {
  emptyStepAnswer,
  getProfileInterviewStep,
  isProfileInterviewStepComplete,
  type ProfileInterviewAnswers,
  type ProfileInterviewStepAnswer,
} from '@/lib/ai/profile-interview'
import { FITNESS_PROFILE_HREF } from '@/lib/profile-completeness'
import type { ProfileMissingField } from '@/lib/profile-completeness'

type CoachProfileInterviewCardProps = {
  messageId: string
  conversationId: string | null
  action: ProfileInterviewAction
  disabled?: boolean
  onActionChange: (messageId: string, next: ProfileInterviewAction) => void
  /** Called after a successful save when the interview had a resumePrompt. */
  onResume?: (prompt: string) => void
}

export function CoachProfileInterviewCard({
  messageId,
  conversationId,
  action,
  disabled = false,
  onActionChange,
  onResume,
}: CoachProfileInterviewCardProps) {
  const t = useTranslations('coach')
  const fields = action.fields
  const [stepIndex, setStepIndex] = useState(0)
  const [answers, setAnswers] = useState<ProfileInterviewAnswers>(() => {
    const init: ProfileInterviewAnswers = {}
    for (const field of fields) {
      init[field] = emptyStepAnswer(field, action.preferredUnit)
    }
    return init
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lock = useRef(false)

  const field = fields[stepIndex] as ProfileMissingField | undefined
  const step = field ? getProfileInterviewStep(field) : null
  const answer = field ? answers[field] : undefined
  const stepReady =
    field && answer ? isProfileInterviewStepComplete(field, answer) : false
  const isLast = stepIndex >= fields.length - 1
  const done = action.status === 'saved' || action.status === 'cancelled'

  const progressLabel = useMemo(
    () => t('profileInterviewProgress', { current: stepIndex + 1, total: fields.length }),
    [t, stepIndex, fields.length],
  )

  function patchAnswer(
    target: ProfileMissingField,
    patch: Partial<ProfileInterviewStepAnswer>,
  ) {
    setAnswers((prev) => {
      const current =
        prev[target] ?? emptyStepAnswer(target, action.preferredUnit)
      return { ...prev, [target]: { ...current, ...patch } }
    })
  }

  function toggleChoice(choiceId: string) {
    if (!field || !step || step.kind !== 'choice' || done || busy) return
    const current = answers[field] ?? emptyStepAnswer(field, action.preferredUnit)
    const nextIds =
      current.choiceIds[0] === choiceId ? [] : [choiceId]
    patchAnswer(field, { choiceIds: nextIds })
  }

  async function saveInterview() {
    if (lock.current || busy || disabled || done) return
    lock.current = true
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/ai-coach/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_profile_interview',
          conversationId,
          interviewId: action.interviewId,
          answers,
        }),
      })
      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        setError(data.error || t('actionFailed'))
        return
      }
      onActionChange(messageId, { ...action, status: 'saved' })
      try {
        window.dispatchEvent(new Event('ironstack:fitness-profile-updated'))
      } catch {
        /* ignore */
      }
      const resume = action.resumePrompt?.trim()
      if (resume) onResume?.(resume)
    } catch {
      setError(t('actionNetwork'))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  async function cancelInterview() {
    if (lock.current || busy || disabled || done) return
    lock.current = true
    setBusy(true)
    setError(null)
    try {
      await fetch('/api/ai-coach/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel_profile_interview',
          conversationId,
          interviewId: action.interviewId,
        }),
      })
      onActionChange(messageId, { ...action, status: 'cancelled' })
    } catch {
      onActionChange(messageId, { ...action, status: 'cancelled' })
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  if (action.status === 'saved') {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-gold/25 bg-card/90 p-4">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-gold">
          {t('profileInterviewSaved')}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('profileInterviewSavedBody')}
        </p>
      </div>
    )
  }

  if (action.status === 'cancelled') {
    return (
      <div className="w-full max-w-lg rounded-2xl border border-silver/20 bg-card/80 p-4">
        <p className="text-sm text-muted-foreground">
          {t('profileInterviewCancelled')}
        </p>
        <Link
          href={FITNESS_PROFILE_HREF}
          className="mt-3 inline-flex min-h-11 items-center text-xs font-bold tracking-[0.12em] text-gold"
        >
          {t('profileInterviewOpenForm')} →
        </Link>
      </div>
    )
  }

  if (!field || !step || !answer) return null

  return (
    <div className="w-full max-w-lg space-y-4 rounded-2xl border border-gold/30 bg-card/95 p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground">
            {progressLabel}
          </p>
          <p className="text-[10px] font-semibold tracking-[0.14em] text-gold">
            {t(`profileInterview.fields.${field}.kicker` as 'profileInterview.fields.weight.kicker')}
          </p>
        </div>
        <div
          className="h-1 overflow-hidden rounded-full bg-silver/15"
          role="progressbar"
          aria-valuenow={stepIndex + 1}
          aria-valuemin={1}
          aria-valuemax={fields.length}
          aria-label={progressLabel}
        >
          <div
            className="h-full rounded-full bg-gold transition-[width] duration-300"
            style={{
              width: `${((stepIndex + 1) / fields.length) * 100}%`,
            }}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-silver/15 bg-card/50 px-4 py-4">
        <p className="font-heading text-lg font-semibold text-headline">
          {t(`profileInterview.fields.${field}.question` as 'profileInterview.fields.weight.question')}
        </p>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {t(`profileInterview.fields.${field}.help` as 'profileInterview.fields.weight.help')}
        </p>
      </div>

      {step.kind === 'choice' ? (
        <div className="flex flex-col gap-2">
          {(step.choices ?? []).map((choice) => {
            const selected = answer.choiceIds.includes(choice.id)
            return (
              <button
                key={choice.id}
                type="button"
                disabled={busy || disabled}
                onClick={() => toggleChoice(choice.id)}
                aria-pressed={selected}
                className={`min-h-11 rounded-xl border px-4 py-3 text-start text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50 ${
                  selected ? CHOICE_SELECTED : CHOICE_IDLE
                }`}
              >
                {t(
                  `profileInterview.fields.${field}.choices.${choice.id}` as 'profileInterview.fields.gender.choices.male',
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="space-y-3">
          {step.numberKind === 'weight' ? (
            <div className="flex gap-2">
              {(['kg', 'lb'] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  disabled={busy || disabled}
                  onClick={() => patchAnswer(field, { unit })}
                  aria-pressed={answer.unit === unit}
                  className={`min-h-11 flex-1 rounded-xl border text-sm font-semibold tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
                    answer.unit === unit ? CHOICE_SELECTED : CHOICE_IDLE
                  }`}
                >
                  {unit.toUpperCase()}
                </button>
              ))}
            </div>
          ) : null}
          <input
            type="number"
            inputMode="decimal"
            value={answer.numberValue}
            onChange={(e) => patchAnswer(field, { numberValue: e.target.value })}
            disabled={busy || disabled}
            placeholder={
              step.numberKind === 'weight'
                ? t('profileInterviewWeightPlaceholder', {
                    unit: answer.unit === 'lb' ? 'lb' : 'kg',
                  })
                : t('profileInterviewHeightPlaceholder')
            }
            className="min-h-11 w-full rounded-xl border border-border bg-card/90 px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-60"
          />
        </div>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          disabled={busy || disabled || stepIndex === 0}
          onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-silver/25 px-4 text-xs font-semibold tracking-[0.12em] text-muted-foreground transition hover:text-foreground disabled:opacity-40"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
          {t('profileInterviewBack')}
        </button>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => void cancelInterview()}
            className="inline-flex min-h-11 items-center rounded-full px-3 text-xs font-semibold tracking-[0.1em] text-muted-foreground"
          >
            {t('profileInterviewSkip')}
          </button>
          <button
            type="button"
            disabled={busy || disabled || !stepReady}
            onClick={() => {
              if (isLast) void saveInterview()
              else setStepIndex((i) => Math.min(fields.length - 1, i + 1))
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-xs font-bold tracking-[0.12em] text-primary-foreground transition active:scale-[0.98] disabled:opacity-50"
          >
            {busy && isLast ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : isLast ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
            )}
            {isLast ? t('profileInterviewSave') : t('profileInterviewNext')}
          </button>
        </div>
      </div>

      <Link
        href={FITNESS_PROFILE_HREF}
        className="inline-flex min-h-11 items-center text-[11px] font-semibold tracking-[0.1em] text-muted-foreground hover:text-gold"
      >
        {t('profileInterviewOpenForm')} →
      </Link>
    </div>
  )
}
