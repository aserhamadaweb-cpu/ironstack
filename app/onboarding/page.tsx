'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Dumbbell, Loader2 } from 'lucide-react'

const GYM_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Elite'] as const
const GENDERS = ['Male', 'Female', 'Prefer not to say'] as const
const LANGUAGES = [
  { value: 'en', label: 'English', hint: 'Train in English' },
  { value: 'ar', label: 'العربية', hint: 'التدريب بالعربية' },
] as const

const TOTAL_STEPS = 3

const inputClassName =
  'h-11 w-full rounded-xl border border-zinc-800 bg-zinc-900/90 px-4 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20'

function Pill({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
        selected
          ? 'border-gold/60 bg-gold text-black shadow-[0_0_18px_-6px_rgba(245,158,11,0.55)]'
          : 'border-zinc-800 bg-zinc-950/70 text-zinc-400 hover:border-zinc-700 hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [age, setAge] = useState('')
  const [gymLevel, setGymLevel] = useState<(typeof GYM_LEVELS)[number] | ''>('')
  const [gender, setGender] = useState<(typeof GENDERS)[number] | ''>('')
  const [language, setLanguage] = useState<'en' | 'ar' | ''>('')

  const progress = ((step + 1) / TOTAL_STEPS) * 100

  const headlines = [
    {
      eyebrow: 'ALMOST THERE',
      title: "LET'S SET UP YOUR PROFILE",
      subtitle: 'This helps us personalize your training experience.',
    },
    {
      eyebrow: 'YOUR TRAINING',
      title: 'WHERE ARE YOU STARTING?',
      subtitle: 'Pick the level that feels closest to your current training.',
    },
    {
      eyebrow: 'PREFERENCES',
      title: 'MAKE IT YOURS',
      subtitle: 'Choose how you want IronStack to speak to you.',
    },
  ] as const

  const current = headlines[step]

  function canContinue() {
    if (step === 0) {
      return (
        fullName.trim().length > 1 &&
        username.trim().length >= 3 &&
        Number(age) >= 13 &&
        Number(age) <= 100
      )
    }
    if (step === 1) {
      return Boolean(gymLevel) && Boolean(gender)
    }
    return Boolean(language)
  }

  function handleNext() {
    if (!canContinue()) return
    if (step < TOTAL_STEPS - 1) {
      setStep((value) => value + 1)
      return
    }

    // Design-only finish: brief loading state, then stay on a success look.
    setSubmitting(true)
    window.setTimeout(() => {
      setSubmitting(false)
      setStep(TOTAL_STEPS) // success screen
    }, 900)
  }

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-zinc-950 px-4 pt-28 pb-12 text-zinc-100">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] bg-radial from-gold/15 via-transparent to-transparent"
        aria-hidden="true"
      />

      <header className="fixed inset-x-0 top-0 z-50">
        <nav
          aria-label="Onboarding navigation"
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
          <span className="rounded-full border border-gold/40 px-4 py-1.5 text-xs font-semibold tracking-[0.15em] text-gold">
            {step >= TOTAL_STEPS
              ? 'COMPLETE'
              : `STEP ${step + 1} OF ${TOTAL_STEPS}`}
          </span>
        </nav>
      </header>

      <div className="relative z-10 w-full max-w-md">
        <div className="fade-up mb-8 flex flex-col items-center gap-3 text-center">
          <p className="text-xs font-semibold tracking-[0.35em] text-gold">
            {step >= TOTAL_STEPS ? 'YOU ARE READY' : current.eyebrow}
          </p>
          <h1 className="font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {step >= TOTAL_STEPS ? 'PROFILE LOOKS GREAT' : current.title}
          </h1>
          <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
            {step >= TOTAL_STEPS
              ? 'Your IronStack profile is ready. Wire this up to the hub when you are.'
              : current.subtitle}
          </p>
        </div>

        <div className="fade-up rounded-2xl border border-gold/25 bg-zinc-900/60 p-6 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-8">
          {/* Progress bar */}
          {step < TOTAL_STEPS && (
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex gap-1.5">
                  {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
                    <span
                      key={index}
                      className={`h-1.5 w-8 rounded-full transition-colors ${
                        index <= step ? 'bg-gold' : 'bg-zinc-800'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-semibold tracking-[0.2em] text-zinc-500">
                  {Math.round(progress)}%
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gold transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {step >= TOTAL_STEPS ? (
            <div className="flex flex-col items-center gap-5 py-4 text-center">
              <div className="flex size-16 items-center justify-center rounded-full border border-gold/40 bg-gold/15 text-gold">
                <Check className="size-8" aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <p className="font-heading text-xl font-bold text-white">
                  @{username || 'athlete'}
                </p>
                <p className="text-sm text-zinc-400">
                  {fullName || 'Athlete'} · {gymLevel || 'Ready'} ·{' '}
                  {language === 'ar' ? 'العربية' : 'English'}
                </p>
              </div>
              <Link
                href="/dashboard/home"
                className="cta-pulse mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-gold text-sm font-bold tracking-[0.2em] text-black transition-all duration-300 hover:scale-[1.02] hover:bg-gold/90"
              >
                GO TO HOME
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {step === 0 && (
                <>
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="fullName"
                      className="text-sm font-medium text-zinc-300"
                    >
                      Full name
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      autoComplete="name"
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      placeholder="Alex Rivera"
                      className={inputClassName}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="username"
                      className="text-sm font-medium text-zinc-300"
                    >
                      Username
                    </label>
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm font-semibold text-gold/80">
                        @
                      </span>
                      <input
                        id="username"
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={(event) =>
                          setUsername(
                            event.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9_]/g, ''),
                          )
                        }
                        placeholder="alex_lifts"
                        className={`${inputClassName} pl-8`}
                      />
                    </div>
                    <p className="text-xs text-zinc-500">
                      Letters, numbers, and underscores only.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="age"
                      className="text-sm font-medium text-zinc-300"
                    >
                      Age
                    </label>
                    <input
                      id="age"
                      type="number"
                      inputMode="numeric"
                      min={13}
                      max={100}
                      value={age}
                      onChange={(event) => setAge(event.target.value)}
                      placeholder="25"
                      className={inputClassName}
                    />
                  </div>
                </>
              )}

              {step === 1 && (
                <>
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-zinc-300">Gym level</p>
                    <div className="flex flex-wrap gap-2">
                      {GYM_LEVELS.map((level) => (
                        <Pill
                          key={level}
                          label={level}
                          selected={gymLevel === level}
                          onClick={() => setGymLevel(level)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-zinc-300">Gender</p>
                    <div className="flex flex-wrap gap-2">
                      {GENDERS.map((option) => (
                        <Pill
                          key={option}
                          label={option}
                          selected={gender === option}
                          onClick={() => setGender(option)}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {step === 2 && (
                <div className="flex flex-col gap-3">
                  <p className="text-sm font-medium text-zinc-300">
                    Preferred language
                  </p>
                  <div className="grid gap-3">
                    {LANGUAGES.map((option) => {
                      const selected = language === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setLanguage(option.value)}
                          className={`rounded-2xl border px-5 py-4 text-left transition-all duration-200 ${
                            selected
                              ? 'border-gold/50 bg-gold/15 shadow-[0_0_24px_-8px_rgba(245,158,11,0.45)]'
                              : 'border-zinc-800 bg-zinc-950/70 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p
                                className={`text-base font-bold ${
                                  selected ? 'text-gold/80' : 'text-white'
                                }`}
                              >
                                {option.label}
                              </p>
                              <p className="mt-0.5 text-xs text-zinc-500">
                                {option.hint}
                              </p>
                            </div>
                            <span
                              className={`flex size-6 items-center justify-center rounded-full border ${
                                selected
                                  ? 'border-gold bg-gold text-black'
                                  : 'border-zinc-700 text-transparent'
                              }`}
                            >
                              <Check className="size-3.5" aria-hidden="true" />
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="mt-2 flex gap-3">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep((value) => value - 1)}
                    className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/70 text-sm font-bold tracking-[0.15em] text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    BACK
                  </button>
                )}

                <button
                  type="button"
                  disabled={!canContinue() || submitting}
                  onClick={handleNext}
                  className="cta-pulse flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-full bg-gold text-sm font-bold tracking-[0.2em] text-black transition-all duration-300 hover:scale-[1.02] hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:scale-100"
                >
                  {submitting ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : step === TOTAL_STEPS - 1 ? (
                    <>
                      FINISH SETUP
                      <Check className="size-4" aria-hidden="true" />
                    </>
                  ) : (
                    <>
                      CONTINUE
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Design preview — selections are interactive, not saved yet.
        </p>
      </div>
    </main>
  )
}
