'use client'

import { FormEvent, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EmailVerifyForm } from '@/components/email-verify-form'
import { clearProfileOnboardingCache } from '@/components/choose-username-gate'
import { clearIronstackAuthCache } from '@/components/use-is-guest'
import { sendVerificationCode } from '@/lib/email-verification'
import { createClient } from '@/lib/supabase/client'

export function GuestAccountUpgrade() {
  const t = useTranslations('guest')
  const tAuth = useTranslations('auth')
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [step, setStep] = useState<'form' | 'verify'>('form')
  const [verifyEmail, setVerifyEmail] = useState('')

  function submitUpgrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const nextEmail = email.trim()
    if (!nextEmail || password.length < 6) {
      setError(t('upgradePasswordHint'))
      return
    }

    startTransition(async () => {
      const { error: updateError } = await supabase.auth.updateUser({
        email: nextEmail,
        password,
      })
      if (updateError) {
        setError(updateError.message)
        return
      }

      try {
        await sendVerificationCode(supabase)
      } catch (err) {
        setVerifyEmail(nextEmail)
        setStep('verify')
        setError(
          err instanceof Error && err.message
            ? err.message
            : tAuth('verifySendFailed'),
        )
        return
      }

      setVerifyEmail(nextEmail)
      setStep('verify')
    })
  }

  if (step === 'verify') {
    return (
      <div className="is-panel p-5">
        <EmailVerifyForm
          email={verifyEmail}
          skipInitialCooldown={false}
          initialError={error}
          onBack={() => {
            setStep('form')
            setError(null)
          }}
          onVerified={() => {
            clearIronstackAuthCache()
            clearProfileOnboardingCache()
            router.push('/dashboard/home')
            router.refresh()
          }}
        />
      </div>
    )
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
          className="btn-pill disabled:opacity-50"
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
