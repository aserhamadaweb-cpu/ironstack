'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AuthEntryShell } from '@/components/auth-entry-shell'
import { buildAuthEntryHref } from '@/lib/auth-entry'
import {
  friendlyAuthError,
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
    staleClient: t('staleClient'),
    rateLimited: t('rateLimited'),
    generic: t('generic'),
  }
}

export function UpdatePasswordClient() {
  const t = useTranslations('auth')
  const copy = useMemo(() => authCopy(t), [t])
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function establishSession() {
      const hash = window.location.hash?.replace(/^#/, '') ?? ''
      if (hash.includes('access_token=')) {
        const params = new URLSearchParams(hash)
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        if (access_token && refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          })
          if (!sessionError) {
            window.history.replaceState(
              null,
              '',
              `${window.location.pathname}${window.location.search}`,
            )
          }
        }
      }

      const { data } = await supabase.auth.getSession()
      if (!cancelled) {
        setHasSession(Boolean(data.session))
        setCheckingSession(false)
      }
    }

    void establishSession()
    return () => {
      cancelled = true
    }
  }, [supabase])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError(copy.weakPassword)
      return
    }
    if (password !== confirmPassword) {
      setError(copy.passwordMismatch)
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError(friendlyAuthError(updateError.message, copy, updateError.code))
        return
      }

      await supabase.auth.signOut()
      setDone(true)
      window.setTimeout(() => {
        router.replace(buildAuthEntryHref({ mode: 'signin' }))
      }, 1200)
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background text-foreground">
        <Loader2 className="size-6 animate-spin text-gold" aria-hidden="true" />
      </main>
    )
  }

  if (!hasSession) {
    return (
      <AuthEntryShell
        kicker={t('updatePasswordKicker')}
        title={t('updatePasswordTitle')}
        body={t('callbackExpired')}
        backHref="/login/reset-password"
        backLabel={t('resetPasswordSubmit')}
      >
        <Link
          href="/login/reset-password"
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gold px-4 text-sm font-semibold tracking-wide text-black transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
        >
          {t('resetPasswordSubmit')}
        </Link>
      </AuthEntryShell>
    )
  }

  return (
    <AuthEntryShell
      kicker={t('updatePasswordKicker')}
      title={t('updatePasswordTitle')}
      body={t('updatePasswordBody')}
      backHref={buildAuthEntryHref()}
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

      {done ? (
        <p className="text-center text-sm text-muted-foreground" role="status">
          {t('updatePasswordSuccess')}
        </p>
      ) : (
        <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-2">
            <label htmlFor="new-password" className="text-sm font-medium text-muted-foreground">
              {t('newPassword')}
            </label>
            <div className="relative">
              <input
                id="new-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                className="h-11 w-full rounded-xl border border-border bg-card/90 px-4 pe-11 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute top-1/2 end-1 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
              >
                {showPassword ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="confirm-new-password"
              className="text-sm font-medium text-muted-foreground"
            >
              {t('confirmPassword')}
            </label>
            <input
              id="confirm-new-password"
              name="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="••••••••"
              className="h-11 w-full rounded-xl border border-border bg-card/90 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="cta-pulse btn-pill btn-pill-primary mt-2 inline-flex min-h-14 w-full items-center justify-center gap-2 px-10 py-4 text-sm font-bold tracking-[0.25em] transition-transform duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : null}
            {t('updatePasswordSubmit')}
          </button>
        </form>
      )}
    </AuthEntryShell>
  )
}
