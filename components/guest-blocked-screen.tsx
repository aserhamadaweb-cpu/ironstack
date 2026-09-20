'use client'

import Link from 'next/link'
import { Dumbbell } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  buildGuestSignupHref,
  type GuestBlockedReason,
} from '@/lib/guest-access'

type GuestBlockedScreenProps = {
  reason: GuestBlockedReason
  returnPath?: string
}

export function GuestBlockedScreen({
  reason,
  returnPath,
}: GuestBlockedScreenProps) {
  const t = useTranslations('guest')
  const tBlocked = useTranslations('guest.blocked')

  return (
    <main
      className="relative flex min-h-[60svh] items-center justify-center px-4 py-12 text-foreground"
      data-tour="guest-blocked"
    >
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10">
          <Dumbbell className="size-5 text-gold" aria-hidden="true" />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {tBlocked(reason)}
        </p>
        <Link
          href={buildGuestSignupHref(returnPath)}
          className="btn-pill mt-5 inline-flex min-h-11 w-full items-center justify-center bg-gold px-4 text-xs font-bold tracking-[0.16em] text-black"
        >
          {t('createAccountCta')}
        </Link>
        <Link
          href="/dashboard/home"
          className="mt-3 inline-flex min-h-11 items-center justify-center text-xs font-semibold tracking-[0.14em] text-muted-foreground"
        >
          {t('browseHome')}
        </Link>
      </div>
    </main>
  )
}
