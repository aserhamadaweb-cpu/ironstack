'use client'

import {
  FormEvent,
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { hardNavigate } from '@/lib/navigation-intent'
import {
  Dumbbell,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import {
  friendlyAuthError,
  isStaleClientAuthError,
  isValidEmail,
  type AuthCopy,
} from '@/lib/auth-errors'
import {
  ActionFeedbackBanner,
  useActionFeedback,
} from '@/components/action-feedback'
import {
  buildAuthCallbackUrl,
  buildOAuthReturnUrl,
} from '@/lib/auth-callback-url'
import { signIn, signInGuest } from '@/app/login/actions'
import { abandonAnonymousSessionIfPresent } from '@/lib/auth/abandon-guest-session'
import { signInWithGoogleClient } from '@/lib/auth/sign-in-with-google'
import { triggerIronStackNavTransition } from '@/components/nav-transition-overlay'
import { clearIronstackAuthCache } from '@/components/use-is-guest'
import { handleAuthUserChanged } from '@/lib/clear-client-user-state'
import { buildTourSeedForNewAccount } from '@/lib/app-tour-storage'
import { ChooseLanguageScreen } from '@/components/choose-language-screen'
import {
  checkSignupUsernameAction,
  finalizeEmailSignupAction,
  type FinalizeSignupResult,
} from '@/lib/data/signup-actions'
import {
  normalizeUsername,
  validateUsernameFormat,
} from '@/lib/username'
import { ONBOARDING_META_VERSION } from '@/lib/onboarding-types'

type AuthMode = 'signin' | 'signup'
type OAuthProvider = 'google'

const HOME_PATH = '/dashboard/home'
const ONBOARDING_PATH = '/onboarding'

function safeNextPath(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) {
    return null
  }
  return raw
}

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

function LoginPageContent({ needsLanguageGate }: { needsLanguageGate: boolean }) {
  const [languageDone, setLanguageDone] = useState(!needsLanguageGate)

  if (!languageDone) {
    return <ChooseLanguageScreen onComplete={() => setLanguageDone(true)} />
  }

  return <LoginAuthForm />
}

function LoginAuthForm() {
  const t = useTranslations('auth')
  const copy = useMemo(() => authCopy(t), [t])
  const { notifyError } = useActionFeedback()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const returnNext = safeNextPath(searchParams.get('next'))

  function showError(message: string) {
    setError(message)
    notifyError(message)
  }

  useEffect(() => {
    const mode = searchParams.get('mode')
    if (mode === 'signup') setMode('signup')
  }, [searchParams])

  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null)
  const [error, setError] = useState<string | null>(() => {
    const err = searchParams.get('error')
    if (err === 'auth_callback_failed') return t('callbackFailed')
    if (err === 'expired') return t('callbackExpired')
    if (err === 'session') return t('signinNoSession')
    return null
  })
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [termsNeedsAttention, setTermsNeedsAttention] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<string | null>(null)
  const termsRef = useRef<HTMLLabelElement>(null)

  const isBusy = loading || oauthLoading !== null || guestLoading

  function requireTermsAgreement() {
    if (mode !== 'signup' || agreedToTerms) {
      setTermsNeedsAttention(false)
      return true
    }
    setTermsNeedsAttention(true)
    showError(t('mustAgree'))
    window.requestAnimationFrame(() => {
      termsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      termsRef.current?.querySelector('input')?.focus()
    })
    return false
  }

  function siteOrigin() {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin.replace(/\/$/, '')
    }
    return (
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
      'http://localhost:3000'
    )
  }

  /**
   * Fallback when Server Actions are stale after a rebuild — claim username
   * directly with the browser Supabase session so signup can finish.
   */
  async function finalizeSignupOnClient(input: {
    username: string
    displayName: string
  }): Promise<FinalizeSignupResult> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { ok: false, error: 'Not signed in.' }

    const username = normalizeUsername(input.username)
    const formatError = validateUsernameFormat(username)
    if (formatError) return { ok: false, error: formatError }

    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .neq('id', user.id)
      .maybeSingle()
    if (taken) return { ok: false, error: t('usernameTaken') }

    const displayName = input.displayName.trim() || username
    const { error } = await supabase
      .from('profiles')
      .update({
        username,
        display_name: displayName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
    if (error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('unique') || msg.includes('duplicate')) {
        return { ok: false, error: t('usernameTaken') }
      }
      return { ok: false, error: error.message }
    }

    await supabase.auth.updateUser({
      data: {
        username,
        display_name: displayName,
        onboarding_completed: false,
        onboarding_step: 1,
        onboarding_v1: {
          version: ONBOARDING_META_VERSION,
          step: 1,
          displayName,
          username,
          appearance: 'system',
        },
      },
    })

    return { ok: true, username, avatarUrl: null }
  }

  async function handleContinueAsGuest() {
    setError(null)
    setGuestLoading(true)
    try {
      clearIronstackAuthCache()
      const result = await signInGuest()
      if (result?.error) {
        showError(friendlyAuthError(result.error, copy))
      }
    } finally {
      setGuestLoading(false)
    }
  }

  async function handleOAuth(provider: OAuthProvider) {
    setError(null)

    if (!requireTermsAgreement()) return

    setOauthLoading(provider)

    try {
      clearIronstackAuthCache()

      const next =
        returnNext ?? (mode === 'signup' ? ONBOARDING_PATH : HOME_PATH)

      // In-app Google Identity + browser session + cookie sync (see signInWithGoogleClient).
      if (provider === 'google') {
        const result = await signInWithGoogleClient(next)
        if (!result.ok) {
          if (!result.cancelled) {
            // Keep Google's real reason visible — "Something went wrong" hid
            // production-only origin / GIS failures.
            showError(
              /origin|client id|identity|audience|nonce|provider/i.test(
                result.error,
              )
                ? result.error
                : friendlyAuthError(result.error, copy),
            )
          }
          return
        }
        if ('redirected' in result && result.redirected) {
          // Browser is leaving for Google OAuth — keep the spinner.
          return
        }
        if ('redirectTo' in result && result.redirectTo) {
          triggerIronStackNavTransition()
          hardNavigate(result.redirectTo)
        }
        return
      }

      // Non-Google providers (if added later): classic redirect OAuth.
      await abandonAnonymousSessionIfPresent()
      const redirectTo = buildOAuthReturnUrl(next, siteOrigin())
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: false,
        },
      })

      if (oauthError) {
        showError(friendlyAuthError(oauthError.message, copy, oauthError.code))
      }
    } catch (err) {
      // Server actions that redirect throw; never surface that as a login error.
      if (
        err &&
        typeof err === 'object' &&
        'digest' in err &&
        typeof (err as { digest?: unknown }).digest === 'string' &&
        String((err as { digest: string }).digest).startsWith('NEXT_REDIRECT')
      ) {
        throw err
      }
      const message =
        err instanceof Error && err.message
          ? err.message
          : copy.socialFailed
      if (!/cancelled/i.test(message)) {
        showError(friendlyAuthError(message, copy))
      }
    } finally {
      setOauthLoading(null)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setError(null)
    setTermsNeedsAttention(false)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      showError(t('emailRequired'))
      return
    }
    if (!isValidEmail(trimmedEmail)) {
      showError(copy.invalidEmail)
      return
    }

    let normalizedUsername = mode === 'signup' ? normalizeUsername(username) : ''
    if (mode === 'signup') {
      if (!normalizedUsername) {
        normalizedUsername = normalizeUsername(trimmedEmail.split('@')[0] ?? '')
      }
      if (normalizedUsername.length < 3) {
        normalizedUsername = `athlete${Date.now().toString(36).slice(-6)}`
      }
      const usernameError = validateUsernameFormat(normalizedUsername)
      if (usernameError && usernameError !== 'Username is required.') {
        showError(t('usernameFormat'))
        setUsernameStatus(t('usernameFormat'))
        return
      }
    }
    if (!password) {
      showError(t('passwordRequired'))
      return
    }
    if (password.length < 6) {
      showError(copy.weakPassword)
      return
    }
    if (mode === 'signup' && !confirmPassword) {
      showError(t('confirmPasswordRequired'))
      return
    }
    if (mode === 'signup' && password !== confirmPassword) {
      showError(copy.passwordMismatch)
      return
    }
    if (!requireTermsAgreement()) return

    setLoading(true)

    try {
      if (mode === 'signup') {
        try {
          const availability = await checkSignupUsernameAction(normalizedUsername)
          if (!availability.available) {
            if (!username.trim()) {
              normalizedUsername = `${normalizedUsername.slice(0, 20)}${Date.now().toString(36).slice(-6)}`
            } else {
              showError(availability.error || t('usernameTaken'))
              return
            }
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          // Stale Server Action / offline: continue and let finalize catch duplicates.
          if (
            /failed to fetch|fetch failed|server action|network/i.test(message)
          ) {
            /* proceed */
          } else {
            showError(friendlyAuthError(message, copy))
            return
          }
        }
      }

      if (mode === 'signin') {
        const formData = new FormData()
        formData.set('email', trimmedEmail)
        formData.set('password', password)
        formData.set('next', returnNext ?? HOME_PATH)

        clearIronstackAuthCache()
        triggerIronStackNavTransition()
        const result = await signIn(null, formData)
        if (result?.error) {
          showError(friendlyAuthError(result.error, copy))
        }
        return
      }

      // Leaving a previous account only after signup succeeds (wipe-before-create
      // destroyed pins when signup failed validation/network).
      try {
        await abandonAnonymousSessionIfPresent()
      } catch {
        /* Non-fatal — guest may already be gone. */
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: buildAuthCallbackUrl(
            returnNext ||
              (mode === 'signup' ? ONBOARDING_PATH : undefined),
            siteOrigin(),
          ),
          data: {
            display_name: trimmedEmail.split('@')[0],
            username: normalizedUsername,
            onboarding_completed: false,
            onboarding_step: 1,
            onboarding_v1: {
              version: ONBOARDING_META_VERSION,
              step: 1,
              displayName: trimmedEmail.split('@')[0] || normalizedUsername,
              username: normalizedUsername,
              appearance: 'system',
            },
            ...buildTourSeedForNewAccount(),
          },
        },
      })

      if (signUpError) {
        showError(friendlyAuthError(signUpError.message, copy, signUpError.code))
        return
      }

      const identities = data.user?.identities ?? []
      if (data.user && identities.length === 0) {
        showError(copy.alreadyRegistered)
        return
      }

      if (!data.session?.user) {
        showError(t('signupNoSession'))
        return
      }

      clearIronstackAuthCache()
      await handleAuthUserChanged(data.session.user.id)

      const displayName =
        trimmedEmail.split('@')[0] || normalizedUsername
      let finalized: FinalizeSignupResult
      try {
        finalized = await finalizeEmailSignupAction({
          username: normalizedUsername,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (isStaleClientAuthError(message)) {
          finalized = await finalizeSignupOnClient({
            username: normalizedUsername,
            displayName,
          })
        } else {
          showError(friendlyAuthError(message, copy))
          return
        }
      }

      if (!finalized.ok && isStaleClientAuthError(finalized.error)) {
        finalized = await finalizeSignupOnClient({
          username: normalizedUsername,
          displayName,
        })
      }

      if (!finalized.ok) {
        showError(
          isStaleClientAuthError(finalized.error)
            ? copy.staleClient || finalized.error
            : finalized.error,
        )
        return
      }

      try {
        const { markOnboardingStartedAction } = await import(
          '@/lib/data/onboarding-actions'
        )
        await markOnboardingStartedAction()
      } catch {
        /* Cookie/meta seed is best-effort; onboarding page can start itself. */
      }
      triggerIronStackNavTransition()
      const onboardingPath = returnNext
        ? `${ONBOARDING_PATH}?next=${encodeURIComponent(returnNext)}`
        : ONBOARDING_PATH
      // Hard navigation picks up the latest build after signup (avoids stale RSC).
      hardNavigate(onboardingPath)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      showError(friendlyAuthError(message, copy))
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
    <main className="relative flex min-h-svh items-start justify-center overflow-x-hidden overflow-y-auto bg-background px-4 pt-[calc(env(safe-area-inset-top)+4.75rem)] pb-10 text-foreground sm:items-center">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[22rem] bg-radial from-gold/12 via-transparent to-transparent"
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
            className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {t('backHome')}
          </Link>
        </nav>
      </header>

      <div className="relative z-10 w-full max-w-md">
        <div className="fade-up mb-5 flex flex-col items-center gap-2 text-center">
          <p className="section-kicker">
            {mode === 'signin' ? t('welcomeBack') : t('joinIronstack')}
          </p>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {mode === 'signin' ? t('readyNextSet') : t('startStacking')}
          </h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {mode === 'signin' ? t('signinBody') : t('signupBody')}
          </p>
        </div>

        <div className="fade-up rounded-2xl border border-border/70 bg-card/80 p-4 sm:p-6">
          <div
            className="mb-6 grid grid-cols-2 rounded-xl border border-border bg-background/70 p-1"
            role="tablist"
            aria-label={t('loginNav')}
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signin'}
              onClick={() => {
                setMode('signin')
                setError(null)
                setConfirmPassword('')
                setAgreedToTerms(false)
                setTermsNeedsAttention(false)
              }}
              className={`flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
                mode === 'signin'
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground active:text-foreground'
              }`}
            >
              {t('signIn')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'signup'}
              onClick={() => {
                setMode('signup')
                setError(null)
                setTermsNeedsAttention(false)
              }}
              className={`flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
                mode === 'signup'
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground active:text-foreground'
              }`}
            >
              {t('createAccount')}
            </button>
          </div>

          {mode === 'signup' ? (
            <div className="mb-3 flex flex-col gap-1.5">
              <label
                ref={termsRef}
                className={`flex items-start gap-2.5 rounded-xl px-1 py-1 text-sm leading-snug ${
                  termsNeedsAttention
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}
              >
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  aria-invalid={termsNeedsAttention || undefined}
                  aria-describedby={
                    termsNeedsAttention ? 'signup-terms-error' : undefined
                  }
                  onChange={(event) => {
                    const checked = event.target.checked
                    setAgreedToTerms(checked)
                    if (checked) {
                      setTermsNeedsAttention(false)
                      setError((current) =>
                        current === t('mustAgree') ? null : current,
                      )
                    }
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-[var(--gold)]"
                />
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
              {termsNeedsAttention ? (
                <p
                  id="signup-terms-error"
                  role="alert"
                  className="px-1 text-xs font-medium text-destructive"
                >
                  {t('mustAgree')}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            {oauthButtons.map((button) => (
              <button
                key={button.provider}
                type="button"
                disabled={isBusy}
                onClick={() => void handleOAuth(button.provider)}
                className={`flex h-11 w-full items-center justify-center gap-3 rounded-xl border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60 ${button.className}`}
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
              onClick={() => void handleContinueAsGuest()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {guestLoading ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : null}
              {t('continueAsGuest')}
            </button>
          </div>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground">
              {t('orEmail')}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                {mode === 'signup' ? (
                  <>
                    <div className="flex flex-col gap-2">
                      <label
                        htmlFor="signup-username"
                        className="text-sm font-medium text-muted-foreground"
                      >
                        {t('username')}{' '}
                        <span className="text-xs font-normal text-muted-foreground">
                          ({t('usernameOptional')})
                        </span>
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                          @
                        </span>
                        <input
                          id="signup-username"
                          name="username"
                          type="text"
                          autoComplete="username"
                          maxLength={30}
                          value={username}
                          onChange={(event) => {
                            const next = normalizeUsername(event.target.value)
                            setUsername(next)
                            setUsernameStatus(null)
                          }}
                          onBlur={async () => {
                            const handle = normalizeUsername(username)
                            if (!handle) {
                              setUsernameStatus(null)
                              return
                            }
                            const check = await checkSignupUsernameAction(handle)
                            setUsernameStatus(
                              check.available
                                ? t('usernameAvailable')
                                : check.error || t('usernameTaken'),
                            )
                          }}
                          placeholder={t('usernamePlaceholder')}
                          className="h-11 w-full rounded-xl border border-border bg-card/90 py-2 pe-4 ps-8 text-sm text-foreground placeholder:text-muted-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('usernameHint')}
                      </p>
                      {usernameStatus ? (
                        <p
                          className={`text-xs ${
                            usernameStatus === t('usernameAvailable')
                              ? 'text-success'
                              : 'text-gold'
                          }`}
                          role="status"
                        >
                          {usernameStatus}
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : null}

                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="email"
                    className="text-sm font-medium text-muted-foreground"
                  >
                    {t('email')}
                  </label>
                  <input
                    id="email"
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
                      className="absolute top-1/2 end-1 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                      aria-label={
                        showPassword ? t('hidePassword') : t('showPassword')
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" aria-hidden="true" />
                      ) : (
                        <Eye className="size-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  {mode === 'signin' ? (
                    <p className="text-center">
                      <Link
                        href="/login/reset-password"
                        className="text-sm text-muted-foreground transition hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                      >
                        {t('forgotPassword')}
                      </Link>
                    </p>
                  ) : null}
                </div>

                {mode === 'signup' ? (
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="confirmPassword"
                      className="text-sm font-medium text-muted-foreground"
                    >
                      {t('confirmPassword')}
                    </label>
                    <input
                      id="confirmPassword"
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
                ) : null}

                <div className="mt-4 flex w-full flex-col items-center gap-4">
                  <ActionFeedbackBanner error={error} className="w-full" />

                  <button
                    type="submit"
                    disabled={isBusy}
                    className="btn-pill btn-pill-primary inline-flex min-h-12 w-full items-center justify-center gap-2 px-8 py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? (
                      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                    ) : null}
                    {mode === 'signin' ? t('signIn') : t('createAccount')}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode(mode === 'signin' ? 'signup' : 'signin')
                      setError(null)
                      setConfirmPassword('')
                      setTermsNeedsAttention(false)
                    }}
                    className="text-sm text-muted-foreground transition hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                  >
                    {mode === 'signin'
                      ? t('switchToSignUp')
                      : t('switchToSignIn')}
                  </button>
                </div>
              </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            href="/"
            className="inline-flex items-center gap-1 transition hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
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

export default function LoginPageClient({
  needsLanguageGate,
}: {
  needsLanguageGate: boolean
}) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-svh items-center justify-center bg-background text-foreground">
          <Loader2 className="size-6 animate-spin text-gold" aria-hidden="true" />
        </main>
      }
    >
      <LoginPageContent needsLanguageGate={needsLanguageGate} />
    </Suspense>
  )
}
