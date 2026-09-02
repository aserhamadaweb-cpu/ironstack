import type { ProfileGender } from '@/lib/database.types'
import {
  deleteBodyWeightLogAction,
  logBodyWeightAction,
  updateBodyStatsAction,
} from '@/lib/data/profile-actions'
import { createClient } from '@/lib/supabase/server'
import {
  displayToKg,
  isValidBirthDate,
  isValidHeightCm,
  isValidWeightKg,
} from '@/lib/units'
import {
  defineAgentAction,
  fail,
  type AnyAgentAction,
} from '@/lib/ai/agent/types'

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim()) return Number(value)
  return Number.NaN
}

const logWeight = defineAgentAction<{ weightKg: number; entered: string }>({
  name: 'log_body_weight',
  domain: 'body',
  async prepare(ctx, raw) {
    // Accept either model-shaped args ({ weight, unit }) or a prior prepared
    // payload ({ weightKg }) so confirm re-prepare cannot strand the card.
    const existingKg = asNumber(raw.weightKg)
    if (Number.isFinite(existingKg) && isValidWeightKg(existingKg)) {
      const entered =
        asString(raw.entered) || `${existingKg} kg`
      return {
        ok: true,
        args: { weightKg: existingKg, entered },
        before: null,
        preview: {
          title: `Log body weight: ${entered}`,
          changes: [`Adds a new body weight entry of ${entered}, dated today`],
          undoable: true,
          confirmLabel: 'Log weight',
        },
      }
    }

    const rawWeight = asNumber(raw.weight)
    if (!Number.isFinite(rawWeight)) {
      return fail('What weight should I log?')
    }
    const unit = asString(raw.unit).toLowerCase() === 'lb' ? 'lb' : 'kg'
    const weightKg = Math.round(displayToKg(rawWeight, unit) * 100) / 100

    if (!isValidWeightKg(weightKg)) {
      return fail('Body weight has to be between 30 and 300 kg.')
    }

    const supabase = await createClient()
    const { data: previous } = await supabase
      .from('body_weight_logs')
      .select('id, weight_kg, logged_at')
      .eq('user_id', ctx.userId)
      .order('logged_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const entered = unit === 'lb' ? `${rawWeight} lb` : `${rawWeight} kg`
    const changes = [`Adds a new body weight entry of ${entered}, dated today`]
    if (previous) {
      const delta = weightKg - Number(previous.weight_kg)
      const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'level with'
      changes.push(
        `Your last entry was ${previous.weight_kg} kg — this is ${direction}${
          delta === 0 ? '' : ` ${Math.abs(Math.round(delta * 10) / 10)} kg`
        }`,
      )
    }

    return {
      ok: true,
      args: { weightKg, entered },
      before: previous
        ? { lastLogId: previous.id, lastWeightKg: Number(previous.weight_kg) }
        : null,
      preview: {
        title: `Log body weight: ${entered}`,
        changes,
        undoable: true,
        confirmLabel: 'Log weight',
      },
    }
  },
  async execute(ctx, prepared) {
    const result = await logBodyWeightAction(prepared.args.weightKg)
    if (!result.ok) return fail(result.error)

    // The action does not return the new row id — read it back so Undo has a
    // precise target instead of deleting whatever is newest at undo time.
    const supabase = await createClient()
    const { data: created } = await supabase
      .from('body_weight_logs')
      .select('id, weight_kg, logged_at')
      .eq('user_id', ctx.userId)
      .order('logged_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    return {
      ok: true,
      summary: `Logged body weight ${prepared.args.entered}`,
      after: created ? { logId: created.id, weightKg: prepared.args.weightKg } : null,
      href: '/dashboard/profile',
    }
  },
  async undo(_ctx, input) {
    const logId = asString((input.after as { logId?: string } | null)?.logId)
    if (!logId) return fail('Could not find that weight entry to remove.')
    const result = await deleteBodyWeightLogAction(logId)
    if (!result.ok) return fail(result.error)
    return { ok: true, summary: 'Removed the logged body weight entry', after: null }
  },
})

const deleteWeightLog = defineAgentAction<{ logId: string; label: string }>({
  name: 'delete_body_weight_log',
  domain: 'body',
  async prepare(ctx, raw) {
    const logId = asString(raw.log_id) || asString(raw.logId)
    if (!logId) return fail('Which weight entry should I remove?')

    const supabase = await createClient()
    const { data: row } = await supabase
      .from('body_weight_logs')
      .select('id, weight_kg, logged_at')
      .eq('id', logId)
      .eq('user_id', ctx.userId)
      .maybeSingle()

    if (!row) return fail('That weight entry was not found.')

    const date = new Date(row.logged_at).toISOString().slice(0, 10)
    const label = `${row.weight_kg} kg from ${date}`

    return {
      ok: true,
      args: { logId, label },
      before: { weightKg: Number(row.weight_kg), loggedAt: row.logged_at },
      preview: {
        title: `Remove weight entry: ${label}`,
        changes: [
          `Deletes the ${label} entry`,
          'Your other weight history is untouched',
        ],
        warning:
          'Undo re-logs the same weight, but it gets a fresh timestamp rather than the original one.',
        undoable: true,
        confirmLabel: 'Remove entry',
        destructive: true,
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await deleteBodyWeightLogAction(prepared.args.logId)
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: `Removed weight entry (${prepared.args.label})`,
      after: null,
    }
  },
  async undo(_ctx, input) {
    const weightKg = asNumber((input.before as { weightKg?: number } | null)?.weightKg)
    if (!Number.isFinite(weightKg)) {
      return fail('Could not recover the original weight value.')
    }
    const result = await logBodyWeightAction(weightKg)
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: `Re-logged ${weightKg} kg (original timestamp could not be restored)`,
      after: { weightKg },
    }
  },
})

const updateStats = defineAgentAction<{
  heightCm: number
  gender: ProfileGender
  birthDate: string
  changed: string[]
}>({
  name: 'update_body_stats',
  domain: 'body',
  async prepare(ctx, raw) {
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('height_cm, gender, birth_date')
      .eq('id', ctx.userId)
      .maybeSingle()

    if (!profile) return fail('Could not load your profile.')

    // Partial updates are merged over current values — the underlying action
    // requires all three fields.
    const rawHeight = asNumber(
      raw.height_cm !== undefined ? raw.height_cm : raw.heightCm,
    )
    const heightCm = Number.isFinite(rawHeight)
      ? Math.round(rawHeight * 10) / 10
      : Number(profile.height_cm)
    const rawGender = asString(raw.gender).toLowerCase()
    const gender = (
      rawGender === 'male' || rawGender === 'female' ? rawGender : profile.gender
    ) as ProfileGender | null
    const birthDate =
      asString(raw.birth_date) ||
      asString(raw.birthDate) ||
      (profile.birth_date ?? '')

    if (!isValidHeightCm(heightCm)) {
      return fail('Height has to be between 100 and 250 cm.')
    }
    if (gender !== 'male' && gender !== 'female') {
      return fail('I need to know whether to record male or female.')
    }
    if (!isValidBirthDate(birthDate)) {
      return fail('Birth date has to work out to an age between 10 and 100.')
    }

    const changes: string[] = []
    if (heightCm !== Number(profile.height_cm)) {
      changes.push(`Height: ${profile.height_cm ?? 'not set'} cm to ${heightCm} cm`)
    }
    if (gender !== profile.gender) {
      changes.push(`Sex: ${profile.gender ?? 'not set'} to ${gender}`)
    }
    if (birthDate !== profile.birth_date) {
      changes.push(`Birth date: ${profile.birth_date ?? 'not set'} to ${birthDate}`)
    }
    if (changes.length === 0) {
      return fail('Those body stats already match what is saved.')
    }

    return {
      ok: true,
      args: { heightCm, gender, birthDate, changed: changes },
      before: {
        heightCm: profile.height_cm,
        gender: profile.gender,
        birthDate: profile.birth_date,
      },
      preview: {
        title: 'Update your body stats',
        changes: [
          ...changes,
          'These feed BMI and age-based calculations across the app',
        ],
        undoable: true,
        confirmLabel: 'Update stats',
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await updateBodyStatsAction({
      height_cm: prepared.args.heightCm,
      gender: prepared.args.gender,
      birth_date: prepared.args.birthDate,
    })
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: `Updated body stats (${prepared.args.changed.join('; ')})`,
      after: {
        heightCm: prepared.args.heightCm,
        gender: prepared.args.gender,
        birthDate: prepared.args.birthDate,
      },
      href: '/dashboard/settings',
    }
  },
  async undo(_ctx, input) {
    const before = input.before as {
      heightCm?: number | null
      gender?: string | null
      birthDate?: string | null
    } | null
    if (
      !before ||
      !Number.isFinite(Number(before.heightCm)) ||
      (before.gender !== 'male' && before.gender !== 'female') ||
      !before.birthDate
    ) {
      return fail(
        'Your earlier body stats were incomplete, so they cannot be restored automatically.',
      )
    }
    const result = await updateBodyStatsAction({
      height_cm: Number(before.heightCm),
      gender: before.gender,
      birth_date: before.birthDate,
    })
    if (!result.ok) return fail(result.error)
    return { ok: true, summary: 'Restored your previous body stats', after: before }
  },
})

export const BODY_AGENT_ACTIONS: AnyAgentAction[] = [
  logWeight,
  deleteWeightLog,
  updateStats,
]
