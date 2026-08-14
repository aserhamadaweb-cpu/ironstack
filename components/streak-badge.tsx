'use client'

import { useTranslations } from 'next-intl'
import { LtrIsolate } from '@/components/ltr-isolate'
import { StreakFlame } from '@/components/streak-flame'

type StreakBadgeProps = {
  streakDays: number
  /** Hours until streak expires. null = never trained; 0 = ended. */
  hoursLeft?: number | null
  className?: string
}

/**
 * Streak pill — heat-tint when active, quiet ash when zero.
 * Optional countdown when hoursLeft > 0 (urgent/red under 24h).
 */
export function StreakBadge({
  streakDays,
  hoursLeft = null,
  className = '',
}: StreakBadgeProps) {
  const t = useTranslations('streak')
  const active = streakDays > 0

  const label = !active
    ? null
    : streakDays === 1
      ? t('dayOne')
      : streakDays < 7
        ? t('days', { count: streakDays })
        : t('weeks', { count: Math.floor(streakDays / 7) })

  const showCountdown =
    active && hoursLeft != null && hoursLeft > 0
  const hoursRounded = showCountdown
    ? Math.max(1, Math.round(hoursLeft))
    : 0
  const urgent = showCountdown && hoursLeft < 24

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <span
        className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold tracking-wide ${
          active
            ? 'border-heat/40 bg-heat-tint text-gold shadow-[0_0_22px_-8px_rgba(198,40,40,0.55)]'
            : 'border-silver/15 bg-background/70 text-muted-foreground'
        }`}
        aria-label={active ? label! : t('zeroAria')}
      >
        <StreakFlame active={active} className="size-5" />
        {active ? (
          <LtrIsolate when={/^\d/.test(label ?? '')}>{label}</LtrIsolate>
        ) : (
          <>
            <LtrIsolate as="span" className="tabular-nums">
              0
            </LtrIsolate>
            <span className="text-[10px] font-semibold tracking-[0.14em]">
              {t('zero')}
            </span>
          </>
        )}
      </span>

      {showCountdown ? (
        <span
          className={`text-xs font-semibold tabular-nums ${
            urgent ? 'text-heat' : 'text-muted-foreground'
          }`}
        >
          {t('hoursLeft', { count: hoursRounded })}
        </span>
      ) : null}
    </span>
  )
}
