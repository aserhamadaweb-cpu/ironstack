'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Check, Loader2, Undo2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  safeDashboardHref,
  type AgentActionCard as AgentActionCardData,
} from '@/lib/ai/action-types'
import {
  cancelAgentActionAction,
  confirmAgentActionAction,
  undoAgentActionAction,
} from '@/lib/ai/agent/agent-actions'
import {
  applyThemeToDocument,
  resolveAppearance,
  writeStoredAppearance,
  type AppearanceMode,
} from '@/lib/theme'

type CoachAgentActionCardProps = {
  messageId: string
  action: AgentActionCardData
  onActionChange: (messageId: string, next: AgentActionCardData) => void
  disabled?: boolean
}

/**
 * Confirmation card for a queued agent action.
 *
 * The card never carries the change itself — only `pendingActionId`. Confirming
 * sends just that id, so the server applies exactly what it validated and
 * described, not whatever the client happens to hold.
 */
export function CoachAgentActionCard({
  messageId,
  action,
  onActionChange,
  disabled = false,
}: CoachAgentActionCardProps) {
  const t = useTranslations('coach')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const lock = useRef(false)

  const { preview } = action
  const isPending = action.status === 'pending'
  const applied = action.status === 'applied'
  const href = safeDashboardHref(action.href)

  const applyAppearance = (appearance: AppearanceMode | undefined) => {
    if (!appearance) return
    applyThemeToDocument(resolveAppearance(appearance))
    writeStoredAppearance(appearance)
  }

  const confirm = () => {
    if (lock.current || pending || disabled) return
    lock.current = true
    setError(null)
    startTransition(async () => {
      try {
        const result = await confirmAgentActionAction(action.pendingActionId)
        if (!result.ok) {
          setError(result.error)
          if (result.code === 'expired') {
            onActionChange(messageId, { ...action, status: 'expired' })
          }
          return
        }
        applyAppearance(result.appearance)
        onActionChange(messageId, {
          ...action,
          status: 'applied',
          auditId: result.auditId,
          summary: result.summary,
          href: result.href,
          undoable: result.undoable,
        })
        router.refresh()
      } catch {
        setError(t('actionNetwork'))
      } finally {
        lock.current = false
      }
    })
  }

  const cancel = () => {
    if (pending || disabled) return
    onActionChange(messageId, { ...action, status: 'cancelled' })
    startTransition(async () => {
      await cancelAgentActionAction(action.pendingActionId)
    })
  }

  const undo = () => {
    if (!action.auditId || lock.current || pending || disabled) return
    lock.current = true
    setError(null)
    const auditId = action.auditId
    startTransition(async () => {
      try {
        const result = await undoAgentActionAction(auditId)
        if (!result.ok) {
          setError(result.error)
          return
        }
        applyAppearance(result.appearance)
        onActionChange(messageId, { ...action, undone: true, summary: result.summary })
        router.refresh()
      } catch {
        setError(t('actionNetwork'))
      } finally {
        lock.current = false
      }
    })
  }

  const accent = preview.destructive ? 'border-destructive/30' : 'border-gold/25'

  return (
    <div className={`w-full max-w-lg rounded-2xl border ${accent} bg-card/90 p-4`}>
      <p
        className={`text-[10px] font-semibold tracking-[0.18em] ${
          applied ? 'text-muted-foreground' : 'text-gold'
        }`}
      >
        {applied ? t('agentApplied') : t('agentPending')}
      </p>
      <h3 className="font-heading mt-1 text-base font-bold text-foreground">
        {preview.title}
      </h3>

      {isPending && preview.changes.length > 0 ? (
        <>
          <p className="mt-3 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
            {t('agentWillChange')}
          </p>
          <ul className="mt-1.5 space-y-1">
            {preview.changes.map((change) => (
              <li
                key={change}
                className="flex gap-2 text-xs leading-relaxed text-foreground"
              >
                <span aria-hidden="true" className="text-gold">
                  ·
                </span>
                <span>{change}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {isPending && preview.warning ? (
        <p className="mt-3 flex gap-2 rounded-xl border border-heat/30 bg-heat/5 p-2.5 text-xs text-foreground">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-heat" aria-hidden="true" />
          <span>{preview.warning}</span>
        </p>
      ) : null}

      {isPending && !preview.undoable ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t('agentNotUndoable')}
        </p>
      ) : null}

      {applied ? (
        <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
          <Check className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden="true" />
          <span>{action.undone ? t('agentUndone') : action.summary}</span>
        </p>
      ) : null}

      {action.status === 'cancelled' ? (
        <p className="mt-2 text-xs text-muted-foreground">{t('agentCancelled')}</p>
      ) : null}
      {action.status === 'expired' ? (
        <p className="mt-2 text-xs text-muted-foreground">{t('agentExpired')}</p>
      ) : null}
      {action.status === 'failed' ? (
        <p className="mt-2 text-xs text-destructive">{t('agentFailed')}</p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {isPending ? (
          <>
            <button
              type="button"
              disabled={pending || disabled}
              onClick={confirm}
              className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 text-xs font-bold tracking-[0.12em] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
                preview.destructive
                  ? 'bg-destructive text-white'
                  : 'bg-primary text-primary-foreground'
              }`}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                preview.confirmLabel
              )}
            </button>
            <button
              type="button"
              disabled={pending || disabled}
              onClick={cancel}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-silver/25 px-4 text-xs font-semibold tracking-[0.12em] text-muted-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              {t('cancelPlan')}
            </button>
          </>
        ) : null}

        {applied && href ? (
          <Link
            href={href}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-xs font-bold tracking-[0.12em] text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          >
            {t('agentOpen')}
          </Link>
        ) : null}

        {applied && action.undoable && !action.undone ? (
          <button
            type="button"
            disabled={pending || disabled}
            onClick={undo}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-silver/25 px-4 text-xs font-semibold tracking-[0.12em] text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                <Undo2 className="size-3.5" aria-hidden="true" />
                {t('agentUndo')}
              </>
            )}
          </button>
        ) : null}
      </div>
    </div>
  )
}
