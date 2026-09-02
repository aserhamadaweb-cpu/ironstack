'use server'

import { revalidatePath } from 'next/cache'
import { createClient, getAuthIdentity } from '@/lib/supabase/server'
import { rejectIfGuest } from '@/lib/data/guest-guard'
import { saveCustomSplit, type SaveSplitInput } from '@/lib/data/save-split'
import {
  resolveSplitRecommendations,
  resolveSplitRecommendationsForAction,
} from '@/lib/data/split-recommendations-server'
import { buildCustomSplitFromPrompt } from '@/lib/split-recommendations/custom-from-prompt'
import type { SplitRecommendation } from '@/lib/split-recommendations'
import type { OnboardingData } from '@/lib/onboarding-types'

export type SplitRecommendationStatus = 'pending' | 'skipped' | 'selected'

export type GenerateRecommendationsResult =
  | { data: SplitRecommendation[]; fingerprint: string | null; error: null }
  | { data: null; fingerprint: string | null; error: string }

function recommendationToSaveInput(rec: SplitRecommendation): SaveSplitInput {
  return {
    name: rec.name,
    description: rec.rationale.slice(0, 500),
    category: 'Hypertrophy',
    daysPerWeek: rec.daysPerWeek,
    days: rec.schedule.map((day) => ({
      name: day.name,
      subtitle: day.subtitle,
      exercises: day.exercises.map((ex) => ({
        libraryId: ex.libraryId,
        name: ex.name,
        muscles: ex.muscles,
        image: ex.image,
        sets: ex.sets,
        reps: ex.reps,
        category: ex.category,
      })),
    })),
  }
}

async function setRecommendationStatus(
  status: SplitRecommendationStatus,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase.auth.updateUser({
    data: { split_recommendation_status: status },
  })
  if (error) return { ok: false, error: 'Could not save preference.' }
  return { ok: true }
}

export async function setPrimarySplitAction(
  splitId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  const { userId } = await getAuthIdentity()
  if (!userId) return { ok: false, error: 'Not signed in.' }

  const id = splitId.trim()
  if (!id) return { ok: false, error: 'Missing split id.' }

  const supabase = await createClient()
  const { data: owned } = await supabase
    .from('splits')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!owned?.id) {
    return { ok: false, error: 'That split was not found on your account.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      primary_split_id: id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) {
    return { ok: false, error: 'Could not set primary program.' }
  }

  revalidatePath('/dashboard/splits')
  revalidatePath('/dashboard/workout')
  revalidatePath('/dashboard/home')
  return { ok: true }
}

export async function generateSplitRecommendationsAction(
  override?: Partial<OnboardingData>,
): Promise<GenerateRecommendationsResult> {
  const guest = await rejectIfGuest()
  if (guest) return { data: null, fingerprint: null, error: guest }

  return resolveSplitRecommendationsForAction(override)
}

export async function applySplitRecommendationAction(
  recommendation: SplitRecommendation,
): Promise<
  | { data: { splitId: string }; error: null }
  | { data: null; error: string }
> {
  const guest = await rejectIfGuest()
  if (guest) return { data: null, error: guest }

  const { userId } = await getAuthIdentity()
  if (!userId) return { data: null, error: 'Not signed in.' }

  const saved = await saveCustomSplit(recommendationToSaveInput(recommendation))
  if (saved.error || !saved.data?.id) {
    return { data: null, error: saved.error ?? 'Could not save program.' }
  }

  const primary = await setPrimarySplitAction(saved.data.id)
  if (!primary.ok) {
    return { data: null, error: primary.error }
  }

  await setRecommendationStatus('selected')
  revalidatePath('/dashboard/splits/recommendations')
  return { data: { splitId: saved.data.id }, error: null }
}

export async function skipSplitRecommendationAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  return setRecommendationStatus('skipped')
}

export type GenerateCustomSplitResult =
  | { data: SplitRecommendation; warnings: string[]; error: null }
  | { data: null; warnings: string[]; error: string }

export async function generateCustomSplitFromPromptAction(
  prompt: string,
): Promise<GenerateCustomSplitResult> {
  const guest = await rejectIfGuest()
  if (guest) return { data: null, warnings: [], error: guest }

  const bundle = await resolveSplitRecommendations()
  if (bundle.error || !bundle.input) {
    return {
      data: null,
      warnings: [],
      error: bundle.error ?? 'Complete your fitness profile to build a custom program.',
    }
  }

  const result = await buildCustomSplitFromPrompt(prompt, bundle.input)
  if ('error' in result) {
    return { data: null, warnings: [], error: result.error }
  }

  return {
    data: result.recommendation,
    warnings: result.warnings,
    error: null,
  }
}
