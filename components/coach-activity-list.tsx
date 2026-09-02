'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Loader2, Undo2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LtrIsolate } from '@/components/ltr-isolate'
import { undoAgentActionAction } from '@/lib/ai/agent/agent-actions'
import type { AgentAuditEntry } from '@/lib/ai/agent/audit'
import { formatSessionDate } from '@/lib/session-store'

type CoachActivityListProps = {
  entries: AgentAuditEntry[]
}

/**
 * Read-only history of coach-made changes, with undo where the action supports
 * it. Undo goes through the same executor as the chat card, so it lands in the
 * audit log as its own entry rather than erasing the original.
 */
export function CoachActivityList({ entries: initial }: CoachActivityListProps) {
  const t = useTranslations('coach')
  const [entries, setEntries] = useState(initial)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const undo = (auditId: string) => {
    if (busyId) return
    setBusyId(auditId)
    setError(null)
    startTransition(async () => {
      try {
        const result = await undoAgentActionAction(auditId)
        if (!result.ok) {
          setError(result.error)
          return
        }
        setEntries((prev) =>
          prev.map((entry) =>
            entry.id === auditId
              ? { ...entry, status: 'undone', canUndo: false }
              : entry,
          ),
        )
      } catch {
        setError(t('activityUndoFailed'))
      } finally {
        setBusyId(null)
      }
    })
  }

  return (
    <>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <ul className="space-y-3">
        {entries.map((entry) => {
          const busy = busyId === entry.id
          const reversed = entry.status === 'undone' || Boolean(entry.undoneByAuditId)
          return (
            <li
              key={entry.id}
              className={`is-panel p-4 sm:p-5 ${
                entry.status === 'failed' ? 'opacity-70' : ''
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <LtrIsolate
                  as="span"
                  className="text-[10px] font-semibold tracking-[0.2em] text-gold"
                >
                  {formatSessionDate(entry.createdAt)}
                </LtrIsolate>
                {reversed ? (
                  <span className="rounded-full border border-silver/25 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">
                    {t('activityUndone')}
                  </span>
                ) : null}
                {entry.status === 'failed' ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-destructive">
                    <AlertTriangle className="size-3" aria-hidden="true" />
                    {t('activityFailed')}
                  </span>
                ) : null}
                {entry.undoOfAuditId ? (
                  <span className="text-[10px] tracking-[0.12em] text-muted-foreground">
                    {t('activityReverses')}
                  </span>
                ) : null}
              </div>

              <p className="mt-1.5 text-sm leading-relaxed text-foreground">
                {entry.summary || entry.actionName}
              </p>

              {entry.error ? (
                <p className="mt-1 text-xs text-destructive">{entry.error}</p>
              ) : null}

              {entry.requestText ? (
                <p className="mt-2 border-s-2 border-silver/20 ps-3 text-xs italic leading-relaxed text-muted-foreground">
                  {t('activityYouAsked')}: “{entry.requestText}”
                </p>
              ) : null}

              {entry.canUndo ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => undo(entry.id)}
                  className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-silver/25 px-3.5 text-[11px] font-semibold tracking-[0.12em] text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                >
                  {busy ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <>
                      <Undo2 className="size-3.5" aria-hidden="true" />
                      {t('agentUndo')}
                    </>
                  )}
                </button>
              ) : null}
            </li>
          )
        })}
      </ul>
    </>
  )
}
