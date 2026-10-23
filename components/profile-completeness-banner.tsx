'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { FITNESS_PROFILE_HREF } from '@/lib/profile-completeness'

const DISMISS_KEY = 'ironstack:profile-completeness-dismissed'

type ProfileCompletenessBannerProps = {
  missingCount: number
  /** Optional short list for the subtitle, e.g. "weight, height, goal". */
  missingLabels?: string[]
  /** Stay quiet until the athlete has finished at least one session. */
  hasTrained?: boolean
  className?: string
}

/**
 * Dismissible nudge when body/fitness fields are incomplete.
 * Links to /dashboard/fitness-profile so the athlete can finish setup.
 */
export function ProfileCompletenessBanner({
  missingCount,
  missingLabels = [],
  hasTrained = false,
  className = '',
}: ProfileCompletenessBannerProps) {
  const t = useTranslations('home')
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(true)
  const [cleared, setCleared] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  useEffect(() => {
    const onUpdated = () => setCleared(true)
    window.addEventListener('ironstack:fitness-profile-updated', onUpdated)
    return () =>
      window.removeEventListener('ironstack:fitness-profile-updated', onUpdated)
  }, [])

  if (!mounted || !hasTrained || dismissed || cleared || missingCount <= 0) return null

  const preview =
    missingLabels.length > 0
      ? missingLabels
          .slice(0, 4)
          .map((key) => {
            try {
              return t(`missingField.${key}` as 'missingField.weight')
            } catch {
              return key
            }
          })
          .join(', ') + (missingLabels.length > 4 ? '…' : '')
      : null

  const close = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* private mode */
    }
  }

  return (
    <aside
      role="status"
      className={`mb-6 flex items-start gap-3 rounded-2xl border border-gold/35 bg-gold/8 p-4 ${className}`}
    >
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/15 text-gold">
        <ClipboardList className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-bold text-foreground">
          {t('profileIncompleteTitle')}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {preview
            ? t('profileIncompleteBodyWithFields', { fields: preview })
            : t('profileIncompleteBody')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={FITNESS_PROFILE_HREF}
            className="inline-flex min-h-11 items-center rounded-full bg-primary px-4 text-[11px] font-bold tracking-[0.1em] text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          >
            {t('profileIncompleteCta')}
          </Link>
          <button
            type="button"
            onClick={close}
            className="inline-flex min-h-11 items-center rounded-full px-3 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          >
            {t('profileIncompleteDismiss')}
          </button>
        </div>
      </div>
      <button
        type="button"
        aria-label={t('profileIncompleteDismiss')}
        onClick={close}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
      >
        <X className="size-3.5" />
      </button>
    </aside>
  )
}
