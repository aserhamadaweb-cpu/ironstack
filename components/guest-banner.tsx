'use client'

import Link from 'next/link'
import { UserRound } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function GuestBanner() {
  const t = useTranslations('guest')

  return (
    <div className="border-b border-gold/25 bg-gold/10">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:px-6">
        <p className="flex min-w-0 items-center gap-2 text-[11px] leading-snug text-gold sm:text-sm">
          <UserRound className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{t('banner')}</span>
        </p>
        <Link
          href="/dashboard/settings"
          className="inline-flex h-9 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/15 px-3 text-[10px] font-bold tracking-[0.12em] text-gold transition active:bg-gold/25 sm:h-11 sm:px-4 sm:tracking-[0.14em]"
        >
          {t('saveProgress')}
        </Link>
      </div>
    </div>
  )
}
