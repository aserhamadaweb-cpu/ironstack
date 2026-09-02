'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { clearUnfinishedWorkoutReminder, type ActiveWorkoutView } from '@/lib/active-workout'
import { discardPendingSession } from '@/lib/offline/discard-session'

type ActiveWorkoutConflictProps = {
  active: ActiveWorkoutView
  onResolved: () => void
  onStay?: () => void
}

export function ActiveWorkoutConflict({
  active,
  onResolved,
  onStay,
}: ActiveWorkoutConflictProps) {
  const t = useTranslations('activeWorkout')
  const router = useRouter()
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const discard = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const result = await discardPendingSession(active.id)
      if (result.error) {
        setError(result.error)
        setBusy(false)
        return
      }
      clearUnfinishedWorkoutReminder()
      setConfirmDiscard(false)
      setBusy(false)
      onResolved()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('discardFailed'))
      setBusy(false)
    }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        if (confirmDiscard) setConfirmDiscard(false)
        else onStay?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, confirmDiscard, onStay])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="active-workout-conflict-title"
      className="fixed inset-0 z-[90] flex items-end justify-center bg-background/70 p-4 sm:items-center"
    >
      <div className="is-panel w-full max-w-md p-5">
        <p className="section-kicker">{t('kicker')}</p>
        <h2
          id="active-workout-conflict-title"
          className="font-heading mt-2 text-xl font-bold text-foreground"
        >
          {t('alreadyActiveTitle')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('alreadyActiveBody', { name: active.splitName })}
        </p>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {confirmDiscard ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm font-semibold text-destructive">
              {t('discardConfirm')}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void discard()}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-destructive px-4 text-sm font-bold tracking-[0.12em] text-destructive-foreground disabled:opacity-60"
              >
                {busy ? t('discarding') : t('discardConfirmAction')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDiscard(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-silver/20 px-4 text-sm font-semibold text-foreground"
              >
                {t('keepSession')}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            <Link
              href={active.href}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-sm font-bold tracking-[0.12em] text-primary-foreground"
            >
              {t('resume')}
            </Link>
            <button
              type="button"
              onClick={() => setConfirmDiscard(true)}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-destructive/40 px-4 text-sm font-semibold text-destructive"
            >
              {t('discard')}
            </button>
            {onStay ? (
              <button
                type="button"
                onClick={onStay}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-silver/20 px-4 text-sm font-semibold text-muted-foreground"
              >
                {t('stayHere')}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
