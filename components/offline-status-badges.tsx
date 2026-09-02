'use client'

import { CloudOff, RefreshCw } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useOfflineStatus } from '@/lib/offline/provider'

export function OfflineStatusBadges() {
  const t = useTranslations('offline')
  const {
    online,
    pendingCount,
    syncing,
    hydrated,
    lastError,
    refresh,
    orphanNotice,
    dismissOrphanNotice,
  } = useOfflineStatus()

  const showOffline = hydrated && !online
  const showSync = hydrated && pendingCount > 0
  const canRetry = hydrated && online && pendingCount > 0 && !syncing

  return (
    <div className="flex max-w-[14rem] shrink-0 flex-col items-end gap-0.5 sm:max-w-none">
      {orphanNotice ? (
        <button
          type="button"
          onClick={() => void dismissOrphanNotice()}
          className="max-w-[16rem] rounded-xl border border-gold/30 bg-gold/10 px-2 py-1 text-end text-[10px] font-semibold leading-snug text-gold"
        >
          {orphanNotice.sessions > 0
            ? t('orphanSessions', { count: orphanNotice.sessions })
            : null}{' '}
          {orphanNotice.splits > 0
            ? t('orphanSplits', { count: orphanNotice.splits })
            : null}{' '}
          {t('orphanSorry')}
        </button>
      ) : null}
      {showOffline ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-silver/25 bg-card px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] text-muted-foreground">
          <CloudOff className="size-3" aria-hidden="true" />
          {t('badge')}
        </span>
      ) : null}
      {showSync ? (
        <button
          type="button"
          onClick={() => {
            if (canRetry) void refresh()
          }}
          disabled={!canRetry}
          title={lastError || undefined}
          className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-gold disabled:cursor-default"
        >
          <RefreshCw
            className={`size-3 ${syncing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {syncing
            ? t('syncing', { count: pendingCount })
            : t('queued', { count: pendingCount })}
        </button>
      ) : null}
      {canRetry ? (
        <button
          type="button"
          onClick={() => void refresh()}
          title={lastError || undefined}
          className="max-w-full truncate text-end text-[10px] font-semibold text-gold underline-offset-2 hover:underline"
        >
          {t('retrySync')}
        </button>
      ) : lastError && pendingCount > 0 ? (
        <p className="max-w-full truncate text-end text-[10px] font-semibold text-destructive">
          {lastError}
        </p>
      ) : null}
    </div>
  )
}
