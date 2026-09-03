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
  Camera,
  Dumbbell,
  Eye,
  EyeOff,
  Loader2,
  Trash2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import {
  friendlyAuthError,
  isValidEmail,
  type AuthCopy,
} from '@/lib/auth-errors'
import { buildAuthCallbackUrl } from '@/lib/auth-callback-url'
import { signIn, signInGuest } from '@/app/login/actions'
import { abandonAnonymousSessionIfPresent } from '@/lib/auth/abandon-guest-session'
import { triggerIronStackNavTransition } from '@/components/nav-transition-overlay'
import { clearIronstackAuthCache } from '@/components/use-is-guest'
import { handleAuthUserChanged } from '@/lib/clear-client-user-state'
import { buildTourSeedForNewAccount } from '@/lib/app-tour-storage'
import { compressAvatarImage } from '@/lib/compress-avatar'
import { ChooseLanguageScreen } from '@/components/choose-language-screen'
import { AvatarPresetPicker } from '@/components/avatar-preset-picker'
import {
  checkSignupUsernameAction,
  finalizeEmailSignupAction,
} from '@/lib/data/signup-actions'
import {
  AVATAR_ACCEPT,
  normalizeUsername,
  validateAvatarFile,
  validateUsernameFormat,
} from '@/lib/username'

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
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const returnNext = safeNextPath(searchParams.get('next'))

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
    return null
  })
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [guestLoading, setGuestLoading] = useState(false)
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarProcessing, setAvatarProcessing] = useState(false)
  const [avatarWarning, setAvatarWarning] = useState<string | null>(null)
  const [presetAvatar, setPresetAvatar] = useState<string | null>(null)

  const isBusy = loading || oauthLoading !== null || guestLoading || avatarProcessing
  const avatarDisplay = avatarPreview || presetAvatar

  function clearAvatarPreview() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarPreview(null)
    setAvatarFile(null)
  }

  async function onPickAvatar(picked: File | null) {
    setAvatarWarning(null)
    if (!picked) {
      clearAvatarPreview()
      return
    }
    const validationError = validateAvatarFile(picked)
    if (validationError) {
      clearAvatarPreview()
      setAvatarWarning(validationError)
      return
    }
    setAvatarProcessing(true)
    try {
      const compressed = await compressAvatarImage(picked)
      if (avatarPreview) URL.revokeObjectURL(avatarPreview)
      setPresetAvatar(null)
      setAvatarFile(compressed.file)
      setAvatarPreview(compressed.previewUrl)
    } catch (err) {
      clearAvatarPreview()
      setAvatarWarning(
        err instanceof Error ? err.message : t('avatarProcessFailed'),
      )
    } finally {
      setAvatarProcessing(false)
    }
  }

  function onPickPreset(path: string | null) {
    clearAvatarPreview()
    setAvatarWarning(null)
    setPresetAvatar(path)
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

  async function handleContinueAsGuest() {
    setError(null)
    setGuestLoading(true)
    try {
      clearIronstackAuthCache()
      const result = await signInGuest()
      if (result?.error) {
        setError(friendlyAuthError(result.error, copy))
      }
    } finally {
      setGuestLoading(false)
    }
  }

  async function handleOAuth(provider: OAuthProvider) {
    setError(null)

    if (mode === 'signup' && !agreedToTerms) {
      setError(t('mustAgree'))
      return
    }

    setOauthLoading(provider)

    const redirectTo = new URL('/auth/callback', siteOrigin())
    redirectTo.searchParams.set(
      'next',
      returnNext ?? (mode === 'signup' ? ONBOARDING_PATH : HOME_PATH),
    )

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectTo.href,
        skipBrowserRedirect: false,
      },
    })

    if (oauthError) {
      setError(friendlyAuthError(oauthError.message, copy, oauthError.code))
      setOauthLoading(null)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setError(null)

    const trimmedEmail = email.trim()
    if (!isValidEmail(trimmedEmail)) {
      setError(copy.invalidEmail)
      return
    }
    if (password.length < 6) {
      setError(copy.weakPassword)
      return
    }
    if (mode === 'signup' && password !== confirmPassword) {
      setError(copy.passwordMismatch)
      return
    }
    if (mode === 'signup' && !agreedToTerms) {
      setError(t('mustAgree'))
      return
    }

    const normalizedUsername =
      mode === 'signup' ? normalizeUsername(username) : ''
    if (mode === 'signup') {
      const usernameError = validateUsernameFormat(normalizedUsername)
      if (usernameError) {
        setError(usernameError)
        return
      }
      const availability = await checkSignupUsernameAction(normalizedUsername)
      if (!availability.available) {
        setError(availability.error || t('usernameTaken'))
        return
      }
    }

    setLoading(true)

    try {
      if (mode === 'signin') {
        const formData = new FormData()
        formData.set('email', trimmedEmail)
        formData.set('password', password)
        formData.set('next', returnNext ?? HOME_PATH)

        clearIronstackAuthCache()
        triggerIronStackNavTransition()
        const result = await signIn(null, formData)
        if (result?.error) {
          setError(friendlyAuthError(result.error, copy))
        }
        return
      }

      // Leaving a previous account: wipe local caches before creating a new one.
      await abandonAnonymousSessionIfPresent()
      await handleAuthUserChanged(null)
      clearIronstackAuthCache()

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
            ...(presetAvatar ? { preset_avatar: presetAvatar } : {}),
            ...buildTourSeedForNewAccount(),
          },
        },
      })

      if (signUpError) {
        setError(friendlyAuthError(signUpError.message, copy, signUpError.code))
        return
      }

      const identities = data.user?.identities ?? []
      if (data.user && identities.length === 0) {
        setError(copy.alreadyRegistered)
        return
      }

      if (!data.session?.user) {
        setError(t('signupNoSession'))
        return
      }

      clearIronstackAuthCache()
      await handleAuthUserChanged(data.session.user.id)

      let newAvatarPath: string | null = null
      if (avatarFile) {
        try {
          const ext = avatarFile.type === 'image/webp' ? 'webp' : 'jpg'
          const path = `${data.session.user.id}/${Date.now()}.${ext}`
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(path, avatarFile, {
              upsert: true,
              contentType: avatarFile.type,
            })
          if (uploadError) {
            setAvatarWarning(t('avatarUploadFailed'))
          } else {
            newAvatarPath = path
          }
        } catch {
          setAvatarWarning(t('avatarUploadFailed'))
        }
      }

      const finalized = await finalizeEmailSignupAction({
        username: normalizedUsername,
        newAvatarPath,
        presetAvatarPath: newAvatarPath ? null : presetAvatar,
      })
      if (!finalized.ok) {
        setError(finalized.error)
        return
      }
      if (finalized.avatarError) {
        setAvatarWarning(t('avatarUploadFailed'))
      }

      const { markOnboardingStartedAction } = await import(
        '@/lib/data/onboarding-actions'
      )
      await markOnboardingStartedAction()
      triggerIronStackNavTransition()
      const onboardingPath = returnNext
        ? `${ONBOARDING_PATH}?next=${encodeURIComponent(returnNext)}`
        : ONBOARDING_PATH
      router.push(onboardingPath)
      router.refresh()
    } catch {
      setError(copy.network)
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
    <main className="relative flex min-h-svh items-start justify-center overflow-x-hidden overflow-y-auto bg-background px-4 pt-[calc(env(safe-area-inset-top)+5.5rem)] pb-12 text-foreground sm:items-center">
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
            {mode === 'signin' ? t('welcomeBack') : t('joinIronstack')}
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {mode === 'signin' ? t('readyNextSet') : t('startStacking')}
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {mode === 'signin' ? t('signinBody') : t('signupBody')}
          </p>
        </div>

        <div className="fade-up rounded-2xl border border-gold/25 bg-card/60 p-5 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-8">
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
              }}
              className={`flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
                mode === 'signin'
                  ? 'border border-gold/30 bg-gold/10 text-gold'
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
              }}
              className={`flex min-h-11 items-center justify-center rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
                mode === 'signup'
                  ? 'border border-gold/30 bg-gold/10 text-gold'
                  : 'text-muted-foreground active:text-foreground'
              }`}
            >
              {t('createAccount')}
            </button>
          </div>

          {error ? (
            <div
              role="alert"
              className="mb-4 flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold/80"
            >
              <AlertCircle
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <p>{error}</p>
            </div>
          ) : null}

          {mode === 'signup' ? (
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
          ) : null}

          <div className="flex flex-col gap-3">
            {oauthButtons.map((button) => (
              <button
                key={button.provider}
                type="button"
                disabled={isBusy || (mode === 'signup' && !agreedToTerms)}
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
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gold/35 bg-gold/5 text-sm font-semibold text-gold transition-colors hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60"
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

          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
                {mode === 'signup' ? (
                  <>
                    <div className="flex flex-col items-center gap-3">
                      <p className="w-full text-sm font-medium text-muted-foreground">
                        {t('profilePhoto')}{' '}
                        <span className="text-xs font-normal">
                          ({t('profilePhotoOptional')})
                        </span>
                      </p>
                      <div className="relative">
                        <div className="flex size-24 items-center justify-center overflow-hidden rounded-full border border-gold/30 bg-card/80 text-gold">
                          {avatarDisplay ? (
                            <Image
                              src={avatarDisplay}
                              alt=""
                              width={96}
                              height={96}
                              className="size-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <Camera className="size-8 opacity-70" aria-hidden="true" />
                          )}
                        </div>
                        <label className="absolute -bottom-1 -end-1 inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-gold/40 bg-gold text-black shadow-md transition hover:brightness-110 focus-within:ring-2 focus-within:ring-gold/40">
                          <Camera className="size-4" aria-hidden="true" />
                          <span className="sr-only">{t('choosePhoto')}</span>
                          <input
                            type="file"
                            accept={AVATAR_ACCEPT}
                            className="sr-only"
                            disabled={isBusy}
                            onChange={(event) => {
                              const file = event.target.files?.[0] ?? null
                              void onPickAvatar(file)
                              event.target.value = ''
                            }}
                          />
                        </label>
                      </div>
                      {avatarDisplay ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            clearAvatarPreview()
                            setPresetAvatar(null)
                            setAvatarWarning(null)
                          }}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-silver/25 px-3 text-xs font-semibold text-muted-foreground transition hover:border-gold/35 hover:text-foreground disabled:opacity-50"
                        >
                          <Trash2 className="size-3.5" aria-hidden="true" />
                          {t('removePhoto')}
                        </button>
                      ) : (
                        <p className="text-center text-xs text-muted-foreground">
                          {t('profilePhotoHint')}
                        </p>
                      )}
                      <div className="w-full">
                        <AvatarPresetPicker
                          value={avatarFile ? null : presetAvatar}
                          onChange={onPickPreset}
                          disabled={isBusy}
                        />
                      </div>
                      {avatarWarning ? (
                        <p className="text-center text-xs text-amber-400" role="status">
                          {avatarWarning}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-2">
                      <label
                        htmlFor="signup-username"
                        className="text-sm font-medium text-muted-foreground"
                      >
                        {t('username')}{' '}
                        <span className="text-gold">*</span>
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                          @
                        </span>
                        <input
                          id="signup-username"
                          name="username"
                          type="text"
                          required
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
                              setUsernameStatus(t('usernameRequired'))
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
                          aria-required="true"
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
                              ? 'text-emerald-400'
                              : 'text-amber-400'
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
                  <button
                    type="submit"
                    disabled={isBusy || (mode === 'signup' && !agreedToTerms)}
                    className="cta-pulse btn-pill inline-flex min-h-14 w-full items-center justify-center gap-2 bg-gold px-10 py-4 text-sm font-bold tracking-[0.25em] text-black shadow-[0_0_28px_-8px_rgba(232,181,74,0.55)] transition-transform duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
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
