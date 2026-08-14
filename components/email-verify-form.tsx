'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Loader2, Mail } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { triggerIronStackNavTransition } from '@/components/nav-transition-overlay'
import { clearIronstackAuthCache } from '@/components/use-is-guest'
import { claimUsernameAction } from '@/lib/data/profile-actions'
import {
  sendVerificationCode,
  verifyEmailCode,
} from '@/lib/email-verification'
import { createClient } from '@/lib/supabase/client'

/** Client-side UX cooldown; server also enforces ~60s. */
const RESEND_COOLDOWN_SEC = 60

type EmailVerifyFormProps = {
  email: string
  /** Username from signup metadata — claimed after a successful verify. */
  username?: string
  /** When true, skip the initial client cooldown (e.g. redirected mid-session). */
  skipInitialCooldown?: boolean
  /** Shown once when the form mounts (e.g. first send failed after signup). */
  initialError?: string | null
  onBack: () => void
  /** Optional override after a successful verify (defaults to dashboard home). */
  onVerified?: () => void
}

function errorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  return fallback
}

export function EmailVerifyForm({
  email,
  username,
  skipInitialCooldown = false,
  initialError = null,
  onBack,
  onVerified,
}: EmailVerifyFormProps) {
  const t = useTranslations('auth')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(initialError)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [cooldown, setCooldown] = useState(
    skipInitialCooldown ? 0 : RESEND_COOLDOWN_SEC,
  )

  useEffect(() => {
    if (cooldown <= 0) return
    const id = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [cooldown])

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setInfo(null)

    const token = code.replace(/\D/g, '')
    if (token.length !== 6) {
      setError(t('verifyInvalidCode'))
      return
    }

    setLoading(true)
    try {
      await verifyEmailCode(supabase, token)

      const handle = username?.trim().toLowerCase()
      if (handle && /^[a-z0-9_]{3,30}$/.test(handle)) {
        const claim = await claimUsernameAction({
          username: handle,
          displayName: email.split('@')[0],
        })
        if (!claim.ok) {
          console.warn('Username claim after verify failed:', claim.error)
        }
      }

      triggerIronStackNavTransition()
      clearIronstackAuthCache()
      if (onVerified) {
        onVerified()
      } else {
        router.push('/dashboard/home')
        router.refresh()
      }
    } catch (err) {
      setError(errorMessage(err, t('verifyInvalidCode')))
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return
    setError(null)
    setInfo(null)
    setResending(true)
    try {
      await sendVerificationCode(supabase)
      setInfo(t('verifyResent'))
      setCooldown(RESEND_COOLDOWN_SEC)
    } catch (err) {
      setError(errorMessage(err, t('verifyInvalidCode')))
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
          <Mail className="size-5" aria-hidden="true" />
        </span>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t('verifyBody', { email })}
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold/80"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{error}</p>
        </div>
      )}

      {info && (
        <p role="status" className="text-center text-sm text-gold/80">
          {info}
        </p>
      )}

      <form onSubmit={handleVerify} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="verify-code"
            className="text-sm font-medium text-muted-foreground"
          >
            {t('verifyCodeLabel')}
          </label>
          <input
            id="verify-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
            }}
            placeholder="000000"
            className="h-12 w-full rounded-xl border border-border bg-card/90 px-4 text-center font-mono text-xl tracking-[0.4em] text-foreground placeholder:tracking-[0.4em] placeholder:text-muted-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </div>

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="cta-pulse flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-sm font-bold tracking-[0.2em] text-black transition-all duration-300 hover:scale-[1.02] hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
        >
          {loading && (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          )}
          {t('verifySubmit')}
        </button>
      </form>

      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          disabled={cooldown > 0 || resending}
          onClick={handleResend}
          className="text-sm font-medium text-gold transition hover:text-gold/80 disabled:cursor-not-allowed disabled:text-muted-foreground"
        >
          {resending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              {t('pleaseWait')}
            </span>
          ) : cooldown > 0 ? (
            t('verifyResendWait', { seconds: cooldown })
          ) : (
            t('verifyResend')
          )}
        </button>

        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted-foreground transition hover:text-foreground"
        >
          {t('verifyBack')}
        </button>
      </div>
    </div>
  )
}
