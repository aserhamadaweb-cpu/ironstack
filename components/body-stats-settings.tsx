'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { BodyWeightLog, ProfileGender } from '@/lib/database.types'
import {
  deleteBodyWeightLogAction,
  logBodyWeightAction,
  updateBodyStatsAction,
} from '@/lib/data/profile-actions'
import {
  cmToFeetInches,
  displayToKg,
  feetInchesToCm,
  formatHeightCm,
  formatWeightKg,
  isValidBirthDate,
  isValidHeightCm,
  isValidWeightKg,
  kgToDisplay,
  type WeightUnit,
} from '@/lib/units'

type BodyStatsSettingsProps = {
  preferredUnit: WeightUnit
  heightCm: number | null
  gender: ProfileGender | null
  birthDate: string | null
  currentWeightKg: number | null
  weightLogs: BodyWeightLog[]
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export function BodyStatsSettings({
  preferredUnit,
  heightCm,
  gender,
  birthDate,
  currentWeightKg,
  weightLogs,
}: BodyStatsSettingsProps) {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const imperial = preferredUnit === 'lb'
  const initialFeet = heightCm != null ? cmToFeetInches(heightCm) : { feet: 5, inches: 10 }

  const [heightCmInput, setHeightCmInput] = useState(
    heightCm != null ? String(Math.round(heightCm)) : '',
  )
  const [feetInput, setFeetInput] = useState(String(initialFeet.feet))
  const [inchesInput, setInchesInput] = useState(String(initialFeet.inches))
  const [genderValue, setGenderValue] = useState<ProfileGender | ''>(
    gender ?? '',
  )
  const [birthValue, setBirthValue] = useState(toDateInputValue(birthDate))
  const [statsMsg, setStatsMsg] = useState<string | null>(null)
  const [statsError, setStatsError] = useState<string | null>(null)

  const [weightInput, setWeightInput] = useState('')
  const [weightMsg, setWeightMsg] = useState<string | null>(null)
  const [weightError, setWeightError] = useState<string | null>(null)

  const chartData = useMemo(
    () =>
      weightLogs.map((log) => ({
        id: log.id,
        at: log.logged_at,
        label: new Date(log.logged_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
        }),
        weight: Math.round(kgToDisplay(Number(log.weight_kg), preferredUnit) * 10) / 10,
      })),
    [weightLogs, preferredUnit],
  )

  const resolveHeightCm = (): number | null => {
    if (imperial) {
      const feet = Number(feetInput)
      const inches = Number(inchesInput)
      if (!Number.isFinite(feet) || !Number.isFinite(inches)) return null
      return feetInchesToCm(feet, inches)
    }
    const cm = Number(heightCmInput)
    return Number.isFinite(cm) ? cm : null
  }

  const saveStats = () => {
    setStatsMsg(null)
    setStatsError(null)
    const cm = resolveHeightCm()
    if (cm == null || !isValidHeightCm(cm)) {
      setStatsError(t('bodyHeightInvalid'))
      return
    }
    if (genderValue !== 'male' && genderValue !== 'female') {
      setStatsError(t('bodyGenderRequired'))
      return
    }
    if (!isValidBirthDate(birthValue)) {
      setStatsError(t('bodyBirthInvalid'))
      return
    }

    startTransition(async () => {
      const result = await updateBodyStatsAction({
        height_cm: cm,
        gender: genderValue,
        birth_date: birthValue,
      })
      if (!result.ok) {
        setStatsError(result.error)
        return
      }
      setStatsMsg(t('bodyStatsSaved'))
      router.refresh()
    })
  }

  const logWeight = () => {
    setWeightMsg(null)
    setWeightError(null)
    const display = Number(weightInput)
    if (!Number.isFinite(display)) {
      setWeightError(t('bodyWeightInvalid'))
      return
    }
    const kg = displayToKg(display, preferredUnit)
    if (!isValidWeightKg(kg)) {
      setWeightError(t('bodyWeightInvalid'))
      return
    }

    startTransition(async () => {
      const result = await logBodyWeightAction(kg)
      if (!result.ok) {
        setWeightError(result.error)
        return
      }
      setWeightInput('')
      setWeightMsg(t('bodyWeightLogged'))
      router.refresh()
    })
  }

  const removeLog = (id: string) => {
    setWeightError(null)
    startTransition(async () => {
      const result = await deleteBodyWeightLogAction(id)
      if (!result.ok) {
        setWeightError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <section className="space-y-3" aria-labelledby="body-stats-heading">
      <h2
        id="body-stats-heading"
        className="text-[10px] font-semibold tracking-[0.22em] text-muted-foreground"
      >
        {t('bodyStats')}
      </h2>
      <div className="is-panel space-y-6 p-5">
        <p className="text-sm text-muted-foreground">{t('bodyStatsHint')}</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm text-foreground" htmlFor="body-height">
              {t('bodyHeight')}
            </label>
            {imperial ? (
              <div className="flex gap-2">
                <input
                  id="body-height"
                  type="number"
                  min={3}
                  max={8}
                  value={feetInput}
                  onChange={(e) => setFeetInput(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-card/90 px-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  aria-label={t('bodyFeet')}
                />
                <input
                  type="number"
                  min={0}
                  max={11}
                  value={inchesInput}
                  onChange={(e) => setInchesInput(e.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-card/90 px-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  aria-label={t('bodyInches')}
                />
              </div>
            ) : (
              <input
                id="body-height"
                type="number"
                min={100}
                max={250}
                value={heightCmInput}
                onChange={(e) => setHeightCmInput(e.target.value)}
                className="h-11 w-full rounded-xl border border-border bg-card/90 px-4 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            )}
            <p className="text-[11px] text-muted-foreground">
              {imperial ? t('bodyHeightHintFt') : t('bodyHeightHintCm')}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm text-foreground">{t('bodyGender')}</p>
            <div className="inline-flex rounded-xl border border-silver/15 p-1">
              {(['male', 'female'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={genderValue === option}
                  onClick={() => setGenderValue(option)}
                  className={`min-h-10 rounded-lg px-4 text-xs font-semibold tracking-[0.12em] transition ${
                    genderValue === option
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {option === 'male' ? t('bodyMale') : t('bodyFemale')}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm text-foreground" htmlFor="body-birth">
              {t('bodyBirthDate')}
            </label>
            <input
              id="body-birth"
              type="date"
              value={birthValue}
              onChange={(e) => setBirthValue(e.target.value)}
              className="h-11 w-full max-w-xs rounded-xl border border-border bg-card/90 px-4 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={saveStats}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-xs font-bold tracking-[0.14em] text-primary-foreground disabled:opacity-50"
        >
          {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          {t('bodySaveStats')}
        </button>
        {statsMsg && (
          <p className="text-xs text-muted-foreground" role="status">
            {statsMsg}
          </p>
        )}
        {statsError && (
          <p className="text-xs text-destructive" role="alert">
            {statsError}
          </p>
        )}

        <div className="border-t border-silver/10 pt-6">
          <p className="text-sm font-semibold text-foreground">
            {t('bodyCurrentWeight')}
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-gold">
            {formatWeightKg(currentWeightKg, preferredUnit, 1)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('bodyCurrentWeightHint')}
          </p>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="flex min-w-[8rem] flex-1 flex-col gap-2">
              <span className="text-sm text-foreground">{t('bodyLogWeight')}</span>
              <input
                type="number"
                min={0}
                step="0.1"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                placeholder={preferredUnit === 'kg' ? '75' : '165'}
                className="h-11 rounded-xl border border-border bg-card/90 px-4 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </label>
            <button
              type="button"
              disabled={pending}
              onClick={logWeight}
              className="inline-flex min-h-11 items-center rounded-full border border-gold/40 px-5 text-xs font-bold tracking-[0.14em] text-gold transition hover:bg-gold/10 disabled:opacity-50"
            >
              {t('bodyAddWeight')}
            </button>
          </div>
          {weightMsg && (
            <p className="mt-2 text-xs text-muted-foreground" role="status">
              {weightMsg}
            </p>
          )}
          {weightError && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {weightError}
            </p>
          )}
        </div>

        <div className="border-t border-silver/10 pt-6">
          <p className="text-sm font-semibold text-foreground">
            {t('bodyWeightHistory')}
          </p>
          {chartData.length >= 2 ? (
            <div className="mt-4 h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(198,40,40)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="rgb(198,40,40)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={['dataMin - 2', 'dataMax + 2']}
                    tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                    unit={` ${preferredUnit}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--card)',
                      border: '1px solid rgba(148,163,184,0.2)',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelFormatter={(label) => String(label)}
                    formatter={(value) =>
                      [`${value as number} ${preferredUnit}`, t('bodyWeight')] as [
                        string,
                        string,
                      ]
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="weight"
                    stroke="rgb(198,40,40)"
                    fill="url(#weightFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              {t('bodyWeightChartEmpty')}
            </p>
          )}

          <ul className="mt-4 max-h-56 space-y-2 overflow-y-auto">
            {[...weightLogs].reverse().map((log) => (
              <li
                key={log.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-silver/10 bg-background/40 px-3 py-2"
              >
                <div>
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {formatWeightKg(log.weight_kg, preferredUnit, 1)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(log.logged_at).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => removeLog(log.id)}
                  aria-label={t('bodyDeleteWeight')}
                  className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
            {weightLogs.length === 0 && (
              <li className="text-xs text-muted-foreground">
                {t('bodyNoWeightLogs')}
              </li>
            )}
          </ul>
        </div>

        {(heightCm != null || currentWeightKg != null) && (
          <p className="text-[11px] text-muted-foreground">
            {t('bodyPreview', {
              height: formatHeightCm(heightCm, preferredUnit),
              weight: formatWeightKg(currentWeightKg, preferredUnit, 1),
            })}
          </p>
        )}
        <span className="sr-only">{tCommon('save')}</span>
      </div>
    </section>
  )
}
