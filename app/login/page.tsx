'use client'

import {
  FormEvent,
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  CheckCircle2,
  Dumbbell,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  Moon,
  Sun,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { updateLanguagePreferenceAction } from '@/lib/data/profile-actions'
import { suggestUsernameFromEmail } from '@/lib/profile-path'
import { triggerIronStackNavTransition } from '@/components/nav-transition-overlay'
import { useTheme } from '@/components/theme-provider'
import {
  clearIronstackAuthCache,
} from '@/components/use-is-guest'
import { applyLocaleToDocument, type AppLocale } from '@/lib/i18n'
import type { ThemePreference } from '@/lib/theme'
import {
  displayToKg,
  feetInchesToCm,
  isValidBirthDate,
  isValidHeightCm,
  isValidWeightKg,
  type WeightUnit,
} from '@/lib/units'
import type { ProfileGender } from '@/lib/database.types'

type AuthMode = 'signin' | 'signup'
type OAuthProvider = 'google'

const RESEND_COOLDOWN_SEC = 60

function isEmailNotConfirmed(error: { message: string; code?: string }) {
  const lower = error.message.toLowerCase()
  return (
    error.code === 'email_not_confirmed' ||
    lower.includes('email not confirmed')
  )
}

function friendlyAuthError(
  message: string,
  t: ReturnType<typeof useTranslations<'auth'>>,
  code?: string,
) {
  if (isEmailNotConfirmed({ message, code })) {
    return t('confirmEmail')
  }
  const lower = message.toLowerCase()
  if (lower.includes('invalid login credentials')) {
    return t('invalidCredentials')
  }
  if (lower.includes('user already registered')) {
    return t('alreadyRegistered')
  }
  return message
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12z"
      />
      <path
        fill="#34A853"
        d="M6.6 14.3l-.9.7-2.5 1.9C4.8 20 8.1 22 12 22c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 1-3.6 1-2.8 0-5.1-1.9-5.9-4.4z"
      />
      <path
        fill="#FBBC05"
        d="M3.2 7.1C2.4 8.6 2 10.2 2 12s.4 3.4 1.2 4.9l3.4-2.6C6.2 13.4 6 12.7 6 12s.2-1.4.6-2.3L3.2 7.1z"
      />
      <path
        fill="#4285F4"
        d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9C16.9 2.7 14.7 2 12 2 8.1 2 4.8 4 3.2 7.1l3.4 2.6C7 7.8 9.2 5.9 12 5.9z"
      />
    </svg>
  )
}

