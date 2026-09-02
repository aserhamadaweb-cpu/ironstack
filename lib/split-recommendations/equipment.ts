import type { EquipmentId, TrainingLocation } from '@/lib/onboarding-types'

/** Catalog `equipment` field values allowed for this user. */
const GYM_EQUIPMENT = new Set([
  'barbell',
  'olympic barbell',
  'ez barbell',
  'trap bar',
  'dumbbell',
  'kettlebell',
  'cable',
  'leverage machine',
  'smith machine',
  'sled machine',
  'assisted',
  'body weight',
  'weighted',
  'band',
  'resistance band',
  'medicine ball',
  'stability ball',
  'rope',
])

const HOME_KIT: Record<EquipmentId, readonly string[]> = {
  bodyweight: ['body weight', 'weighted'],
  dumbbells: ['dumbbell'],
  bands: ['band', 'resistance band'],
  kettlebells: ['kettlebell'],
  bench: ['body weight', 'dumbbell'],
  pullup_bar: ['body weight'],
  barbell: ['barbell', 'olympic barbell', 'ez barbell'],
  machines: [],
  other: ['medicine ball', 'stability ball', 'rope'],
}

export function resolveAllowedEquipment(
  location: TrainingLocation,
  selected: EquipmentId[],
): Set<string> {
  if (location === 'gym') {
    return GYM_EQUIPMENT
  }

  const allowed = new Set<string>(['body weight'])
  const picks = selected.length > 0 ? selected : (['bodyweight', 'dumbbells'] as EquipmentId[])

  for (const id of picks) {
    for (const eq of HOME_KIT[id] ?? []) {
      allowed.add(eq)
    }
  }

  if (location === 'both') {
    for (const eq of GYM_EQUIPMENT) {
      allowed.add(eq)
    }
  }

  return allowed
}

export function hasBarbell(allowed: Set<string>): boolean {
  return (
    allowed.has('barbell') ||
    allowed.has('olympic barbell') ||
    allowed.has('ez barbell') ||
    allowed.has('trap bar')
  )
}

export function hasPullupBar(selected: EquipmentId[], location: TrainingLocation): boolean {
  if (location === 'gym' || location === 'both') return true
  return selected.includes('pullup_bar')
}
