'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Check,
  Ruler,
  Target,
  CalendarDays,
  MapPin,
  Shield,
  Loader2,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { completeOnboardingAction } from '@/lib/data/onboarding-actions'
import {
  ActionFeedbackBanner,
  useActionFeedback,
} from '@/components/action-feedback'
import {
  equipmentOptionsForLocation,
  type AgeRange,
  type EquipmentId,
  type FitnessGoal,
  type FitnessLevel,
  type OnboardingData,
  type OnboardingGender,
  type TrainingLocation,
  type WorkoutDuration,
} from '@/lib/onboarding-types'
import {
  cmToFeetInches,
  displayToKg,
  feetInchesToCm,
  formatHeightCm,
  formatWeightKg,
  isValidHeightCm,
  isValidWeightKg,
  kgToDisplay,
} from '@/lib/units'

type FitnessProfilePageProps = {
  initialData: OnboardingData
}

const GOALS: FitnessGoal[] = [
  'build_muscle',
  'lose_fat',
  'get_stronger',
  'endurance',
  'stay_active',
  'athletic',
  'other',
]

const LEVELS: FitnessLevel[] = ['beginner', 'intermediate', 'advanced']

const DURATIONS: WorkoutDuration[] = [
  'under_30',
  '30_45',
  '45_60',
  'over_60',
]

const LOCATIONS: TrainingLocation[] = ['home', 'gym', 'both']

const AGE_RANGES: AgeRange[] = [
  'under_18',
  '18_24',
  '25_34',
  '35_44',
  '45_54',
  '55_plus',
  'prefer_not',
]

const GENDERS: OnboardingGender[] = ['male', 'female', 'prefer_not']

