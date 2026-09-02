import { createClient } from '@/lib/supabase/server'
import { getUserWorkoutPreferences } from '@/lib/ai/read-tools'
import { getProfile } from '@/lib/data/queries'
import { onboardingDataFromUser } from '@/lib/data/onboarding-read'
import {
  inputFromOnboardingWithDefaults,
  type RecommendationInput,
} from '@/lib/split-recommendations/types'

export async function getCustomSplitSlots(userId: string) {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('splits')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_system', false)

  if (error) return { used: 0, max: 3, remaining: 3 }
  const used = count ?? 0
  const max = 3
  return { used, max, remaining: Math.max(0, max - used) }
}

export async function loadSplitBuildContext(userId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [preferences, slots, profileResult] = await Promise.all([
    getUserWorkoutPreferences(userId),
    getCustomSplitSlots(userId),
    user ? getProfile(userId) : Promise.resolve({ data: null }),
  ])

  const profileInput =
    user && user.id === userId
      ? inputFromOnboardingWithDefaults(
          onboardingDataFromUser(user, profileResult.data ?? undefined),
        )
      : null

  return { preferences, slots, profileInput }
}

function formatProfileInputForPrompt(input: RecommendationInput): string {
  const equipment =
    input.equipment.length > 0 ? input.equipment.join(', ') : 'full gym access'
  const lines = [
    'Profile defaults (use when the athlete did not specify otherwise):',
    `- Goal: ${input.primaryGoal}, level: ${input.fitnessLevel}`,
    `- Schedule: ${input.daysPerWeek} days/week, ${input.workoutDuration.replace(/_/g, ' ')} sessions`,
    `- Location: ${input.trainingLocation}, equipment: ${equipment}`,
  ]
  if (input.avoidances.trim()) {
    lines.push(`- Avoid: ${input.avoidances.trim()}`)
  }
  if (input.limitations.trim()) {
    lines.push(`- Limitations: ${input.limitations.trim()}`)
  }
  if (input.favoriteMuscleGroups.length > 0) {
    lines.push(`- Favorite muscles: ${input.favoriteMuscleGroups.join(', ')}`)
  }
  return lines.join('\n')
}

export function formatSplitContextForPrompt(
  preferences: Awaited<ReturnType<typeof getUserWorkoutPreferences>>,
  slots: Awaited<ReturnType<typeof getCustomSplitSlots>>,
  profileInput?: RecommendationInput | null,
): string {
  const lines = [
    'Split-building context (pre-loaded for this turn — skip get_user_workout_preferences and get_user_splits unless editing a specific split id):',
    `Custom split slots: ${slots.used}/${slots.max} used${slots.remaining === 0 ? ' (full — tell them to delete one first; do not call propose_split)' : ''}.`,
  ]

  if (profileInput) {
    lines.push(formatProfileInputForPrompt(profileInput))
  }

  if ('error' in preferences) {
    lines.push('Could not load preferences — use standard exercise names in propose_split.')
    return lines.join('\n')
  }

  if (preferences.has_best_exercises) {
    lines.push('Mapped lifts (prefer these when relevant):')
    for (const row of preferences.personal_records.slice(0, 8)) {
      if (row.catalog_id) {
        lines.push(`- ${row.name} (${row.catalog_id})`)
      }
    }
    for (const row of preferences.frequently_logged.slice(0, 6)) {
      if (row.catalog_id) {
        lines.push(`- ${row.name} (${row.catalog_id}, logged ${row.count}x)`)
      }
    }
  } else {
    lines.push(
      'No PR/history mapped to catalog yet — still call propose_split using profile defaults above and standard exercise names; ask at most one short clarifying question only if days or equipment are truly unknown.',
    )
  }

  if (preferences.notes?.length) {
    lines.push(
      `Constraints: ${preferences.notes.map((n) => n.fact).join('; ')}`,
    )
  }

  return lines.join('\n')
}
