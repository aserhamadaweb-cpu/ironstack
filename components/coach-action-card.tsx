'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { safeDashboardHref, type CoachUiAction, type SplitProposal } from '@/lib/ai/action-types'
import { CoachAgentActionCard } from '@/components/coach-agent-action-card'
import { CoachProfileInterviewCard } from '@/components/coach-profile-interview-card'
import { discardPendingSession } from '@/lib/offline/discard-session'

function mapActionError(
  raw: string | undefined,
  code: string | undefined,
  t: ReturnType<typeof useTranslations<'coach'>>,
) {
  if (code === 'split_limit_reached' || raw?.includes('custom splits')) {
    return t('errSplitLimit')
  }
  return raw || t('actionFailed')
}

type CoachActionCardProps = {
  messageId: string
  conversationId: string | null
  action: CoachUiAction
  onActionChange: (messageId: string, next: CoachUiAction) => void
  onRevise: (proposal: SplitProposal) => void
  /** After profile interview saves, continue the original ask (e.g. build a split). */
  onResumePrompt?: (prompt: string) => void
  disabled?: boolean
}

export function CoachActionCard({
  messageId,
  conversationId,
  action,
  onActionChange,
  onRevise,
  onResumePrompt,
  disabled = false,
}: CoachActionCardProps) {
  const t = useTranslations('coach')
  const tRec = useTranslations('splitRecommendations')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const lock = useRef(false)

  const confirm = async (
    kind: 'create_split' | 'update_split' | 'discard_session',
  ) => {
    if (action.type === 'agent_action' || action.type === 'profile_interview') {
      return
    }
    if (lock.current || busy || disabled) return
    lock.current = true
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/ai-coach/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: kind,
          conversationId,
          proposal: action.proposal,
        }),
      })
      const data = (await res.json()) as {
        error?: string
        code?: string
        href?: string
        splitId?: string
      }
      if (!res.ok) {
        setError(mapActionError(data.error, data.code, t))
        return
      }
      if (action.type === 'split_preview') {
        const href =
          safeDashboardHref(data.href) ||
          safeDashboardHref(
            data.splitId ? `/dashboard/splits/${data.splitId}` : null,
          ) ||
          '/dashboard/workout'
        onActionChange(messageId, {
          ...action,
          status: 'saved',
          splitHref: href,
        })
        router.push(href)
        router.refresh()
      } else {
        if (kind === 'discard_session' && action.proposal.sessionId) {
          await discardPendingSession(action.proposal.sessionId)
        }
        onActionChange(messageId, { ...action, status: 'done' })
      }
    } catch {
      setError(t('actionNetwork'))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }

  if (action.type === 'agent_action') {
    return (
      <CoachAgentActionCard
        messageId={messageId}
        action={action}
        disabled={disabled}
        onActionChange={onActionChange}
      />
    )
  }

  if (action.type === 'profile_interview') {
    return (
      <CoachProfileInterviewCard
        messageId={messageId}
        conversationId={conversationId}
        action={action}
        disabled={disabled}
        onActionChange={onActionChange}
        onResume={onResumePrompt}
      />
    )
  }

  if (action.type === 'split_preview') {
    const saved = action.status === 'saved'
    const cancelled = action.status === 'cancelled'
    return (
      <div className="w-full max-w-lg rounded-2xl border border-gold/25 bg-card/90 p-4">
        <p className="text-[10px] font-semibold tracking-[0.18em] text-gold">
          {saved ? t('planSaved') : t('planPreview')}
        </p>
        <h3 className="font-heading mt-1 text-lg font-bold text-foreground">
          {action.proposal.name}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t('planDays', { count: action.proposal.daysPerWeek })}
        </p>
        {(action.proposal.warnings ?? []).length > 0 && (
          <div
            role="note"
            className="mt-3 rounded-xl border border-gold/30 bg-gold-tint px-3 py-3 text-xs text-muted-foreground"
          >
            <p className="font-semibold text-gold">{tRec('warningsTitle')}</p>
            <ul className="mt-2 list-disc space-y-1 ps-4">
              {(action.proposal.warnings ?? []).map((warning) => (
                <li key={warning} className="break-words" dir="auto">
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}
        {(action.proposal.assumptions ?? []).length > 0 && (
          <ul className="mt-2 list-disc space-y-1 ps-4 text-xs text-muted-foreground">
            {(action.proposal.assumptions ?? []).map((row) => (
              <li key={row}>{row}</li>
            ))}
          </ul>
        )}
        {(action.proposal.questions ?? []).length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {(action.proposal.questions ?? []).map((row) => (
              <li key={row}>• {row}</li>
            ))}
          </ul>
        )}
        <div className="mt-3 space-y-3">
          {action.proposal.days.map((day, dayIndex) => (
            <div key={`${day.name}-${dayIndex}`} className="rounded-xl border border-silver/15 p-3">
              <p className="text-sm font-semibold text-foreground">{day.name}</p>
              {day.subtitle ? (
                <p className="text-xs text-muted-foreground">{day.subtitle}</p>
              ) : null}
              <ul className="mt-2 space-y-1.5">
                {day.exercises.map((exercise) => (
                  <li
                    key={`${dayIndex}-${exercise.exerciseId}`}
                    className="text-xs text-foreground"
                  >
                    <span className="font-semibold">{exercise.name}</span>
                    <span className="text-muted-foreground">
                      {' '}
                      · {exercise.sets} × {exercise.reps} · {exercise.equipment}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}{' '}
            <button
              type="button"
              className="font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              onClick={() =>
                void confirm(
                  action.proposal.kind === 'update_split'
                    ? 'update_split'
                    : 'create_split',
                )
              }
            >
              {t('retry')}
            </button>
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          {saved && action.splitHref ? (
            <Link
              href={safeDashboardHref(action.splitHref) ?? '/dashboard/workout'}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-xs font-bold tracking-[0.12em] text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              {t('openSplit')}
            </Link>
          ) : cancelled ? (
            <p className="text-xs text-muted-foreground">{t('planCancelled')}</p>
          ) : (
            <>
              <button
                type="button"
                disabled={busy || disabled}
                onClick={() =>
                  void confirm(
                    action.proposal.kind === 'update_split'
                      ? 'update_split'
                      : 'create_split',
                  )
                }
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-xs font-bold tracking-[0.12em] text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : action.proposal.kind === 'update_split' ? (
                  t('saveChanges')
                ) : (
                  t('saveSplit')
                )}
              </button>
              <button
                type="button"
                disabled={busy || disabled}
                onClick={() => onRevise(action.proposal)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-silver/25 px-4 text-xs font-semibold tracking-[0.12em] text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              >
                {t('editPlan')}
              </button>
              <button
                type="button"
                disabled={busy || disabled}
                onClick={() => {
                  onActionChange(messageId, { ...action, status: 'cancelled' })
                  if (conversationId) {
                    void fetch('/api/ai-coach/actions', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        action: 'cancel_proposal',
                        conversationId,
                        proposal: action.proposal,
                      }),
                    })
                  }
                }}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-silver/25 px-4 text-xs font-semibold tracking-[0.12em] text-muted-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              >
                {t('cancelPlan')}
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  const session = action.proposal
  const done = action.status === 'done' || action.status === 'cancelled'

  return (
    <div className="w-full max-w-lg rounded-2xl border border-blue/25 bg-card/90 p-4">
      <p className="text-[10px] font-semibold tracking-[0.18em] text-blue">
        {t('sessionPreview')}
      </p>
      <h3 className="font-heading mt-1 text-lg font-bold text-foreground">
        {session.splitName ?? t('sessionFallback')}
      </h3>
      {session.warning ? (
        <p className="mt-2 text-sm text-muted-foreground">{session.warning}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}{' '}
          <button
            type="button"
            className="font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            onClick={() => void confirm('discard_session')}
          >
            {t('retry')}
          </button>
        </p>
      ) : null}

      {done ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {action.status === 'done' ? t('sessionDone') : t('planCancelled')}
        </p>
      ) : session.kind === 'discard_session' ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {confirmDiscard ? (
            <>
              <button
                type="button"
                disabled={busy || disabled}
                onClick={() => void confirm('discard_session')}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-destructive px-4 text-xs font-bold tracking-[0.12em] text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : t('confirmDiscard')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDiscard(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-silver/25 px-4 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              >
                {t('cancelPlan')}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setConfirmDiscard(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-destructive/40 px-4 text-xs font-bold tracking-[0.12em] text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              {t('discardSession')}
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={
              disabled ||
              !(
                safeDashboardHref(session.href) ||
                session.splitId
              )
            }
            onClick={() => {
              const href =
                safeDashboardHref(session.href) ||
                safeDashboardHref(
                  session.splitId
                    ? session.kind === 'start_session' ||
                      session.kind === 'resume_session'
                      ? `/dashboard/splits/${session.splitId}/session`
                      : `/dashboard/splits/${session.splitId}`
                    : null,
                )
              if (!href) return
              router.push(href)
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-xs font-bold tracking-[0.12em] text-primary-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          >
            {session.kind === 'start_session'
              ? t('startWorkoutConfirm')
              : session.kind === 'resume_session'
                ? t('resumeWorkout')
                : t('openSplit')}
          </button>
          <button
            type="button"
            onClick={() => onActionChange(messageId, { ...action, status: 'cancelled' })}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-silver/25 px-4 text-xs font-semibold text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          >
            {t('cancelPlan')}
          </button>
        </div>
      )}
    </div>
  )
}