function ChoiceButton({
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
          ? 'border-gold/45 bg-gold-tint text-gold'
          : 'border-border bg-background/60 text-muted-foreground hover:border-gold/30 hover:text-foreground'
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

function ChipButton({
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
      className={`inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-xs font-semibold tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50 ${
        selected
          ? 'border-gold/45 bg-gold-tint text-gold'
          : 'border-border bg-background/60 text-muted-foreground hover:border-gold/30 hover:text-foreground'
      }`}
    >
      {selected ? <Check className="me-1.5 size-3.5" aria-hidden="true" /> : null}
      {label}
    </button>
  )
}

export function FitnessProfilePage({ initialData }: FitnessProfilePageProps) {
  const t = useTranslations('fitnessProfile')
  const tOnb = useTranslations('onboarding')
  const router = useRouter()
  const { notifySuccess, notifyError } = useActionFeedback()
  const [data, setData] = useState<OnboardingData>(initialData)
  const [error, setError] = useState<string | null>(null)
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const imperial = data.preferredUnit === 'lb'
  const heightParts =
    data.heightCm != null ? cmToFeetInches(data.heightCm) : { feet: 5, inches: 10 }
  const [heightCmInput, setHeightCmInput] = useState(
    data.heightCm != null ? String(Math.round(data.heightCm)) : '',
  )
  const [feetInput, setFeetInput] = useState(String(heightParts.feet))
  const [inchesInput, setInchesInput] = useState(String(heightParts.inches))
  const [weightInput, setWeightInput] = useState(
    data.weightKg != null
      ? String(Math.round(kgToDisplay(data.weightKg, data.preferredUnit) * 10) / 10)
      : '',
  )

  function patch(partial: Partial<OnboardingData>) {
    setData((prev) => ({ ...prev, ...partial }))
    setSavedMsg(null)
  }

  function resolveHeightCm(): number | null {
    if (imperial) {
      const feet = Number(feetInput)
      const inches = Number(inchesInput)
      if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null
      if (!feetInput.trim() && !inchesInput.trim()) return null
      return feetInchesToCm(feet, inches)
    }
    if (!heightCmInput.trim()) return null
    const n = Number(heightCmInput)
    return Number.isFinite(n) ? n : null
  }

  function resolveWeightKg(): number | null {
    if (!weightInput.trim()) return null
    const n = Number(weightInput)
    if (!Number.isFinite(n)) return null
    return displayToKg(n, data.preferredUnit)
  }

  function toggleEquipment(id: EquipmentId) {
    const next = data.equipment.includes(id)
      ? data.equipment.filter((x) => x !== id)
      : [...data.equipment, id]
    patch({ equipment: next })
  }

  function handleSave() {
    setError(null)
    setSavedMsg(null)

    const heightCm = resolveHeightCm()
    if (heightCm != null && !isValidHeightCm(heightCm)) {
      const msg = tOnb('errors.height')
      setError(msg)
      notifyError(msg)
      return
    }
    const weightKg = resolveWeightKg()
    if (weightKg != null && !isValidWeightKg(weightKg)) {
      const msg = tOnb('errors.weight')
      setError(msg)
      notifyError(msg)
      return
    }
    if (!data.primaryGoal) {
      const msg = tOnb('errors.primaryGoal')
      setError(msg)
      notifyError(msg)
      return
    }
    if (!data.fitnessLevel) {
      const msg = tOnb('errors.fitnessLevel')
      setError(msg)
      notifyError(msg)
      return
    }
    if (data.daysPerWeek == null || data.daysPerWeek < 1 || data.daysPerWeek > 7) {
      const msg = tOnb('errors.daysPerWeek')
      setError(msg)
      notifyError(msg)
      return
    }
    if (!data.workoutDuration) {
      const msg = tOnb('errors.duration')
      setError(msg)
      notifyError(msg)
      return
    }
    if (!data.trainingLocation) {
      const msg = tOnb('errors.location')
      setError(msg)
      notifyError(msg)
      return
    }

    startTransition(async () => {
      const result = await completeOnboardingAction({
        ...data,
        heightCm,
        weightKg,
        step: 4,
      })
      if (!result.ok) {
        setError(result.error)
        notifyError(result.error)
        return
      }
      setData(result.data)
      setSavedMsg(t('saved'))
      notifySuccess(t('saved'))
      router.refresh()
    })
  }

  const equipmentOptions = equipmentOptionsForLocation(data.trainingLocation)
  const summaryHeight =
    data.heightCm != null
      ? formatHeightCm(data.heightCm, data.preferredUnit)
      : t('notSet')
  const summaryWeight =
    data.weightKg != null
      ? formatWeightKg(data.weightKg, data.preferredUnit)
      : t('notSet')

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 pb-8 pt-8 md:px-6 md:pt-12">
      <div className="space-y-3">
        <Link
          href="/dashboard/settings"
          className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold tracking-[0.12em] text-muted-foreground transition hover:text-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
        >
          <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
          {t('backToSettings')}
        </Link>
        <div>
          <p className="text-[10px] font-semibold tracking-[0.28em] text-gold">
            {t('kicker')}
          </p>
          <h1 className="font-heading mt-2 text-3xl font-bold tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
      </div>

      <section className="is-panel space-y-4 p-5" aria-labelledby="body-heading">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            <Ruler className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id="body-heading" className="text-sm font-bold text-foreground">
              {t('bodyTitle')}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t('bodySummary', { height: summaryHeight, weight: summaryWeight })}
            </p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
            {t('units')}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(['kg', 'lb'] as const).map((unit) => (
              <ChipButton
                key={unit}
                selected={data.preferredUnit === unit}
                label={unit === 'kg' ? t('metric') : t('imperial')}
                disabled={pending}
                onClick={() => {
                  const nextWeight =
                    data.weightKg != null
                      ? String(
                          Math.round(kgToDisplay(data.weightKg, unit) * 10) / 10,
                        )
                      : weightInput
                  patch({ preferredUnit: unit })
                  setWeightInput(nextWeight)
                  if (data.heightCm != null) {
                    if (unit === 'lb') {
                      const parts = cmToFeetInches(data.heightCm)
                      setFeetInput(String(parts.feet))
                      setInchesInput(String(parts.inches))
                    } else {
                      setHeightCmInput(String(Math.round(data.heightCm)))
                    }
                  }
                }}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">
              {t('height')}
            </span>
            {imperial ? (
              <div className="flex gap-2">
                <input
                  inputMode="numeric"
                  value={feetInput}
                  onChange={(e) => setFeetInput(e.target.value.replace(/[^\d]/g, ''))}
                  disabled={pending}
                  aria-label={t('feet')}
                  className="h-11 w-full rounded-xl border border-border bg-background/80 px-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  placeholder={t('feet')}
                />
                <input
                  inputMode="numeric"
                  value={inchesInput}
                  onChange={(e) => setInchesInput(e.target.value.replace(/[^\d]/g, ''))}
                  disabled={pending}
                  aria-label={t('inches')}
                  className="h-11 w-full rounded-xl border border-border bg-background/80 px-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  placeholder={t('inches')}
                />
              </div>
            ) : (
              <input
                inputMode="decimal"
                value={heightCmInput}
                onChange={(e) => setHeightCmInput(e.target.value.replace(/[^\d.]/g, ''))}
                disabled={pending}
                className="h-11 rounded-xl border border-border bg-background/80 px-4 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                placeholder="cm"
              />
            )}
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">
              {t('weight')}
            </span>
            <input
              inputMode="decimal"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value.replace(/[^\d.]/g, ''))}
              disabled={pending}
              className="h-11 rounded-xl border border-border bg-background/80 px-4 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              placeholder={data.preferredUnit}
            />
          </label>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
            {t('gender')}
          </p>
          <div className="flex flex-col gap-2">
            {GENDERS.map((value) => (
              <ChoiceButton
                key={value}
                selected={data.gender === value}
                label={tOnb(`gender.${value}`)}
                disabled={pending}
                onClick={() => patch({ gender: value })}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
            {t('age')}
          </p>
          <div className="flex flex-wrap gap-2">
            {AGE_RANGES.map((value) => (
              <ChipButton
                key={value}
                selected={data.ageRange === value}
                label={tOnb(`ageRanges.${value}`)}
                disabled={pending}
                onClick={() => patch({ ageRange: value })}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="is-panel space-y-4 p-5" aria-labelledby="goals-heading">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            <Target className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id="goals-heading" className="text-sm font-bold text-foreground">
              {t('goalsTitle')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('goalsHint')}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
            {t('primaryGoal')} <span className="text-gold">*</span>
          </p>
          <div className="flex flex-col gap-2">
            {GOALS.map((value) => (
              <ChoiceButton
                key={value}
                selected={data.primaryGoal === value}
                label={tOnb(`goals.${value}`)}
                disabled={pending}
                onClick={() => patch({ primaryGoal: value })}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
            {t('level')} <span className="text-gold">*</span>
          </p>
          <div className="flex flex-col gap-2">
            {LEVELS.map((value) => (
              <ChoiceButton
                key={value}
                selected={data.fitnessLevel === value}
                label={tOnb(`levels.${value}`)}
                hint={tOnb(`levels.${value}Hint`)}
                disabled={pending}
                onClick={() => patch({ fitnessLevel: value })}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="is-panel space-y-4 p-5" aria-labelledby="schedule-heading">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            <CalendarDays className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id="schedule-heading" className="text-sm font-bold text-foreground">
              {t('scheduleTitle')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('scheduleHint')}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
            {t('days')} <span className="text-gold">*</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <ChipButton
                key={n}
                selected={data.daysPerWeek === n}
                label={String(n)}
                disabled={pending}
                onClick={() => patch({ daysPerWeek: n })}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
            {t('duration')} <span className="text-gold">*</span>
          </p>
          <div className="flex flex-col gap-2">
            {DURATIONS.map((value) => (
              <ChoiceButton
                key={value}
                selected={data.workoutDuration === value}
                label={tOnb(`durations.${value}`)}
                disabled={pending}
                onClick={() => patch({ workoutDuration: value })}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="is-panel space-y-4 p-5" aria-labelledby="place-heading">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            <MapPin className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id="place-heading" className="text-sm font-bold text-foreground">
              {t('placeTitle')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('placeHint')}</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
            {t('location')} <span className="text-gold">*</span>
          </p>
          <div className="flex flex-col gap-2">
            {LOCATIONS.map((value) => (
              <ChoiceButton
                key={value}
                selected={data.trainingLocation === value}
                label={tOnb(`locations.${value}`)}
                disabled={pending}
                onClick={() =>
                  patch({
                    trainingLocation: value,
                    equipment: data.equipment.filter((id) =>
                      equipmentOptionsForLocation(value).includes(id),
                    ),
                  })
                }
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
            {t('equipment')}
          </p>
          <div className="flex flex-wrap gap-2">
            {equipmentOptions.map((id) => (
              <ChipButton
                key={id}
                selected={data.equipment.includes(id)}
                label={tOnb(`equipment.${id}`)}
                disabled={pending}
                onClick={() => toggleEquipment(id)}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="is-panel space-y-4 p-5" aria-labelledby="notes-heading">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            <Shield className="size-4" aria-hidden="true" />
          </span>
          <div>
            <h2 id="notes-heading" className="text-sm font-bold text-foreground">
              {t('notesTitle')}
            </h2>
            <p className="text-xs text-muted-foreground">{t('notesHint')}</p>
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">
            {t('avoid')}
          </span>
          <textarea
            value={data.avoidances}
            onChange={(e) => patch({ avoidances: e.target.value.slice(0, 500) })}
            disabled={pending}
            rows={3}
            placeholder={tOnb('step7.avoidPlaceholder')}
            className="rounded-xl border border-border bg-background/80 px-4 py-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground">
            {t('limitations')}
          </span>
          <textarea
            value={data.limitations}
            onChange={(e) => patch({ limitations: e.target.value.slice(0, 500) })}
            disabled={pending}
            rows={3}
            placeholder={tOnb('step7.limitationsPlaceholder')}
            className="rounded-xl border border-border bg-background/80 px-4 py-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          />
        </label>
      </section>

      <div className="space-y-3 pt-2">
        <button
          type="button"
          disabled={pending}
          onClick={handleSave}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-gold/45 bg-gold-tint px-4 text-xs font-bold tracking-[0.14em] text-gold transition hover:border-gold/60 hover:bg-gold/15 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          {pending ? t('saving') : t('save')}
        </button>
        <ActionFeedbackBanner error={error} success={savedMsg} />
      </div>
    </main>
  )
}
