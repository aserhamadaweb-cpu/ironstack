'use client'

import Link from 'next/link'
import { UserRound } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function GuestBanner() {
  const t = useTranslations('guest')

  return (
    <div className="border-b border-gold/25 bg-gold/10">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="flex items-start gap-2 text-xs text-gold sm:items-center sm:text-sm">
          <UserRound className="mt-0.5 size-4 shrink-0 sm:mt-0" aria-hidden="true" />
          <span>{t('banner')}</span>
        </p>
        <Link
          href="/dashboard/settings"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/15 px-4 text-[10px] font-bold tracking-[0.14em] text-gold transition active:bg-gold/25"
        >
          {t('saveProgress')}
        </Link>
      </div>
    </div>
  )
}
