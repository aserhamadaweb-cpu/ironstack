'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  signIn,
  signUp,
  type AuthState,
} from '@/app/login/actions'

type AuthMode = 'signin' | 'signup'

const initialState: AuthState | null = null

const inputClassName =
  'w-full rounded-lg border border-silver/20 bg-background/60 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-gold/50 focus:ring-2 focus:ring-gold/20'

export function AuthForm({ next = '/dashboard/home' }: { next?: string }) {
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
          {mode === 'signin' ? 'WELCOME BACK' : 'JOIN THE ARENA'}
        </p>
      </div>

      <div className="mb-6 flex rounded-full border border-silver/20 p-1">
        <button
          type="button"
          onClick={() => setMode('signin')}
          className={`flex-1 rounded-full py-2 text-xs font-semibold tracking-[0.15em] transition-colors ${
            mode === 'signin'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          SIGN IN
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`flex-1 rounded-full py-2 text-xs font-semibold tracking-[0.15em] transition-colors ${
            mode === 'signup'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          SIGN UP
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
              DISPLAY NAME
            </label>
            <input
              id="displayName"
              name="displayName"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              className={inputClassName}
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label
            htmlFor="email"
            className="text-xs font-medium tracking-[0.15em] text-silver-dim"
          >
            EMAIL
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
            PASSWORD
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

        {state?.success && (
          <p className="rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
            {state.success}
          </p>
        )}

        <Button
          type="submit"
          disabled={pending}
          size="lg"
          className="mt-2 h-11 w-full tracking-[0.2em]"
        >
          {pending
            ? 'PLEASE WAIT…'
            : mode === 'signin'
              ? 'SIGN IN'
              : 'CREATE ACCOUNT'}
        </Button>
      </form>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        <Link href="/" className="link-underline hover:text-silver">
          ← Back to home
        </Link>
      </p>
    </div>
  )
}
