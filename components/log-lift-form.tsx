'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LIFT_OPTIONS } from '@/lib/mock-pr-data'

export type LogLiftPayload = {
  liftName: string
  weight: number
  reps: number
}

type LogLiftFormProps = {
  onSubmit: (payload: LogLiftPayload) => void
}

const inputClassName =
  'w-full rounded-xl border border-silver/15 bg-background/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-gold/40 focus:ring-2 focus:ring-gold/15'

export function LogLiftForm({ onSubmit }: LogLiftFormProps) {
  const [liftName, setLiftName] = useState<string>(LIFT_OPTIONS[0])
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('1')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    const parsedWeight = Number(weight)
    const parsedReps = Number(reps)

    if (!liftName.trim()) {
      setError('Please select a lift.')
      return
    }

    if (!parsedWeight || parsedWeight <= 0) {
      setError('Enter a valid weight greater than zero.')
      return
    }

    if (!parsedReps || parsedReps <= 0 || !Number.isInteger(parsedReps)) {
      setError('Reps must be a whole number greater than zero.')
      return
    }

    onSubmit({
      liftName: liftName.trim(),
      weight: parsedWeight,
      reps: parsedReps,
    })

    setSuccess(`${liftName} logged successfully.`)
    setWeight('')
    setReps('1')
  }

  return (
    <section className="glass-card sheen-border rounded-2xl p-6">
      <div className="mb-6">
        <p className="text-[10px] font-semibold tracking-[0.25em] text-gold">
          TRAINING LOG
        </p>
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Log a Lift
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Record your session. Data is stored locally for now.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <label
            htmlFor="liftName"
            className="text-[10px] font-semibold tracking-[0.2em] text-silver-dim"
          >
            LIFT NAME
          </label>
          <select
            id="liftName"
            value={liftName}
            onChange={(event) => setLiftName(event.target.value)}
            className={inputClassName}
          >
            {LIFT_OPTIONS.map((lift) => (
              <option key={lift} value={lift} className="bg-background">
                {lift}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label
              htmlFor="weight"
              className="text-[10px] font-semibold tracking-[0.2em] text-silver-dim"
            >
              WEIGHT (KG)
            </label>
            <input
              id="weight"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.5"
              placeholder="0"
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="reps"
              className="text-[10px] font-semibold tracking-[0.2em] text-silver-dim"
            >
              REPS
            </label>
            <input
              id="reps"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              placeholder="1"
              value={reps}
              onChange={(event) => setReps(event.target.value)}
              className={inputClassName}
            />
          </div>
        </div>

        <Button type="submit" size="lg" className="h-11 w-full tracking-[0.15em]">
          <Plus className="size-4" aria-hidden="true" />
          LOG LIFT
        </Button>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        {success && (
          <p
            role="status"
            className="rounded-xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold"
          >
            {success}
          </p>
        )}
      </form>
    </section>
  )
}