function LoginPageContent() {
  const t = useTranslations('auth')
  const tSettings = useTranslations('settings')
  const locale = useLocale()
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null)
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'auth_callback_failed'
      ? t('socialFailed')
      : null,
  )
  const [success, setSuccess] = useState<string | null>(null)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [unit, setUnit] = useState<WeightUnit>('kg')
  const [gender, setGender] = useState<ProfileGender | ''>('')
  const [birthDate, setBirthDate] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [heightFt, setHeightFt] = useState('5')
  const [heightIn, setHeightIn] = useState('10')
  const [weight, setWeight] = useState('')
  const [signupLanguage, setSignupLanguage] = useState<AppLocale>(
    locale === 'ar' ? 'ar' : 'en',
  )
  const [guestLoading, setGuestLoading] = useState(false)
  const [awaitingConfirm, setAwaitingConfirm] = useState(false)
  const [pendingConfirmEmail, setPendingConfirmEmail] = useState('')
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const isBusy = loading || oauthLoading !== null || guestLoading || resending

  function handleSignupLanguage(next: AppLocale) {
    if (next === signupLanguage) return
    setSignupLanguage(next)
    applyLocaleToDocument(next)
    void updateLanguagePreferenceAction(next).then(() => {
      router.refresh()
    })
  }

  function handleSignupTheme(next: ThemePreference) {
    setTheme(next)
  }

  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [resendCooldown])

  function confirmationRedirectTo() {
    const siteOrigin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
      window.location.origin
    return new URL('/auth/callback?next=/dashboard/home', siteOrigin).href
  }

  function showCheckEmail(nextEmail: string, startCooldown = true) {
    setPendingConfirmEmail(nextEmail)
    setAwaitingConfirm(true)
    setError(null)
    setSuccess(null)
    setResendCooldown(startCooldown ? RESEND_COOLDOWN_SEC : 0)
  }

  async function handleResendConfirmation() {
    if (resendCooldown > 0 || resending) return
    const target = (pendingConfirmEmail || email).trim()
    if (!target) return
    setError(null)
    setSuccess(null)
    setResending(true)
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email: target,
        options: { emailRedirectTo: confirmationRedirectTo() },
      })
      if (resendError) {
        setError(resendError.message || t('resendFailed'))
        return
      }
      setSuccess(t('confirmationResent'))
      setResendCooldown(RESEND_COOLDOWN_SEC)
    } finally {
      setResending(false)
    }
  }

  const signupBodyReady =
    Boolean(gender) &&
    Boolean(birthDate) &&
    Boolean(weight) &&
    (unit === 'lb' ? Boolean(heightFt) : Boolean(heightCm))

  function resolveSignupMetrics():
    | { ok: true; height_cm: number; weight_kg: number; gender: ProfileGender; birth_date: string }
    | { ok: false; error: string } {
    if (gender !== 'male' && gender !== 'female') {
      return { ok: false, error: t('bodyGenderRequired') }
    }
    if (!isValidBirthDate(birthDate)) {
      return { ok: false, error: t('bodyBirthInvalid') }
    }

    const height =
      unit === 'lb'
        ? feetInchesToCm(Number(heightFt), Number(heightIn))
        : Number(heightCm)
    if (!isValidHeightCm(height)) {
      return { ok: false, error: t('bodyHeightInvalid') }
    }

    const weightDisplay = Number(weight)
    if (!Number.isFinite(weightDisplay)) {
      return { ok: false, error: t('bodyWeightInvalid') }
    }
    const weight_kg = displayToKg(weightDisplay, unit)
    if (!isValidWeightKg(weight_kg)) {
      return { ok: false, error: t('bodyWeightInvalid') }
    }

    return {
      ok: true,
      height_cm: Math.round(height * 10) / 10,
      weight_kg: Math.round(weight_kg * 100) / 100,
      gender,
      birth_date: birthDate,
    }
  }

  async function handleContinueAsGuest() {
    setError(null)
    setSuccess(null)
    setGuestLoading(true)
    try {
      const { error: guestError } = await supabase.auth.signInAnonymously()
      if (guestError) {
        setError(friendlyAuthError(guestError.message, t))
        return
      }
      triggerIronStackNavTransition()
      router.push('/dashboard/home')
      router.refresh()
    } finally {
      setGuestLoading(false)
    }
  }

  async function handleOAuth(provider: OAuthProvider) {
    setError(null)
    setSuccess(null)

    if (mode === 'signup' && !agreedToTerms) {
      setError(t('mustAgree'))
      return
    }

    setOauthLoading(provider)

    // Always build a plain absolute URL — never pass markdown link syntax
    // like "[https://...](https://...)" which breaks Supabase's URL parser.
    const siteOrigin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
      window.location.origin
    const redirectTo = new URL('/auth/callback', siteOrigin)
    redirectTo.searchParams.set('next', '/dashboard/home')

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectTo.href,
        skipBrowserRedirect: false,
      },
    })

    if (oauthError) {
      setError(friendlyAuthError(oauthError.message, t))
      setOauthLoading(null)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      if (mode === 'signin') {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          })

        if (signInError) {
          if (isEmailNotConfirmed(signInError)) {
            showCheckEmail(email.trim(), false)
            setError(t('confirmEmail'))
            return
          }
          setError(friendlyAuthError(signInError.message, t, signInError.code))
          return
        }

        clearIronstackAuthCache()
        triggerIronStackNavTransition()
        router.push('/dashboard/home')
        router.refresh()
        return
      }

      if (!agreedToTerms) {
        setError(t('mustAgree'))
        return
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        return
      }

      const handle = username.trim().toLowerCase()
      if (!/^[a-z0-9_]{3,30}$/.test(handle)) {
        setError(
          'Username must be 3–30 characters: lowercase letters, numbers, underscores.',
        )
        return
      }

      const metrics = resolveSignupMetrics()
      if (!metrics.ok) {
        setError(metrics.error)
        return
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: email.trim().split('@')[0],
            username: handle,
            height_cm: metrics.height_cm,
            gender: metrics.gender,
            birth_date: metrics.birth_date,
            weight_kg: metrics.weight_kg,
            language: signupLanguage,
            theme_preference: theme,
          },
          emailRedirectTo: confirmationRedirectTo(),
        },
      })

      if (signUpError) {
        setError(friendlyAuthError(signUpError.message, t, signUpError.code))
        return
      }

      const identities = data.user?.identities ?? []
      if (data.user && identities.length === 0) {
        setError(t('alreadyRegistered'))
        return
      }

      if (data.session) {
        await supabase.auth.signOut()
      }

      showCheckEmail(email.trim())
    } finally {
      setLoading(false)
    }
  }

  const oauthButtons: {
    provider: OAuthProvider
    label: string
    icon: ReactNode
    className: string
  }[] = [
    {
      provider: 'google',
      label: t('continueGoogle'),
      icon: <GoogleIcon className="size-5" />,
      className:
        'border-border/80 bg-card/80 text-foreground hover:border-border hover:bg-muted/80',
    },
  ]

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 pt-[calc(env(safe-area-inset-top)+5.5rem)] pb-12 text-foreground">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-radial from-gold/15 via-transparent to-transparent"
        aria-hidden="true"
      />

      <header className="fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)]">
        <nav
          aria-label={t('loginNav')}
          className="glass-card nav-slide-down mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-full border border-silver/20 px-3 py-1.5 sm:px-6 sm:py-3"
        >
          <Link
            href="/"
            className="flex min-h-11 items-center gap-2 rounded-full px-1 active:opacity-80"
          >
            <Dumbbell className="size-5 text-gold" aria-hidden="true" />
            <span className="font-heading text-metallic text-lg font-bold tracking-[0.25em]">
              IRONSTACK
            </span>
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full border border-gold/40 px-4 text-xs font-semibold tracking-[0.15em] text-gold transition-all duration-200 active:scale-95 active:bg-gold/10"
          >
            {t('backHome')}
          </Link>
        </nav>
      </header>

      <div className="relative z-10 w-full max-w-md">
        <div className="fade-up mb-8 flex flex-col items-center gap-3 text-center">
          <p className="text-xs font-semibold tracking-[0.35em] text-gold">
            {awaitingConfirm
              ? t('checkEmailKicker')
              : mode === 'signin'
                ? t('welcomeBack')
                : t('joinIronstack')}
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {awaitingConfirm
              ? t('checkEmailTitle')
              : mode === 'signin'
                ? t('readyNextSet')
                : t('startStacking')}
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {awaitingConfirm
              ? t('checkEmail')
              : mode === 'signin'
                ? t('signinBody')
                : t('signupBody')}
          </p>
        </div>

        <div className="fade-up rounded-2xl border border-gold/25 bg-card/60 p-6 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-8">
          {awaitingConfirm ? (
            <div className="flex flex-col items-center gap-5 text-center">
              <span className="flex size-12 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 text-gold">
                <Mail className="size-5" aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {t('checkEmailBody', { email: pendingConfirmEmail || email })}
              </p>

              {error && (
                <div
                  role="alert"
                  className="flex w-full items-start gap-3 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-start text-sm text-gold/80"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p>{error}</p>
                </div>
              )}

              {success && (
                <div
                  role="status"
                  className="flex w-full items-start gap-3 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-start text-sm text-gold/80"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p>{success}</p>
                </div>
              )}

              <button
                type="button"
                disabled={resendCooldown > 0 || resending}
                onClick={() => void handleResendConfirmation()}
                className="text-sm font-medium text-gold transition hover:text-gold/80 disabled:cursor-not-allowed disabled:text-muted-foreground"
              >
                {resending ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    {t('pleaseWait')}
                  </span>
                ) : resendCooldown > 0 ? (
                  t('resendWait', { seconds: resendCooldown })
                ) : (
                  t('resendConfirmation')
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAwaitingConfirm(false)
                  setMode('signin')
                  setError(null)
                  setSuccess(null)
                  if (pendingConfirmEmail) setEmail(pendingConfirmEmail)
                }}
                className="text-sm text-muted-foreground transition hover:text-foreground"
              >
                {t('verifyBack')}
              </button>
            </div>
          ) : (
            <>
          <div className="mb-6 grid grid-cols-2 rounded-xl border border-border bg-background/70 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setError(null)
                setSuccess(null)
                setAgreedToTerms(false)
              }}
              className={`flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                mode === 'signin'
                  ? 'border border-gold/30 bg-gold/10 text-gold'
                  : 'text-muted-foreground active:text-foreground'
              }`}
            >
              {t('signIn')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setError(null)
                setSuccess(null)
                if (!usernameTouched && email) {
                  setUsername(suggestUsernameFromEmail(email))
                }
              }}
              className={`flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${
                mode === 'signup'
                  ? 'border border-gold/30 bg-gold/10 text-gold'
                  : 'text-muted-foreground active:text-foreground'
              }`}
            >
              {t('createAccount')}
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold/80"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>{error}</p>
            </div>
          )}

          {success && (
            <div
              role="status"
              className="mb-4 flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold/80"
            >
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>{success}</p>
            </div>
          )}

          {mode === 'signup' && (
            <label className="mb-4 flex items-start gap-3 rounded-xl border border-border/80 bg-background/50 px-3 py-3 text-sm leading-relaxed text-muted-foreground">
              <span className="flex size-11 shrink-0 items-center justify-center">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(event) => setAgreedToTerms(event.target.checked)}
                  className="size-5 accent-[var(--gold)]"
                />
              </span>
              <span>
                {t('agreePrefix')}{' '}
                <Link
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-gold underline-offset-2 hover:underline"
                >
                  {t('termsOfService')}
                </Link>{' '}
                {t('agreeAnd')}{' '}
                <Link
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-gold underline-offset-2 hover:underline"
                >
                  {t('privacyPolicy')}
                </Link>
              </span>
            </label>
          )}

          <div className="flex flex-col gap-3">
            {oauthButtons.map((button) => (
              <button
                key={button.provider}
                type="button"
                disabled={isBusy || (mode === 'signup' && !agreedToTerms)}
                onClick={() => handleOAuth(button.provider)}
                className={`flex h-11 w-full items-center justify-center gap-3 rounded-xl border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${button.className}`}
              >
                {oauthLoading === button.provider ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  button.icon
                )}
                {button.label}
              </button>
            ))}
            <button
              type="button"
              disabled={isBusy}
              onClick={handleContinueAsGuest}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gold/35 bg-gold/5 text-sm font-semibold text-gold transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guestLoading ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : null}
              {t('continueAsGuest')}
            </button>
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gold/20" />
            <span className="text-xs font-medium tracking-wider text-gold/80/45 uppercase">
              {t('orEmail')}
            </span>
            <div className="h-px flex-1 bg-gold/20" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-muted-foreground">
                {t('email')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => {
                  const next = event.target.value
                  setEmail(next)
                  if (mode === 'signup' && !usernameTouched) {
                    setUsername(suggestUsernameFromEmail(next))
                  }
                }}
                placeholder="you@example.com"
                className="h-11 w-full rounded-xl border border-border bg-card/90 px-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </div>

            {mode === 'signup' && (
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="username"
                  className="text-sm font-medium text-muted-foreground"
                >
                  {t('username')}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 start-4 -translate-y-1/2 text-sm text-muted-foreground">
                    @
                  </span>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    required
                    minLength={3}
                    maxLength={30}
                    autoComplete="username"
                    value={username}
                    onChange={(event) => {
                      setUsernameTouched(true)
                      setUsername(
                        event.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, ''),
                      )
                    }}
                    placeholder="your_handle"
                    className="h-11 w-full rounded-xl border border-border bg-card/90 py-2 pe-4 ps-8 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Suggested from your email — edit before continuing.
                </p>
              </div>
            )}

            {mode === 'signup' && (
              <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-background/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {t('bodyStats')}
                  </p>
                  <div className="inline-flex rounded-lg border border-silver/15 p-0.5">
                    {(['kg', 'lb'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={unit === option}
                        onClick={() => setUnit(option)}
                        className={`min-h-8 rounded-md px-2.5 text-[10px] font-bold tracking-[0.12em] ${
                          unit === option
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {option.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('bodyHeight')}
                    </span>
                    {unit === 'lb' ? (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          required
                          min={3}
                          max={8}
                          value={heightFt}
                          onChange={(e) => setHeightFt(e.target.value)}
                          aria-label={t('bodyFeet')}
                          className="h-11 w-full rounded-xl border border-border bg-card/90 px-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                        />
                        <input
                          type="number"
                          required
                          min={0}
                          max={11}
                          value={heightIn}
                          onChange={(e) => setHeightIn(e.target.value)}
                          aria-label={t('bodyInches')}
                          className="h-11 w-full rounded-xl border border-border bg-card/90 px-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                        />
                      </div>
                    ) : (
                      <input
                        type="number"
                        required
                        min={100}
                        max={250}
                        value={heightCm}
                        onChange={(e) => setHeightCm(e.target.value)}
                        placeholder="175"
                        className="h-11 w-full rounded-xl border border-border bg-card/90 px-4 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                      />
                    )}
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('bodyWeight')}
                    </span>
                    <input
                      type="number"
                      required
                      min={0}
                      step="0.1"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder={unit === 'kg' ? '75' : '165'}
                      className="h-11 w-full rounded-xl border border-border bg-card/90 px-4 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                    />
                  </label>
                </div>

                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    {t('bodyGender')}
                  </p>
                  <div className="inline-flex rounded-xl border border-silver/15 p-1">
                    {(['male', 'female'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={gender === option}
                        onClick={() => setGender(option)}
                        className={`min-h-10 rounded-lg px-4 text-xs font-semibold tracking-[0.12em] ${
                          gender === option
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {option === 'male' ? t('bodyMale') : t('bodyFemale')}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t('bodyBirthDate')}
                  </span>
                  <input
                    type="date"
                    required
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-card/90 px-4 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                </label>
              </div>
            )}

            {mode === 'signup' && (
              <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-background/40 p-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t('signupLanguage')}
                  </p>
                  <div
                    className="mt-2 grid grid-cols-2 gap-2"
                    role="group"
                    aria-label={t('signupLanguage')}
                  >
                    {(
                      [
                        {
                          value: 'en' as AppLocale,
                          label: tSettings('langEn'),
                          hint: tSettings('langEnHint'),
                        },
                        {
                          value: 'ar' as AppLocale,
                          label: tSettings('langAr'),
                          hint: tSettings('langArHint'),
                        },
                      ] as const
                    ).map(({ value, label, hint }) => {
                      const selected = signupLanguage === value
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => handleSignupLanguage(value)}
                          className={`flex min-h-16 flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-start transition ${
                            selected
                              ? 'border-gold/45 bg-gold-tint text-gold'
                              : 'border-border bg-background/60 text-muted-foreground'
                          }`}
                        >
                          <span className="text-sm font-semibold tracking-wide text-foreground">
                            {label}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {hint}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">
                    {t('signupTheme')}
                  </p>
                  <div
                    className="mt-2 grid grid-cols-2 gap-2"
                    role="group"
                    aria-label={t('signupTheme')}
                  >
                    {(
                      [
                        {
                          value: 'dark' as ThemePreference,
                          label: tSettings('themeDark'),
                          hint: tSettings('themeDarkHint'),
                          Icon: Moon,
                        },
                        {
                          value: 'light' as ThemePreference,
                          label: tSettings('themeLight'),
                          hint: tSettings('themeLightHint'),
                          Icon: Sun,
                        },
                      ] as const
                    ).map(({ value, label, hint, Icon }) => {
                      const selected = theme === value
                      return (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => handleSignupTheme(value)}
                          className={`flex min-h-16 flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-start transition ${
                            selected
                              ? 'border-gold/45 bg-gold-tint text-gold'
                              : 'border-border bg-background/60 text-muted-foreground'
                          }`}
                        >
                          <Icon className="size-4" aria-hidden="true" />
                          <span className="text-sm font-semibold tracking-wide text-foreground">
                            {label}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {hint}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-muted-foreground"
              >
                {t('password')}
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  autoComplete={
                    mode === 'signup' ? 'new-password' : 'current-password'
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className="h-11 w-full rounded-xl border border-border bg-card/90 px-4 pe-11 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute top-1/2 end-3 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
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

            <div className="mt-8 flex w-full justify-center">
              <button
                type="submit"
                disabled={
                  isBusy ||
                  (mode === 'signup' && (!agreedToTerms || !signupBodyReady))
                }
                className="cta-pulse btn-pill min-h-14 items-center justify-center gap-2 bg-gold px-10 py-4 text-sm font-bold tracking-[0.25em] text-black shadow-[0_0_28px_-8px_rgba(232,181,74,0.55)] transition-transform duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
              >
                {loading && (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                )}
                {mode === 'signin' ? t('signIn') : t('createAccount')}
              </button>
            </div>
          </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            href="/"
            className="inline-flex items-center gap-1 transition hover:text-gold"
          >
            <span className="rtl-flip inline-block" aria-hidden="true">
              ←
            </span>{' '}
            {t('backHome')}
          </Link>
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center bg-background text-foreground">
          <Loader2 className="size-6 animate-spin text-gold" aria-hidden="true" />
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
