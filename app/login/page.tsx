'use client'

import {
  FormEvent,
  type ReactNode,
  Suspense,
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
} from 'lucide-react'
import type { Provider } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type AuthMode = 'signin' | 'signup'
type OAuthProvider = Extract<Provider, 'google' | 'apple' | 'github'>

function friendlyAuthError(message: string) {
  const lower = message.toLowerCase()
  if (lower.includes('invalid login credentials')) {
    return 'Invalid credentials. Check your email and password and try again.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email before signing in.'
  }
  if (lower.includes('user already registered')) {
    return 'An account with this email already exists. Try signing in instead.'
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

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.7 12.6c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.3 1 8.4.7 1 1.5 2.2 2.6 2.1 1 0 1.4-.7 2.7-.7s1.6.7 2.7.7c1.1 0 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.4-.1 0-2.1-.8-2.2-3.5zM14.4 6.5c.6-.7 1-1.7.9-2.7-.9.1-1.9.6-2.5 1.3-.6.6-1.1 1.7-.9 2.6 1 .1 1.9-.4 2.5-1.2z" />
    </svg>
  )
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0 1 12 6.84c.85 0 1.71.12 2.51.35 1.9-1.32 2.74-1.05 2.74-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.49A10.03 10.03 0 0 0 22 12.26C22 6.58 17.52 2 12 2z"
      />
    </svg>
  )
}

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null)
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'auth_callback_failed'
      ? 'Social sign-in failed. Please try again.'
      : null,
  )
  const [success, setSuccess] = useState<string | null>(null)

  const isBusy = loading || oauthLoading !== null

  async function handleOAuth(provider: OAuthProvider) {
    setError(null)
    setSuccess(null)
    setOauthLoading(provider)

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/onboarding')}`,
      },
    })

    if (oauthError) {
      setError(friendlyAuthError(oauthError.message))
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
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })

        if (signInError) {
          setError(friendlyAuthError(signInError.message))
          return
        }

        router.push('/dashboard/home')
        router.refresh()
        return
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters.')
        return
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/onboarding')}`,
        },
      })

      if (signUpError) {
        setError(friendlyAuthError(signUpError.message))
        return
      }

      if (data.user && !data.session) {
        setSuccess('Check your email for a confirmation link to finish signing up.')
        return
      }

      router.push('/onboarding')
      router.refresh()
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
      label: 'Continue with Google',
      icon: <GoogleIcon className="size-5" />,
      className:
        'border-zinc-800/80 bg-zinc-900/80 text-zinc-100 hover:border-zinc-700 hover:bg-zinc-800/80',
    },
    {
      provider: 'apple',
      label: 'Continue with Apple',
      icon: <AppleIcon className="size-5" />,
      className:
        'border-zinc-800/80 bg-zinc-900/80 text-zinc-100 hover:border-zinc-700 hover:bg-zinc-800/80',
    },
    {
      provider: 'github',
      label: 'Continue with GitHub',
      icon: <GitHubIcon className="size-5" />,
      className:
        'border-zinc-800/80 bg-zinc-900/80 text-zinc-100 hover:border-zinc-700 hover:bg-zinc-800/80',
    },
  ]

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-zinc-950 px-4 pt-28 pb-12 text-zinc-100">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-radial from-gold/15 via-transparent to-transparent"
        aria-hidden="true"
      />

      <header className="fixed inset-x-0 top-0 z-50">
        <nav
          aria-label="Login navigation"
          className="glass-card nav-slide-down mx-auto mt-4 flex max-w-6xl items-center justify-between rounded-full border border-silver/20 px-6 py-3"
        >
          <Link
            href="/"
            className="flex items-center gap-2 transition-transform duration-300 hover:scale-105"
          >
            <Dumbbell className="size-5 text-gold" aria-hidden="true" />
            <span className="font-heading text-metallic text-lg font-bold tracking-[0.25em]">
              IRONSTACK
            </span>
          </Link>
          <Link
            href="/"
            className="rounded-full border border-gold/40 px-4 py-1.5 text-xs font-semibold tracking-[0.15em] text-gold transition-all duration-300 hover:scale-105 hover:border-gold hover:bg-gold/10 hover:text-gold"
          >
            BACK HOME
          </Link>
        </nav>
      </header>

      <div className="relative z-10 w-full max-w-md">
        <div className="fade-up mb-8 flex flex-col items-center gap-3 text-center">
          <p className="text-xs font-semibold tracking-[0.35em] text-gold">
            {mode === 'signin' ? 'WELCOME BACK' : 'JOIN IRONSTACK'}
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {mode === 'signin' ? 'READY FOR YOUR NEXT SET?' : 'START STACKING WINS'}
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
            {mode === 'signin'
              ? 'Welcome back. Sign in to continue training.'
              : 'Create your account and start stacking PRs.'}
          </p>
        </div>

        <div className="fade-up rounded-2xl border border-gold/25 bg-zinc-900/60 p-6 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-8">
          <div className="mb-6 grid grid-cols-2 rounded-xl border border-zinc-800 bg-zinc-950/70 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('signin')
                setError(null)
                setSuccess(null)
              }}
              className={`rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                mode === 'signin'
                  ? 'bg-gold text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup')
                setError(null)
                setSuccess(null)
              }}
              className={`rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                mode === 'signup'
                  ? 'bg-gold text-black'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Create Account
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

          <div className="flex flex-col gap-3">
            {oauthButtons.map((button) => (
              <button
                key={button.provider}
                type="button"
                disabled={isBusy}
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
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gold/20" />
            <span className="text-xs font-medium tracking-wider text-gold/80/45 uppercase">
              or continue with email
            </span>
            <div className="h-px flex-1 bg-gold/20" />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-zinc-300">
                Email
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
                className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900/90 px-4 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-zinc-300"
                >
                  Password
                </label>
                {mode === 'signin' && (
                  <span className="text-xs text-zinc-500 transition-colors hover:text-gold">
                    <Link href="#">Forgot password?</Link>
                  </span>
                )}
              </div>
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
                  className="h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900/90 px-4 pr-11 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-500 transition hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden="true" />
                  ) : (
                    <Eye className="size-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isBusy}
              className="cta-pulse mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-sm font-bold tracking-[0.2em] text-black transition-all duration-300 hover:scale-[1.02] hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
            >
              {loading && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href="/" className="transition hover:text-gold">
            ← Back to home
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
        <main className="flex min-h-svh items-center justify-center bg-zinc-950 text-zinc-100">
          <Loader2 className="size-6 animate-spin text-gold" aria-hidden="true" />
        </main>
      }
    >
      <LoginPageContent />
    </Suspense>
  )
}
