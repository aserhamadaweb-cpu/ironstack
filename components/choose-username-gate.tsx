'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  claimUsernameAction,
  getUsernameStatusAction,
  logBodyWeightAction,
  updateBodyStatsAction,
} from '@/lib/data/profile-actions'
import { CTA_PRIMARY } from '@/lib/accent'
import {
  displayToKg,
  feetInchesToCm,
  isValidBirthDate,
  isValidHeightCm,
  isValidWeightKg,
  type WeightUnit,
} from '@/lib/units'
import type { ProfileGender } from '@/lib/database.types'

const PROFILE_OK_KEY = 'ironstack:profile-ok'

type OnboardingStatus = Awaited<ReturnType<typeof getUsernameStatusAction>>

/** Dedupes Strict Mode double-mount and repeat navigations in one tab session. */
let onboardingStatusPromise: Promise<OnboardingStatus> | null = null

export function clearProfileOnboardingCache() {
  onboardingStatusPromise = null
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem(PROFILE_OK_KEY)
      sessionStorage.removeItem('ironstack:username-ok')
    } catch {
      /* ignore */
    }
  }
}

function loadOnboardingStatus(): Promise<OnboardingStatus> {
  if (typeof window !== 'undefined') {
    try {
      if (sessionStorage.getItem(PROFILE_OK_KEY) === '1') {
        return Promise.resolve({
          needsUsername: false,
          needsBodyStats: false,
          isGuest: false,
          suggestion: 'athlete',
          displayName: 'Athlete',
        })
      }
    } catch {
      /* ignore */
    }
  }
  if (!onboardingStatusPromise) {
    onboardingStatusPromise = getUsernameStatusAction().then((status) => {
      const done =
        status.isGuest || (!status.needsUsername && !status.needsBodyStats)
      if (done && typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(PROFILE_OK_KEY, '1')
        } catch {
          /* ignore */
        }
      }
      return status
    })
  }
  return onboardingStatusPromise
}

/**
 * One-time gate for accounts that still need a username and/or body stats.
 * Guests skip this entirely. After a guest upgrades, this collects what they skipped.
 */
export function ChooseUsernameGate() {
  const t = useTranslations('auth')
  const tGuest = useTranslations('guest')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [needsUsername, setNeedsUsername] = useState(false)
  const [needsBodyStats, setNeedsBodyStats] = useState(false)
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [unit, setUnit] = useState<WeightUnit>('kg')
  const [gender, setGender] = useState<ProfileGender | ''>('')
  const [birthDate, setBirthDate] = useState('')
  const [heightCm, setHeightCm] = useState('')
  const [heightFt, setHeightFt] = useState('5')
  const [heightIn, setHeightIn] = useState('10')
  const [weight, setWeight] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    void loadOnboardingStatus().then((status) => {
      if (cancelled) return
      setChecked(true)
      if (status.isGuest) return
      if (status.needsUsername || status.needsBodyStats) {
        setNeedsUsername(status.needsUsername)
        setNeedsBodyStats(status.needsBodyStats)
        setUsername(status.suggestion)
        setDisplayName(status.displayName)
        setOpen(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!checked || !open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <div className="absolute inset-0 bg-[var(--overlay-scrim)] backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="complete-profile-title"
        className="relative z-10 max-h-[90svh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-silver/15 bg-card p-5 shadow-2xl sm:rounded-2xl sm:p-6"
      >
        <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
          {tGuest('completeKicker')}
        </p>
        <h2
          id="complete-profile-title"
          className="font-heading mt-1 text-xl font-bold text-foreground"
        >
          {tGuest('completeTitle')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {tGuest('completeBody')}
        </p>

        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            startTransition(async () => {
              if (needsUsername) {
                const claim = await claimUsernameAction({
                  username,
                  displayName,
                })
                if (!claim.ok) {
                  setError(claim.error)
                  return
                }
              }

              if (needsBodyStats) {
                if (gender !== 'male' && gender !== 'female') {
                  setError(t('bodyGenderRequired'))
                  return
                }
                if (!isValidBirthDate(birthDate)) {
                  setError(t('bodyBirthInvalid'))
                  return
                }
                const height =
                  unit === 'lb'
                    ? feetInchesToCm(Number(heightFt), Number(heightIn))
                    : Number(heightCm)
                if (!isValidHeightCm(height)) {
                  setError(t('bodyHeightInvalid'))
                  return
                }
                const weightDisplay = Number(weight)
                if (!Number.isFinite(weightDisplay)) {
                  setError(t('bodyWeightInvalid'))
                  return
                }
                const weightKg = displayToKg(weightDisplay, unit)
                if (!isValidWeightKg(weightKg)) {
                  setError(t('bodyWeightInvalid'))
                  return
                }

                const body = await updateBodyStatsAction({
                  height_cm: height,
                  gender,
                  birth_date: birthDate,
                })
                if (!body.ok) {
                  setError(body.error)
                  return
                }
                const logged = await logBodyWeightAction(weightKg)
                if (!logged.ok) {
                  setError(logged.error)
                  return
                }
              }

              try {
                sessionStorage.setItem(PROFILE_OK_KEY, '1')
              } catch {
                /* ignore */
              }
              onboardingStatusPromise = null
              setOpen(false)
              router.refresh()
            })
          }}
        >
          {needsUsername && (
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                {t('username')}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 text-sm text-muted-foreground">
                  @
                </span>
                <input
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''),
                    )
                  }
                  maxLength={30}
                  required
                  autoFocus
                  className="w-full rounded-xl border border-border bg-card/90 py-2.5 pe-3 ps-7 text-sm text-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
              </div>
            </div>
          )}

          {needsBodyStats && (
            <div className="space-y-4 rounded-xl border border-border/80 bg-background/40 p-4">
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

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={
              pending ||
              (needsUsername && username.length < 3) ||
              (needsBodyStats && !gender)
            }
            className={`inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full text-xs font-bold tracking-[0.14em] disabled:opacity-60 ${CTA_PRIMARY}`}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            {tGuest('completeSubmit')}
          </button>
        </form>
      </div>
    </div>
  )
}
