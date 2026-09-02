'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Dumbbell,
  Loader2,
  Monitor,
  Moon,
  Sun,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import {
  checkUsernameAvailableAction,
  completeOnboardingAction,
  markOnboardingStartedAction,
  saveOnboardingProgressAction,
  type OnboardingAvatarOptions,
} from '@/lib/data/onboarding-actions'
import { pathWithTourParam } from '@/lib/app-tour-storage'
import { ProfileAvatarPicker, type ProfileAvatarPickerValue } from '@/components/profile-avatar-picker'
import { updateLanguagePreferenceAction } from '@/lib/data/profile-actions'
import { uploadProfileAvatar } from '@/lib/upload-profile-avatar.client'
import {
  applyLocaleToDocument,
  type AppLocale,
} from '@/lib/i18n'
import {
  equipmentOptionsForLocation,
  type AgeRange,
  type EquipmentId,
  type FitnessGoal,
  type FitnessLevel,
  type MuscleGroup,
  type OnboardingData,
  type OnboardingGender,
  type TrainingLocation,
  type TrainingStyle,
  type Weekday,
  type WorkoutDuration,
} from '@/lib/onboarding-types'
import { useTheme } from '@/components/theme-provider'
import type { AppearanceMode } from '@/lib/theme'
import {
  cmToFeetInches,
  displayToKg,
  feetInchesToCm,
  isValidHeightCm,
  isValidWeightKg,
  kgToDisplay,
  type WeightUnit,
} from '@/lib/units'

type OnboardingFlowProps = {
  initialData: OnboardingData
  incomplete: boolean
  /** When true, opened from Settings for editing (already complete). */
  editMode?: boolean
  userId: string
  initialAvatarUrl?: string | null
  /** Post-onboarding redirect when arriving from an external deep link (e.g. share page). */
  returnNext?: string | null
}

function OptionButton({
  selected,
  label,
  hint,
  onClick,
  disabled,
}: {
  selected: boolean
  label: string
  hint?: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-12 w-full flex-col items-start rounded-xl border px-4 py-3 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50 ${
        selected
          ? 'border-gold/50 bg-gold/10 text-foreground'
          : 'border-border bg-background/60 text-muted-foreground hover:border-gold/30 hover:text-foreground'
      }`}
    >
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {hint ? (
        <span className="mt-0.5 text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </button>
  )
}

function Chip({
  selected,
  label,
  onClick,
  disabled,
}: {
  selected: boolean
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center rounded-full border px-3 text-xs font-semibold tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50 ${
        selected
          ? 'border-gold/50 bg-gold/15 text-gold'
          : 'border-silver/20 text-muted-foreground hover:border-gold/30 hover:text-foreground'
      }`}
    >
      {selected ? <span className="me-1.5" aria-hidden="true">✓</span> : null}
      {label}
    </button>
  )
}

