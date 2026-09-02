'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AuthEntryShell } from '@/components/auth-entry-shell'
import { buildAuthCallbackUrl } from '@/lib/auth-callback-url'
import { buildAuthEntryHref } from '@/lib/auth-entry'
import {
  friendlyAuthError,
  isValidEmail,
  type AuthCopy,
} from '@/lib/auth-errors'
import { createClient } from '@/lib/supabase/client'

function authCopy(t: ReturnType<typeof useTranslations<'auth'>>): AuthCopy {
  return {
    invalidEmail: t('invalidEmail'),
    weakPassword: t('weakPassword'),
    passwordMismatch: t('passwordMismatch'),
    invalidCredentials: t('invalidCredentials'),
    alreadyRegistered: t('alreadyRegistered'),
    confirmEmail: t('confirmEmail'),
    oauthCancelled: t('oauthCancelled'),
    socialFailed: t('socialFailed'),
    network: t('network'),
    rateLimited: t('rateLimited'),
    generic: t('generic'),
  }
}

export function ResetPasswordClient() {
  const t = useTranslations('auth')
  const copy = useMemo(() => authCopy(t), [t])
  const supabase = useMemo(() => createClient(), [])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const trimmed = email.trim()
    if (!isValidEmail(trimmed)) {
      setError(copy.invalidEmail)
      return
    }

    setLoading(true)
    try {
      const redirectTo = buildAuthCallbackUrl(
        '/login/update-password',
        typeof window !== 'undefined' ? window.location.origin : undefined,
      )
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        trimmed,
        { redirectTo },
      )
      if (resetError) {
        setError(friendlyAuthError(resetError.message, copy, resetError.code))
        return
      }
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthEntryShell
      kicker={t('resetPasswordKicker')}
      title={t('resetPasswordTitle')}
      body={t('resetPasswordBody')}
      backHref={buildAuthEntryHref()}
      backLabel={t('resetPasswordBack')}
    >
      {error ? (
        <div
          role="alert"
          className="mb-4 flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold/80"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      ) : null}

      {sent ? (
        <div className="space-y-6 text-center">
          <p className="text-sm leading-relaxed text-muted-foreground" role="status">
            {t('resetPasswordSuccess')}
          </p>
          <Link
            href={buildAuthEntryHref()}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gold px-4 text-sm font-semibold tracking-wide text-black transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          >
            {t('resetPasswordBack')}
          </Link>
        </div>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor="reset-email" className="text-sm font-medium text-muted-foreground">
              {t('email')}
            </label>
            <input
              id="reset-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="h-11 w-full rounded-xl border border-border bg-card/90 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="cta-pulse btn-pill mt-2 inline-flex min-h-14 w-full items-center justify-center gap-2 bg-gold px-10 py-4 text-sm font-bold tracking-[0.25em] text-black shadow-[0_0_28px_-8px_rgba(232,181,74,0.55)] transition-transform duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
            {t('resetPasswordSubmit')}
          </button>
        </form>
      )}
    </AuthEntryShell>
  )
}
