'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Dumbbell,
  ListPlus,
  Loader2,
  Monitor,
  Moon,
  Sparkles,
  Sun,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import {
  ActionFeedbackBanner,
  useActionFeedback,
} from '@/components/action-feedback'
import {
  checkUsernameAvailableAction,
  completeOnboardingAction,
  markOnboardingStartedAction,
  saveOnboardingProgressAction,
  type OnboardingAvatarOptions,
} from '@/lib/data/onboarding-actions'
import {
  createFirstPersonalizedSplitAction,
  skipSplitRecommendationAction,
} from '@/lib/data/split-recommendation-actions'
import { deferAppTourAction } from '@/lib/data/tour-actions'
import { updateLanguagePreferenceAction } from '@/lib/data/profile-actions'
import { pathWithTourParam } from '@/lib/app-tour-storage'
import {
  ProfileAvatarPicker,
  type ProfileAvatarPickerValue,
} from '@/components/profile-avatar-picker'
import { uploadProfileAvatar } from '@/lib/upload-profile-avatar.client'
import {
  ONBOARDING_META_VERSION,
  ONBOARDING_STEPS,
  type FitnessGoal,
  type FitnessLevel,
  type OnboardingData,
  type TrainingLocation,
  type WorkoutDuration,
} from '@/lib/onboarding-types'
import { useTheme } from '@/components/theme-provider'
import { CHOICE_IDLE, CHOICE_SELECTED, CTA_PRIMARY } from '@/lib/accent'
import type { AppearanceMode } from '@/lib/theme'
import { markLocaleChosen, type AppLocale } from '@/lib/i18n'

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
        selected ? CHOICE_SELECTED : CHOICE_IDLE
      }`}
    >
      <span className="text-sm font-semibold tracking-wide text-foreground">
        {label}
      </span>
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
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-4 text-xs font-semibold tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50 ${
        selected ? CHOICE_SELECTED : CHOICE_IDLE
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
  const router = useRouter()
  const { notifyError } = useActionFeedback()
  const { previewAppearance, appearance } = useTheme()
  const [data, setData] = useState<OnboardingData>(() => ({
    ...initialData,
    language:
      initialData.language === 'en' || initialData.language === 'ar'
        ? initialData.language
        : locale === 'ar'
          ? 'ar'
          : 'en',
  }))
  const [step, setStep] = useState(() =>
    editMode
      ? 1
      : Math.min(ONBOARDING_STEPS, Math.max(1, initialData.step || 1)),
  )
  const [error, setError] = useState<string | null>(null)

  const showError = useCallback(
    (message: string) => {
      setError(message)
      notifyError(message)
    },
    [notifyError],
  )
  const [pending, startTransition] = useTransition()
  const [usernameStatus, setUsernameStatus] = useState<string | null>(null)
  const [buildingProgram, setBuildingProgram] = useState(false)
  const [programChoice, setProgramChoice] = useState<'ai' | 'manual' | null>(
    null,
  )
  const [avatarSelection, setAvatarSelection] = useState<ProfileAvatarPickerValue>({
    file: null,
    presetPath: null,
    previewUrl: null,
  })
  const savingRef = useRef(false)
  const startedRef = useRef(false)

  const usernameLocked =
    !editMode &&
    /^[a-z0-9_]{3,30}$/.test(initialData.username.trim()) &&
    !initialData.username.startsWith('tmp_')

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
        const payload = {
          ...partial,
          step: nextStep,
          version: ONBOARDING_META_VERSION,
        }
        startTransition(async () => {
          try {
            const result = await saveOnboardingProgressAction(payload, avatar)
            if (!result.ok) {
              showError(result.error)
              resolve(false)
              return
            }
            setData(result.data)
            setStep(nextStep)
            resolve(true)
          } catch {
            showError(t('saveFailed'))
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
        showError(tAuth('avatarUploadFailed'))
        return undefined
      }
    }
    if (avatarSelection.presetPath) {
      return { avatarPresetPath: avatarSelection.presetPath }
    }
    return undefined
  }

  function selectLanguage(next: AppLocale) {
    if (data.language === next) return
    patch({ language: next })
    markLocaleChosen(next)
    startTransition(async () => {
      const result = await updateLanguagePreferenceAction(next)
      if (!result.ok) {
        showError(result.error)
        return
      }
      router.refresh()
    })
  }

  async function validateIdentity(): Promise<string | null> {
    const name = data.displayName.trim()
    if (name.length < 2 || name.length > 40) return t('errors.displayName')
    const handle = data.username.trim().toLowerCase()
    if (!handle) return t('errors.usernameFormat')
    if (!/^[a-z0-9_]{3,30}$/.test(handle)) return t('errors.usernameFormat')
    if (!usernameLocked || handle !== initialData.username.trim().toLowerCase()) {
      const check = await checkUsernameAvailableAction(handle)
      if (!check.available) return check.error || t('errors.usernameTaken')
    }
    return null
  }

  function validateTraining(): string | null {
    if (!data.primaryGoal) return t('errors.primaryGoal')
    if (!data.fitnessLevel) return t('errors.fitnessLevel')
    if (data.daysPerWeek == null || data.daysPerWeek < 1 || data.daysPerWeek > 7) {
      return t('errors.daysPerWeek')
    }
    if (!data.workoutDuration) return t('errors.duration')
    if (!data.trainingLocation) return t('errors.location')
    return null
  }

  const homeAfterOnboarding = returnNext ?? '/dashboard/home?tour=1'

  async function handleContinue() {
    setError(null)
    setUsernameStatus(null)

    if (step === 1) {
      const language: AppLocale =
        data.language === 'ar' || data.language === 'en'
          ? data.language
          : locale === 'ar'
            ? 'ar'
            : 'en'
      await persist(
        {
          appearance: data.appearance,
          language,
        },
        2,
      )
      return
    }

    if (step === 2) {
      const err = await validateIdentity()
      if (err) {
        showError(err)
        return
      }
      const avatar = await buildAvatarOptions()
      if (avatarSelection.file && !avatar) return
      await persist(
        {
          displayName: data.displayName,
          username: data.username,
        },
        3,
        avatar,
      )
      return
    }

    if (step === 3) {
      const err = validateTraining()
      if (err) {
        showError(err)
        return
      }
      await persist(
        {
          primaryGoal: data.primaryGoal,
          fitnessLevel: data.fitnessLevel,
          daysPerWeek: data.daysPerWeek,
          workoutDuration: data.workoutDuration,
          trainingLocation: data.trainingLocation,
        },
        4,
      )
      return
    }

    if (step === 4) {
      if (editMode) {
        void finishOnboarding({ redirectTo: '/dashboard/settings' })
        return
      }
      if (!programChoice) {
        showError(t('errors.programChoice'))
        return
      }
      void finishOnboarding({
        redirectTo:
          programChoice === 'manual'
            ? '/dashboard/splits/create?tourAfterSave=1'
            : homeAfterOnboarding,
        choice: programChoice,
      })
    }
  }

  async function finishOnboarding(options: {
    redirectTo: string
    choice?: 'ai' | 'manual'
  }) {
    if (savingRef.current) return
    savingRef.current = true
    setError(null)
    startTransition(async () => {
      try {
        const result = await completeOnboardingAction({ ...data, step: 4 })
        if (!result.ok) {
          showError(result.error)
          return
        }

        const choice = options.choice
        if (!editMode && choice === 'ai') {
          setBuildingProgram(true)
          try {
            await createFirstPersonalizedSplitAction({ ...data })
          } catch {
            // Non-blocking: athlete can still use recommendations later.
          } finally {
            setBuildingProgram(false)
          }
        }

        if (!editMode && choice === 'manual') {
          try {
            await skipSplitRecommendationAction()
          } catch {
            // Non-blocking preference write.
          }
          // Keep the tour quiet on the builder — start it after they save.
          try {
            await deferAppTourAction(0)
          } catch {
            /* best-effort */
          }
        }

        const withTour =
          !editMode &&
          result.offerTour &&
          choice !== 'manual' &&
          options.redirectTo.startsWith('/dashboard')
        const destination = withTour
          ? pathWithTourParam(options.redirectTo)
          : options.redirectTo
        // Hard navigation so middleware sees refreshed session cookies.
        window.location.assign(destination)
      } catch {
        showError(t('saveFailed'))
      } finally {
        savingRef.current = false
        setBuildingProgram(false)
      }
    })
  }

  function goBack() {
    setError(null)
    if (step <= 1) return
    if (savingRef.current) return
    const prev = step - 1
    setStep(prev)
    patch({ step: prev })
    savingRef.current = true
    void saveOnboardingProgressAction({ step: prev }).finally(() => {
      savingRef.current = false
    })
  }

  const progressPct = Math.round((Math.min(step, ONBOARDING_STEPS) / ONBOARDING_STEPS) * 100)
  const busy = pending || buildingProgram
  const goalLabel = (g: FitnessGoal) => t(`goals.${g}`)
  const selectedLanguage: AppLocale =
    data.language === 'ar' || data.language === 'en'
      ? data.language
      : locale === 'ar'
        ? 'ar'
        : 'en'

  return (
    <main className="relative mx-auto flex min-h-svh w-full max-w-lg flex-col px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-[calc(env(safe-area-inset-top)+1.25rem)] text-foreground">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[22rem] gold-radial-wash"
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
                {step < ONBOARDING_STEPS
                  ? t('stepOf', { current: step, total: ONBOARDING_STEPS })
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
          aria-valuenow={progressPct}
          aria-label={t('progressLabel')}
        >
          <div
            className="h-full rounded-full bg-gold transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      <div className="relative z-10 flex flex-1 flex-col rounded-2xl border border-gold/20 bg-card/70 p-5 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-7">
        {step === 1 ? (
          <section className="flex flex-col gap-6">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight">
                {t('step1.title')}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('step1.body')}</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">{t('step1.appearance')}</p>
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
                    className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border px-2 text-center text-xs font-semibold transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
                      data.appearance === value
                        ? CHOICE_SELECTED
                        : CHOICE_IDLE
                    }`}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">{t('step1.language')}</p>
              <div className="grid grid-cols-2 gap-2">
                {(['en', 'ar'] as AppLocale[]).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selectedLanguage === value}
                    onClick={() => selectLanguage(value)}
                    className={`flex min-h-14 flex-col items-center justify-center rounded-full border px-4 text-center transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
                      selectedLanguage === value
                        ? CHOICE_SELECTED
                        : CHOICE_IDLE
                    }`}
                  >
                    <span className="text-sm font-bold tracking-wide">
                      {t(`languages.${value}`)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {step === 2 ? (
          <section className="flex flex-col gap-5">
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight">
                {t('step2.title')}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {usernameLocked ? t('step2.bodyLocked') : t('step2.body')}
              </p>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                {t('step2.displayName')}{' '}
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
                {t('step2.username')}{' '}
                <span className="text-gold">*</span>
              </span>
              <div className="relative">
                <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                  @
                </span>
                <input
                  value={data.username}
                  readOnly={usernameLocked}
                  onChange={(e) => {
                    if (usernameLocked) return
                    const next = e.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_]/g, '')
                    patch({ username: next })
                    setUsernameStatus(null)
                  }}
                  onBlur={async () => {
                    if (usernameLocked) return
                    if (!data.username) {
                      setUsernameStatus(t('errors.usernameFormat'))
                      return
                    }
                    const check = await checkUsernameAvailableAction(data.username)
                    setUsernameStatus(
                      check.available
                        ? t('step2.usernameAvailable')
                        : check.error || t('errors.usernameTaken'),
                    )
                  }}
                  maxLength={30}
                  required
                  autoComplete="username"
                  className={`h-11 w-full rounded-xl border border-border bg-background/80 py-2 pe-4 ps-8 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 ${
                    usernameLocked ? 'opacity-80' : ''
                  }`}
                />
              </div>
              {usernameLocked ? (
                <p className="text-xs text-muted-foreground">
                  {t('step2.usernameLockedHint')}
                </p>
              ) : usernameStatus ? (
                <p className="text-xs text-muted-foreground" role="status">
                  {usernameStatus}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {t('step2.usernameHint')}
                </p>
              )}
            </label>

            <ProfileAvatarPicker
              displayName={data.displayName}
              username={data.username}
              initialAvatarUrl={initialAvatarUrl}
              disabled={pending}
              onChange={setAvatarSelection}
              onError={(message) => showError(message)}
            />
          </section>
        ) : null}

        {step === 3 ? (
          <section className="flex flex-col gap-6">
            <div>
              <h1 className="font-heading text-2xl font-bold">{t('step3.title')}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t('step3.body')}</p>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                {t('step3.goal')} <span className="text-gold">*</span>
              </p>
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
                    onClick={() => patch({ primaryGoal: value })}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">
                {t('step3.level')} <span className="text-gold">*</span>
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
                {t('step3.days')} <span className="text-gold">*</span>
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
                {t('step3.duration')} <span className="text-gold">*</span>
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
                {t('step3.location')} <span className="text-gold">*</span>
              </p>
              <div className="flex flex-col gap-2">
                {(['home', 'gym', 'both'] as TrainingLocation[]).map((value) => (
                  <OptionButton
                    key={value}
                    selected={data.trainingLocation === value}
                    label={t(`locations.${value}`)}
                    onClick={() => patch({ trainingLocation: value })}
                  />
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {step === 4 ? (
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
                  {t('reviewBody', {
                    name: data.displayName.trim().split(/\s+/)[0] || t('athleteFallback'),
                  })}
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
                    equipment: t('summary.noEquipment'),
                  })}
                </li>
              ) : null}
            </ul>

            {!editMode ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-foreground">
                  {t('programChoiceTitle')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('programChoiceBody')}
                </p>
                <div className="flex flex-col gap-3" role="group" aria-label={t('programChoiceTitle')}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setProgramChoice('ai')
                      setError(null)
                      void finishOnboarding({
                        redirectTo: homeAfterOnboarding,
                        choice: 'ai',
                      })
                    }}
                    className="inline-flex min-h-14 w-full items-center justify-between gap-3 rounded-full border border-gold/45 bg-gold-tint px-5 text-start transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex items-center gap-3">
                      {buildingProgram && programChoice === 'ai' ? (
                        <Loader2 className="size-5 shrink-0 animate-spin text-gold" aria-hidden="true" />
                      ) : (
                        <Sparkles className="size-5 shrink-0 text-gold" aria-hidden="true" />
                      )}
                      <span>
                        <span className="block text-sm font-bold tracking-wide text-gold">
                          {buildingProgram && programChoice === 'ai'
                            ? t('buildingProgram')
                            : t('programChoiceAi')}
                        </span>
                        <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
                          {t('programChoiceAiHint')}
                        </span>
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-gold rtl-flip" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setProgramChoice('manual')
                      setError(null)
                      void finishOnboarding({
                        redirectTo: '/dashboard/splits/create?tourAfterSave=1',
                        choice: 'manual',
                      })
                    }}
                    className="inline-flex min-h-14 w-full items-center justify-between gap-3 rounded-full border-2 border-gold/60 bg-card px-5 text-start shadow-sm transition hover:bg-gold/10 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex items-center gap-3">
                      <ListPlus className="size-5 shrink-0 text-gold" aria-hidden="true" />
                      <span>
                        <span className="block text-sm font-bold tracking-wide text-foreground">
                          {t('programChoiceManual')}
                        </span>
                        <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
                          {t('programChoiceManualHint')}
                        </span>
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-gold rtl-flip" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <div className="sticky bottom-0 z-20 -mx-4 mt-8 space-y-3 border-t border-silver/10 bg-background/95 px-4 py-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
          <ActionFeedbackBanner
            error={error}
            onRetry={() => void handleContinue()}
            retryLabel={t('retry')}
          />
          <div className="flex gap-2">
            {step > 1 ? (
              <button
                type="button"
                disabled={busy}
                onClick={goBack}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full border-2 border-silver/35 bg-card px-4 text-xs font-bold tracking-[0.12em] text-foreground shadow-sm transition hover:border-gold/45 hover:bg-gold/5 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50"
              >
                <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
                {t('back')}
              </button>
            ) : null}
            {step === 4 && !editMode ? null : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleContinue()}
                className={`inline-flex min-h-12 flex-[1.4] items-center justify-center gap-2 ${CTA_PRIMARY} px-4 tracking-[0.14em] disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {step === 4 && editMode ? t('saveChanges') : t('continue')}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
