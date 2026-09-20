'use client'

import { FormEvent, useMemo, useState, useTransition } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { clearProfileOnboardingCache } from '@/components/choose-username-gate'
import { clearIronstackAuthCache } from '@/components/use-is-guest'
import { upgradeGuestAccount } from '@/app/login/actions'
import { CTA_PRIMARY } from '@/lib/accent'

/**
 * Guest → permanent email/password upgrade.
 * Runs on the server so the new session is stored in HTTP cookies.
 */
export function GuestAccountUpgrade() {
  const t = useTranslations('guest')
  const tAuth = useTranslations('auth')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function submitUpgrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError(null)

    const nextEmail = email.trim()
    if (!nextEmail || password.length < 6) {
      setError(t('upgradePasswordHint'))
      return
    }

    startTransition(async () => {
      clearIronstackAuthCache()
      clearProfileOnboardingCache()

      const formData = new FormData()
      formData.set('email', nextEmail)
      formData.set('password', password)

      const result = await upgradeGuestAccount(null, formData)
      if (result?.error) {
        setError(result.error)
      }
    })
  }

  return (
    <div className="is-panel space-y-5 p-5">
      <div>
        <h3 className="font-heading text-lg font-bold text-headline">
          {t('upgradeTitle')}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">{t('upgradeBody')}</p>
      </div>

      <form className="space-y-4" onSubmit={submitUpgrade}>
        <label className="block text-sm text-foreground">
          {tAuth('email')}
          <input
            type="email"
            name="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="mt-2 h-11 w-full rounded-xl border border-silver/15 bg-background/70 px-3 text-sm outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30"
          />
        </label>

        <label className="block text-sm text-foreground">
          {tAuth('password')}
          <div className="relative mt-2">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="h-11 w-full rounded-xl border border-silver/15 bg-background/70 px-3 pe-11 text-sm outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold/30"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 end-3 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
              aria-label={
                showPassword ? tAuth('hidePassword') : tAuth('showPassword')
              }
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t('upgradePasswordHint')}
          </p>
        </label>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className={`${CTA_PRIMARY} disabled:opacity-50`}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {t('upgradeSubmit')}
        </button>
      </form>
    </div>
  )
}
