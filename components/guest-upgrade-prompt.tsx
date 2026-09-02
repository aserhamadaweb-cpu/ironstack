'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import {
  buildGuestSignupHref,
  type GuestBlockedReason,
} from '@/lib/guest-access'

type GuestUpgradePromptProps = {
  open: boolean
  onClose: () => void
  reason?: GuestBlockedReason
  returnPath?: string | null
}

export function GuestUpgradePrompt({
  open,
  onClose,
  reason = 'generic',
  returnPath,
}: GuestUpgradePromptProps) {
  const t = useTranslations('guest')
  const tBlocked = useTranslations('guest.blocked')
  const tNav = useTranslations('nav')

  if (!open) return null

  const signupHref = buildGuestSignupHref(
    returnPath ??
      (typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.search}`
        : null),
  )

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-[var(--overlay-scrim)]"
        aria-label={tNav('closeMenu')}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-upgrade-title"
        className="is-panel relative z-10 w-full max-w-sm rounded-t-2xl p-5 sm:rounded-2xl"
      >
        <p
          id="guest-upgrade-title"
          className="text-sm leading-relaxed text-foreground"
        >
          {tBlocked(reason)}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href={signupHref}
            className="btn-pill inline-flex min-h-11 items-center justify-center bg-gold px-4 text-xs font-bold tracking-[0.16em] text-black"
            onClick={onClose}
          >
            {t('createAccountCta')}
          </Link>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-full text-xs font-semibold tracking-[0.14em] text-muted-foreground"
            onClick={onClose}
          >
            {tNav('closeMenu')}
          </button>
        </div>
      </div>
    </div>
  )
}
