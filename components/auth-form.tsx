'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Dumbbell } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  signIn,
  signUp,
  type AuthState,
} from '@/app/login/actions'

type AuthMode = 'signin' | 'signup'

const initialState: AuthState | null = null

const inputClassName =
  'min-h-11 w-full rounded-lg border border-silver/20 bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-gold/50 focus:ring-2 focus:ring-gold/20'

export function AuthForm({ next = '/dashboard/home' }: { next?: string }) {
  const t = useTranslations('auth')
  const [mode, setMode] = useState<AuthMode>('signin')
  const action = mode === 'signin' ? signIn : signUp
  const [state, formAction, pending] = useActionState(action, initialState)

  return (
    <div className="glass-card sheen-border fade-up w-full max-w-md rounded-2xl p-8">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <Link
          href="/"
          className="flex items-center gap-2 transition-transform duration-300 hover:scale-105"
        >
          <Dumbbell className="size-5 text-gold" aria-hidden="true" />
          <span className="font-heading text-metallic text-lg font-bold tracking-[0.25em]">
            IRONSTACK
          </span>
        </Link>
        <p className="text-xs tracking-[0.3em] text-muted-foreground">
          {mode === 'signin' ? t('welcomeBack') : t('joinArena')}
        </p>
      </div>

      <div className="mb-6 flex rounded-full border border-silver/20 p-1">
        <button
          type="button"
          onClick={() => setMode('signin')}
          className={`flex min-h-11 flex-1 items-center justify-center rounded-full text-xs font-semibold tracking-[0.15em] transition-colors ${
            mode === 'signin'
              ? 'border border-gold/30 bg-gold/10 text-gold'
              : 'text-muted-foreground active:text-foreground'
          }`}
        >
          {t('signIn')}
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`flex min-h-11 flex-1 items-center justify-center rounded-full text-xs font-semibold tracking-[0.15em] transition-colors ${
            mode === 'signup'
              ? 'border border-gold/30 bg-gold/10 text-gold'
              : 'text-muted-foreground active:text-foreground'
          }`}
        >
          {t('signUp')}
        </button>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />

        {mode === 'signup' && (
          <div className="flex flex-col gap-2">
            <label
              htmlFor="displayName"
              className="text-xs font-medium tracking-[0.15em] text-silver-dim"
            >
              {t('displayName')}
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="name"
              placeholder={t('displayNamePlaceholder')}
              className={inputClassName}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label
            htmlFor="email"
            className="text-xs font-medium tracking-[0.15em] text-silver-dim"
          >
            {t('email')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={inputClassName}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="password"
            className="text-xs font-medium tracking-[0.15em] text-silver-dim"
          >
            {t('password')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={
              mode === 'signup' ? 'new-password' : 'current-password'
            }
            placeholder="••••••••"
            className={inputClassName}
          />
        </div>

        {state?.error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <Button
          type="submit"
          disabled={pending}
          size="lg"
          className="cta-pulse mt-4 min-h-14 w-full bg-gold px-10 py-4 text-sm font-bold tracking-[0.25em] text-black shadow-[0_0_28px_-8px_rgba(232,181,74,0.55)] hover:bg-gold/90"
        >
          {pending
            ? t('pleaseWait')
            : mode === 'signin'
              ? t('signIn')
              : t('createAccount')}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link
          href="/"
          className="link-underline inline-flex items-center gap-1 hover:text-silver"
        >
          <ChevronLeft className="size-3.5 rtl-flip" aria-hidden="true" />
          {t('backHome')}
        </Link>
      </p>
    </div>
  )
}