export function OnboardingFlow({
  initialData,
  incomplete,
  editMode = false,
  userId,
  initialAvatarUrl = null,
  returnNext = null,
}: OnboardingFlowProps) {
  const t = useTranslations('onboarding')
  const tAuth = useTranslations('auth')
  const locale = useLocale()
  const { previewAppearance, appearance } = useTheme()
  const [data, setData] = useState<OnboardingData>(initialData)
  const [step, setStep] = useState(() =>
    editMode ? 1 : Math.min(8, Math.max(1, initialData.step || 1)),
  )
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [usernameStatus, setUsernameStatus] = useState<string | null>(null)
  const [avatarSelection, setAvatarSelection] = useState<ProfileAvatarPickerValue>({
    file: null,
    presetPath: null,
    previewUrl: null,
  })
  const savingRef = useRef(false)
  const startedRef = useRef(false)

  const unit: WeightUnit = data.preferredUnit === 'lb' ? 'lb' : 'kg'
  const heightImperial = useMemo(() => {
    if (data.heightCm == null) return { ft: '', inch: '' }
    const { feet, inches } = cmToFeetInches(data.heightCm)
    return { ft: String(feet), inch: String(inches) }
  }, [data.heightCm])

  const [heightCmInput, setHeightCmInput] = useState(
    data.heightCm != null ? String(Math.round(data.heightCm)) : '',
  )
  const [heightFt, setHeightFt] = useState(heightImperial.ft)
  const [heightIn, setHeightIn] = useState(heightImperial.inch)
  const [weightInput, setWeightInput] = useState(
    data.weightKg != null
      ? String(Math.round(kgToDisplay(data.weightKg, unit) * 10) / 10)
      : '',
  )

  useEffect(() => {
    setHeightCmInput(
      data.heightCm != null ? String(Math.round(data.heightCm)) : '',
    )
    if (data.heightCm == null) {
      setHeightFt('')
      setHeightIn('')
    } else {
      const { feet, inches } = cmToFeetInches(data.heightCm)
      setHeightFt(String(feet))
      setHeightIn(String(inches))
    }
  }, [data.heightCm])

  useEffect(() => {
    setWeightInput(
      data.weightKg != null
        ? String(Math.round(kgToDisplay(data.weightKg, unit) * 10) / 10)
        : '',
    )
    // Unit toggles convert the visible input themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.weightKg])

  useEffect(() => {
    if (startedRef.current || editMode || !incomplete) return
    startedRef.current = true
    void markOnboardingStartedAction()
  }, [editMode, incomplete])

  useEffect(() => {
    if (data.appearance && data.appearance !== appearance) {
      previewAppearance(data.appearance)
    }
    // Sync preview from restored onboarding state only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.appearance])

  const patch = useCallback((partial: Partial<OnboardingData>) => {
    setData((prev) => ({ ...prev, ...partial }))
  }, [])

  const persist = useCallback(
    (
      partial: Partial<OnboardingData>,
      nextStep: number,
      avatar?: OnboardingAvatarOptions,
    ) =>
      new Promise<boolean>((resolve) => {
        if (savingRef.current) {
          resolve(false)
          return
        }
        savingRef.current = true
        setError(null)
        const payload = { ...partial, step: nextStep }
        startTransition(async () => {
          try {
            const result = await saveOnboardingProgressAction(payload, avatar)
            if (!result.ok) {
              setError(result.error)
              resolve(false)
              return
            }
            setData(result.data)
            setStep(nextStep)
            resolve(true)
          } catch {
            setError(t('saveFailed'))
            resolve(false)
          } finally {
            savingRef.current = false
          }
        })
      }),
    [t],
  )

  async function buildAvatarOptions(): Promise<
    OnboardingAvatarOptions | undefined
  > {
    if (avatarSelection.file) {
      try {
        const newAvatarPath = await uploadProfileAvatar(
          userId,
          avatarSelection.file,
        )
        return { newAvatarPath }
      } catch {
        setError(tAuth('avatarUploadFailed'))
        return undefined
      }
    }
    if (avatarSelection.presetPath) {
      return { avatarPresetPath: avatarSelection.presetPath }
    }
    return undefined
  }

  async function validateStep1(): Promise<string | null> {
    const name = data.displayName.trim()
    if (name.length < 2 || name.length > 40) return t('errors.displayName')
    const handle = data.username.trim().toLowerCase()
    if (!handle) return t('errors.usernameFormat')
    if (!/^[a-z0-9_]{3,30}$/.test(handle)) return t('errors.usernameFormat')
    const check = await checkUsernameAvailableAction(handle)
    if (!check.available) return check.error || t('errors.usernameTaken')
    return null
  }

  function validateStep4(): string | null {
    if (!data.primaryGoal) return t('errors.primaryGoal')
    return null
  }

  function validateStep5(): string | null {
    if (!data.fitnessLevel) return t('errors.fitnessLevel')
    if (data.daysPerWeek == null || data.daysPerWeek < 1 || data.daysPerWeek > 7) {
      return t('errors.daysPerWeek')
    }
    if (!data.workoutDuration) return t('errors.duration')
    return null
  }

  function validateStep6(): string | null {
    if (!data.trainingLocation) return t('errors.location')
    return null
  }

  function readBodyIntoData(): Partial<OnboardingData> | { error: string } {
    let heightCm: number | null = null
    if (unit === 'lb') {
      const hasFt = heightFt.trim().length > 0
      const hasIn = heightIn.trim().length > 0
      if (hasFt || hasIn) {
        heightCm = feetInchesToCm(Number(heightFt) || 0, Number(heightIn) || 0)
        if (!isValidHeightCm(heightCm)) return { error: t('errors.height') }
      }
    } else if (heightCmInput.trim()) {
      heightCm = Number(heightCmInput)
      if (!isValidHeightCm(heightCm)) return { error: t('errors.height') }
    }

    let weightKg: number | null = null
    if (weightInput.trim()) {
      const display = Number(weightInput)
      if (!Number.isFinite(display)) return { error: t('errors.weight') }
      weightKg = displayToKg(display, unit)
      if (!isValidWeightKg(weightKg)) return { error: t('errors.weight') }
    }

    return {
      heightCm,
      weightKg,
      preferredUnit: unit,
    }
  }

  const homeAfterOnboarding = returnNext ?? '/dashboard/home?tour=1'

  async function handleContinue() {
    setError(null)
    setUsernameStatus(null)

    if (step === 1) {
      const err = await validateStep1()
      if (err) {
        setError(err)
        return
      }
      if (data.language === 'en' || data.language === 'ar') {
        applyLocaleToDocument(data.language)
        void updateLanguagePreferenceAction(data.language)
      }
      const avatar = await buildAvatarOptions()
      if (avatarSelection.file && !avatar) return
      await persist(
        {
          displayName: data.displayName,
          username: data.username,
          appearance: data.appearance,
          language: data.language,
        },
        2,
        avatar,
      )
      return
    }

    if (step === 2) {
      await persist(
        {
          ageRange: data.ageRange,
          gender: data.gender,
          language: data.language,
        },
        3,
      )
      return
    }

    if (step === 3) {
      const body = readBodyIntoData()
      if ('error' in body) {
        setError(body.error)
        return
      }
      await persist(body, 4)
      return
    }

    if (step === 4) {
      const err = validateStep4()
      if (err) {
        setError(err)
        return
      }
      await persist(
        {
          primaryGoal: data.primaryGoal,
          secondaryGoals: data.secondaryGoals,
        },
        5,
      )
      return
    }

    if (step === 5) {
      const err = validateStep5()
      if (err) {
        setError(err)
        return
      }
      await persist(
        {
          fitnessLevel: data.fitnessLevel,
          daysPerWeek: data.daysPerWeek,
          workoutDuration: data.workoutDuration,
          preferredDays: data.preferredDays,
        },
        6,
      )
      return
    }

    if (step === 6) {
      const err = validateStep6()
      if (err) {
        setError(err)
        return
      }
      await persist(
        {
          trainingLocation: data.trainingLocation,
          equipment: data.equipment,
        },
        7,
      )
      return
    }

    if (step === 7) {
      await persist(
        {
          trainingStyles: data.trainingStyles,
          favoriteMuscleGroups: data.favoriteMuscleGroups,
          avoidances: data.avoidances,
          limitations: data.limitations,
        },
        8,
      )
      return
    }

    if (step === 8) {
      if (editMode) {
        void finishOnboarding('/dashboard/settings')
        return
      }
      void finishOnboarding(homeAfterOnboarding)
      return
    }
  }

  async function finishOnboarding(redirectTo: string) {
    if (savingRef.current) return
    savingRef.current = true
    setError(null)
    startTransition(async () => {
      try {
        const result = await completeOnboardingAction({ ...data, step: 8 })
        if (!result.ok) {
          setError(result.error)
          return
        }
        const destination =
          !editMode && result.offerTour
            ? pathWithTourParam(redirectTo)
            : redirectTo
        // Hard navigation so middleware sees refreshed session cookies.
        window.location.assign(destination)
      } catch {
        setError(t('saveFailed'))
      } finally {
        savingRef.current = false
      }
    })
  }

  async function handleSkip() {
    if (step === 2) {
      await persist({ ageRange: null, gender: null }, 3)
      return
    }
    if (step === 3) {
      const ok = await persist(
        { heightCm: null, weightKg: null, preferredUnit: unit },
        4,
      )
      if (ok) {
        setHeightCmInput('')
        setHeightFt('')
        setHeightIn('')
        setWeightInput('')
      }
      return
    }
    if (step === 7) {
      await persist(
        {
          trainingStyles: [],
          favoriteMuscleGroups: [],
          avoidances: '',
          limitations: '',
        },
        8,
      )
    }
  }

  function goBack() {
    setError(null)
    if (step <= 1) return
    if (savingRef.current) return
    const prev = step - 1
    setStep(prev)
    patch({ step: prev })
    // Soft-save step only so refresh returns here without wiping unsaved answers.
    savingRef.current = true
    void saveOnboardingProgressAction({ step: prev }).finally(() => {
      savingRef.current = false
    })
  }

  const progressPct = Math.round((Math.min(step, 7) / 7) * 100)
  const busy = pending

  const goalLabel = (g: FitnessGoal) => t(`goals.${g}`)
  const equipLabel = (e: EquipmentId) => t(`equipment.${e}`)

  return (
    <main className="relative mx-auto flex min-h-svh w-full max-w-lg flex-col px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1.25rem)] text-foreground">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[22rem] bg-[radial-gradient(ellipse_70%_40%_at_50%_-5%,rgba(232,181,74,0.12),transparent_60%)]"
        aria-hidden="true"
      />

      <header className="sticky top-0 z-20 -mx-4 mb-6 bg-background/95 px-4 pb-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
              <Dumbbell className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-semibold tracking-[0.28em] text-gold">
                {editMode ? t('editKicker') : t('kicker')}
              </p>
              <p className="text-xs text-muted-foreground">
                {step <= 7
                  ? t('stepOf', { current: step, total: 7 })
                  : t('reviewTitle')}
              </p>
            </div>
          </div>
          {editMode ? (
            <Link
              href="/dashboard/settings"
              className="text-xs font-medium text-muted-foreground hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              {t('backToSettings')}
            </Link>
          ) : null}
        </div>

        <div
          className="h-1.5 overflow-hidden rounded-full bg-silver/15"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={step >= 8 ? 100 : progressPct}
          aria-label={t('progressLabel')}
        >
          <div
            className="h-full rounded-full bg-gold transition-all duration-300"
            style={{ width: `${step >= 8 ? 100 : progressPct}%` }}
          />
        </div>
      </header>

      <div className="relative z-10 flex flex-1 flex-col rounded-2xl border border-gold/20 bg-card/70 p-5 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-7">
        {error ? (
          <div
            role="alert"
            className="mb-4 flex items-start gap-3 rounded-xl border border-gold/30 bg-gold/10 px-3 py-3 text-sm text-gold/90"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p>{error}</p>
              <button
                type="button"
                className="mt-2 text-xs font-semibold underline-offset-2 hover:underline"
                onClick={() => void handleContinue()}
              >
                {t('retry')}
              </button>
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <section className="flex flex-col gap-5">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight">
                {t('step1.title')}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {t('step1.body')}
              </p>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t('step1.displayName')}{' '}
                <span className="text-gold">*</span>
              </span>
              <input
                value={data.displayName}
                onChange={(e) => patch({ displayName: e.target.value })}
                maxLength={40}
                autoComplete="name"
                className="h-11 rounded-xl border border-border bg-background/80 px-4 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t('step1.username')}{' '}
                <span className="text-gold">*</span>
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  @
                </span>
                <input
                  value={data.username}
                  onChange={(e) => {
                    const next = e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, '')
                    patch({ username: next })
                    setUsernameStatus(null)
                  }}
                  onBlur={async () => {
                    if (!data.username) {
                      setUsernameStatus(t('errors.usernameFormat'))
                      return
                    }
                    const check = await checkUsernameAvailableAction(data.username)
                    setUsernameStatus(
                      check.available
                        ? t('step1.usernameAvailable')
                        : check.error || t('errors.usernameTaken'),
                    )
                  }}
                  maxLength={30}
                  required
                  autoComplete="username"
                  className="h-11 w-full rounded-xl border border-border bg-background/80 py-2 pe-4 ps-8 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
              </div>
              {usernameStatus ? (
                <p className="text-xs text-muted-foreground" role="status">
                  {usernameStatus}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t('step1.usernameHint')}
                </p>
              )}
            </label>

            <ProfileAvatarPicker
              displayName={data.displayName}
              username={data.username}
              initialAvatarUrl={initialAvatarUrl}
              disabled={pending}
              onChange={setAvatarSelection}
              onError={(message) => setError(message)}
            />

            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                {t('step1.appearance')}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { value: 'light' as AppearanceMode, Icon: Sun, label: t('step1.light') },
                    { value: 'dark' as AppearanceMode, Icon: Moon, label: t('step1.dark') },
                    {
                      value: 'system' as AppearanceMode,
                      Icon: Monitor,
                      label: t('step1.system'),
                    },
                  ] as const
                ).map(({ value, Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={data.appearance === value}
                    onClick={() => {
                      patch({ appearance: value })
                      previewAppearance(value)
                    }}
                    className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border px-2 text-center text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
                      data.appearance === value
                        ? 'border-gold/50 bg-gold/10 text-gold'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="flex flex-col gap-5">
            <div>
              <h1 className="font-heading text-2xl font-bold">{t('step2.title')}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('step2.body')}</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                {t('step2.age')}{' '}
                <span className="text-xs text-muted-foreground">
                  ({t('optional')})
                </span>
              </p>
              <div className="flex flex-col gap-2">
                {(
                  [
                    'under_18',
                    '18_24',
                    '25_34',
                    '35_44',
                    '45_54',
                    '55_plus',
                    'prefer_not',
                  ] as AgeRange[]
                ).map((value) => (
                  <OptionButton
                    key={value}
                    selected={data.ageRange === value}
                    label={t(`ageRanges.${value}`)}
                    onClick={() => patch({ ageRange: value })}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                {t('step2.gender')}{' '}
                <span className="text-xs text-muted-foreground">
                  ({t('optional')})
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    'male',
                    'female',
                    'prefer_not',
                  ] as OnboardingGender[]
                ).map((value) => (
                  <Chip
                    key={value}
                    selected={data.gender === value}
                    label={t(`gender.${value}`)}
                    onClick={() => patch({ gender: value })}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">{t('step2.language')}</p>
              <div className="grid grid-cols-2 gap-2">
                {(['en', 'ar'] as AppLocale[]).map((value) => (
                  <OptionButton
                    key={value}
                    selected={(data.language ?? locale) === value}
                    label={t(`languages.${value}`)}
                    onClick={() => {
                      patch({ language: value })
                      applyLocaleToDocument(value)
                    }}
                  />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {step === 3 ? (
          <section className="flex flex-col gap-5">
            <div>
              <h1 className="font-heading text-2xl font-bold">{t('step3.title')}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('step3.body')}</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">{t('step3.units')}</p>
              <div className="inline-flex rounded-xl border border-silver/15 p-1">
                {(['kg', 'lb'] as WeightUnit[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={unit === value}
                    onClick={() => {
                      if (value === unit) return
                      if (weightInput.trim()) {
                        const display = Number(weightInput)
                        if (Number.isFinite(display)) {
                          const kg = displayToKg(display, unit)
                          setWeightInput(
                            String(
                              Math.round(kgToDisplay(kg, value) * 10) / 10,
                            ),
                          )
                        }
                      }
                      if (unit === 'kg' && value === 'lb' && heightCmInput.trim()) {
                        const cm = Number(heightCmInput)
                        if (isValidHeightCm(cm)) {
                          const { feet, inches } = cmToFeetInches(cm)
                          setHeightFt(String(feet))
                          setHeightIn(String(inches))
                        }
                      } else if (
                        unit === 'lb' &&
                        value === 'kg' &&
                        (heightFt.trim() || heightIn.trim())
                      ) {
                        const cm = feetInchesToCm(
                          Number(heightFt) || 0,
                          Number(heightIn) || 0,
                        )
                        if (isValidHeightCm(cm)) {
                          setHeightCmInput(String(Math.round(cm)))
                        }
                      }
                      patch({ preferredUnit: value })
                    }}
                    className={`min-h-11 rounded-lg px-4 text-xs font-bold tracking-wider ${
                      unit === value
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {value === 'kg' ? t('step3.metric') : t('step3.imperial')}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {t('step3.height')}{' '}
                  <span className="text-xs">({t('optional')})</span>
                </span>
                {unit === 'lb' ? (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={heightFt}
                      onChange={(e) => setHeightFt(e.target.value)}
                      aria-label={t('step3.feet')}
                      className="h-11 w-full rounded-xl border border-border bg-background/80 px-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                    />
                    <input
                      type="number"
                      inputMode="numeric"
                      value={heightIn}
                      onChange={(e) => setHeightIn(e.target.value)}
                      aria-label={t('step3.inches')}
                      className="h-11 w-full rounded-xl border border-border bg-background/80 px-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                    />
                  </div>
                ) : (
                  <input
                    type="number"
                    inputMode="decimal"
                    value={heightCmInput}
                    onChange={(e) => setHeightCmInput(e.target.value)}
                    placeholder="175"
                    className="h-11 rounded-xl border border-border bg-background/80 px-4 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                )}
              </label>

              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {t('step3.weight')}{' '}
                  <span className="text-xs">({t('optional')})</span>
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={weightInput}
                  onChange={(e) => setWeightInput(e.target.value)}
                  placeholder={unit === 'kg' ? '75' : '165'}
                  className="h-11 rounded-xl border border-border bg-background/80 px-4 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">{t('step3.disclaimer')}</p>
          </section>
        ) : null}

        {step === 4 ? (
          <section className="flex flex-col gap-5">
            <div>
              <h1 className="font-heading text-2xl font-bold">{t('step4.title')}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('step4.body')}</p>
            </div>
            <div className="flex flex-col gap-2">
              {(
                [
                  'build_muscle',
                  'lose_fat',
                  'get_stronger',
                  'endurance',
                  'stay_active',
                  'athletic',
                  'other',
                ] as FitnessGoal[]
              ).map((value) => (
                <OptionButton
                  key={value}
                  selected={data.primaryGoal === value}
                  label={goalLabel(value)}
                  onClick={() =>
                    patch({
                      primaryGoal: value,
                      secondaryGoals: data.secondaryGoals.filter((g) => g !== value),
                    })
                  }
                />
              ))}
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">
                {t('step4.secondary')}{' '}
                <span className="text-xs text-muted-foreground">
                  ({t('optional')})
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    'build_muscle',
                    'lose_fat',
                    'get_stronger',
                    'endurance',
                    'stay_active',
                    'athletic',
                    'other',
                  ] as FitnessGoal[]
                )
                  .filter((g) => g !== data.primaryGoal)
                  .map((value) => (
                    <Chip
                      key={value}
                      selected={data.secondaryGoals.includes(value)}
                      label={goalLabel(value)}
                      onClick={() => {
                        const has = data.secondaryGoals.includes(value)
                        patch({
                          secondaryGoals: has
                            ? data.secondaryGoals.filter((g) => g !== value)
                            : [...data.secondaryGoals, value],
                        })
                      }}
                    />
                  ))}
              </div>
            </div>
          </section>
        ) : null}

        {step === 5 ? (
          <section className="flex flex-col gap-5">
            <div>
              <h1 className="font-heading text-2xl font-bold">{t('step5.title')}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('step5.body')}</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                {t('step5.level')} <span className="text-gold">*</span>
              </p>
              <div className="flex flex-col gap-2">
                {(['beginner', 'intermediate', 'advanced'] as FitnessLevel[]).map(
                  (value) => (
                    <OptionButton
                      key={value}
                      selected={data.fitnessLevel === value}
                      label={t(`levels.${value}`)}
                      hint={t(`levels.${value}Hint`)}
                      onClick={() => patch({ fitnessLevel: value })}
                    />
                  ),
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                {t('step5.days')} <span className="text-gold">*</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <Chip
                    key={n}
                    selected={data.daysPerWeek === n}
                    label={String(n)}
                    onClick={() => patch({ daysPerWeek: n })}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                {t('step5.duration')} <span className="text-gold">*</span>
              </p>
              <div className="flex flex-col gap-2">
                {(
                  [
                    'under_30',
                    '30_45',
                    '45_60',
                    'over_60',
                  ] as WorkoutDuration[]
                ).map((value) => (
                  <OptionButton
                    key={value}
                    selected={data.workoutDuration === value}
                    label={t(`durations.${value}`)}
                    onClick={() => patch({ workoutDuration: value })}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                {t('step5.preferredDays')}{' '}
                <span className="text-xs text-muted-foreground">
                  ({t('optional')})
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    'mon',
                    'tue',
                    'wed',
                    'thu',
                    'fri',
                    'sat',
                    'sun',
                  ] as Weekday[]
                ).map((value) => (
                  <Chip
                    key={value}
                    selected={data.preferredDays.includes(value)}
                    label={t(`weekdays.${value}`)}
                    onClick={() => {
                      const has = data.preferredDays.includes(value)
                      patch({
                        preferredDays: has
                          ? data.preferredDays.filter((d) => d !== value)
                          : [...data.preferredDays, value],
                      })
                    }}
                  />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {step === 6 ? (
          <section className="flex flex-col gap-5">
            <div>
              <h1 className="font-heading text-2xl font-bold">{t('step6.title')}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('step6.body')}</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                {t('step6.location')} <span className="text-gold">*</span>
              </p>
              <div className="flex flex-col gap-2">
                {(['home', 'gym', 'both'] as TrainingLocation[]).map((value) => (
                  <OptionButton
                    key={value}
                    selected={data.trainingLocation === value}
                    label={t(`locations.${value}`)}
                    onClick={() => {
                      const allowed = new Set(equipmentOptionsForLocation(value))
                      patch({
                        trainingLocation: value,
                        equipment: data.equipment.filter((e) => allowed.has(e)),
                      })
                    }}
                  />
                ))}
              </div>
            </div>

            {data.trainingLocation ? (
              <div>
                <p className="mb-2 text-sm font-medium">
                  {t('step6.equipment')}{' '}
                  <span className="text-xs text-muted-foreground">
                    ({t('optional')})
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {equipmentOptionsForLocation(data.trainingLocation).map(
                    (value) => (
                      <Chip
                        key={value}
                        selected={data.equipment.includes(value)}
                        label={equipLabel(value)}
                        onClick={() => {
                          const has = data.equipment.includes(value)
                          patch({
                            equipment: has
                              ? data.equipment.filter((e) => e !== value)
                              : [...data.equipment, value],
                          })
                        }}
                      />
                    ),
                  )}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {step === 7 ? (
          <section className="flex flex-col gap-5">
            <div>
              <h1 className="font-heading text-2xl font-bold">{t('step7.title')}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('step7.body')}</p>
            </div>

            <div
              role="note"
              className="rounded-xl border border-silver/20 bg-background/50 px-3 py-3 text-xs leading-relaxed text-muted-foreground"
            >
              {t('step7.medicalDisclaimer')}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                {t('step7.styles')}{' '}
                <span className="text-xs text-muted-foreground">
                  ({t('optional')})
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    'full_body',
                    'ppl',
                    'upper_lower',
                    'cardio',
                    'strength',
                    'mobility',
                    'no_preference',
                  ] as TrainingStyle[]
                ).map((value) => (
                  <Chip
                    key={value}
                    selected={data.trainingStyles.includes(value)}
                    label={t(`styles.${value}`)}
                    onClick={() => {
                      const has = data.trainingStyles.includes(value)
                      patch({
                        trainingStyles: has
                          ? data.trainingStyles.filter((s) => s !== value)
                          : [...data.trainingStyles, value],
                      })
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                {t('step7.muscles')}{' '}
                <span className="text-xs text-muted-foreground">
                  ({t('optional')})
                </span>
              </p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    'chest',
                    'back',
                    'shoulders',
                    'arms',
                    'core',
                    'legs',
                    'glutes',
                    'full_body',
                  ] as MuscleGroup[]
                ).map((value) => (
                  <Chip
                    key={value}
                    selected={data.favoriteMuscleGroups.includes(value)}
                    label={t(`muscles.${value}`)}
                    onClick={() => {
                      const has = data.favoriteMuscleGroups.includes(value)
                      patch({
                        favoriteMuscleGroups: has
                          ? data.favoriteMuscleGroups.filter((m) => m !== value)
                          : [...data.favoriteMuscleGroups, value],
                      })
                    }}
                  />
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                {t('step7.avoid')}{' '}
                <span className="text-xs text-muted-foreground">
                  ({t('optional')})
                </span>
              </span>
              <textarea
                value={data.avoidances}
                onChange={(e) => patch({ avoidances: e.target.value })}
                rows={3}
                maxLength={500}
                className="rounded-xl border border-border bg-background/80 px-4 py-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                placeholder={t('step7.avoidPlaceholder')}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                {t('step7.limitations')}{' '}
                <span className="text-xs text-muted-foreground">
                  ({t('optional')})
                </span>
              </span>
              <textarea
                value={data.limitations}
                onChange={(e) => patch({ limitations: e.target.value })}
                rows={3}
                maxLength={500}
                className="rounded-xl border border-border bg-background/80 px-4 py-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                placeholder={t('step7.limitationsPlaceholder')}
              />
            </label>
          </section>
        ) : null}

        {step === 8 ? (
          <section className="flex flex-col gap-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
                <CheckCircle2 className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h1 className="font-heading text-2xl font-bold">
                  {editMode ? t('reviewEditTitle') : t('reviewTitle')}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t('reviewBody', { name: data.displayName.split(/\s+/)[0] })}
                </p>
              </div>
            </div>

            <ul className="space-y-3 text-sm text-muted-foreground">
              {data.primaryGoal ? (
                <li className="rounded-xl border border-silver/15 bg-background/40 px-4 py-3 text-foreground">
                  {t('summary.goal', { goal: goalLabel(data.primaryGoal) })}
                </li>
              ) : null}
              {data.daysPerWeek != null ? (
                <li className="rounded-xl border border-silver/15 bg-background/40 px-4 py-3 text-foreground">
                  {t('summary.schedule', {
                    days: data.daysPerWeek,
                    duration: data.workoutDuration
                      ? t(`durations.${data.workoutDuration}`)
                      : '—',
                    level: data.fitnessLevel
                      ? t(`levels.${data.fitnessLevel}`)
                      : '—',
                  })}
                </li>
              ) : null}
              {data.trainingLocation ? (
                <li className="rounded-xl border border-silver/15 bg-background/40 px-4 py-3 text-foreground">
                  {t('summary.place', {
                    place: t(`locations.${data.trainingLocation}`),
                    equipment:
                      data.equipment.length > 0
                        ? data.equipment.map(equipLabel).join(', ')
                        : t('summary.noEquipment'),
                  })}
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        <div className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-silver/10 bg-background/95 px-4 py-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
          <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {step > 1 ? (
              <button
                type="button"
                disabled={busy}
                onClick={goBack}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border border-silver/25 px-4 text-xs font-semibold tracking-[0.12em] text-muted-foreground transition hover:border-gold/35 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50"
              >
                <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
                {t('back')}
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleContinue()}
              className="inline-flex min-h-12 flex-[1.4] items-center justify-center gap-2 rounded-full bg-gold px-4 text-xs font-bold tracking-[0.14em] text-black transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              {step === 8
                ? editMode
                  ? t('saveChanges')
                  : t('finish')
                : t('continue')}
            </button>
          </div>

          {step === 2 || step === 3 || step === 7 ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSkip()}
              className="min-h-11 text-sm text-muted-foreground transition hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50"
            >
              {t('skip')}
            </button>
          ) : null}

          </div>
        </div>
      </div>
    </main>
  )
}
