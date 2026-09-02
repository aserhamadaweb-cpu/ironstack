import { saveCustomSplit, updateCustomSplit } from '@/lib/data/save-split'
import { getSplitDetail } from '@/lib/data/queries'
import { discardSessionAction } from '@/lib/data/session-actions'
import { buildSplitProposal, proposalToSaveInput } from '@/lib/ai/proposals'
import type { SplitProposal } from '@/lib/ai/action-types'
import {
  applyCoachSplitSafety,
  coachSplitProposalIsSaveable,
} from '@/lib/ai/split-safety'
import { getAuthIdentity } from '@/lib/supabase/server'

async function validateAndSanitizeCoachProposal(
  userId: string,
  proposal: SplitProposal,
): Promise<
  | { ok: true; proposal: SplitProposal }
  | { ok: false; error: string }
> {
  const rebuilt = buildSplitProposal({
    kind: proposal.kind,
    splitId: proposal.splitId,
    name: proposal.name,
    description: proposal.description,
    daysPerWeek: proposal.daysPerWeek,
    days: proposal.days.map((day) => ({
      name: day.name,
      subtitle: day.subtitle,
      exercises: day.exercises.map((exercise) => ({
        exercise_id: exercise.exerciseId,
        sets: exercise.sets,
        reps: exercise.reps,
      })),
    })),
    assumptions: proposal.assumptions,
    questions: proposal.questions,
    basedOn: proposal.basedOn,
  })
  if (!rebuilt.ok) return { ok: false, error: rebuilt.error }

  const safe = await applyCoachSplitSafety(rebuilt.proposal, userId)
  if (!coachSplitProposalIsSaveable(safe.proposal)) {
    return {
      ok: false,
      error:
        'This plan includes exercises that conflict with your profile. Ask Coach to revise the plan.',
    }
  }

  return { ok: true, proposal: safe.proposal }
}

export async function confirmCreateSplit(
  userId: string,
  proposal: SplitProposal,
): Promise<{ ok: true; splitId: string; href: string } | { ok: false; error: string }> {
  const { userId: authId } = await getAuthIdentity()
  if (!authId || authId !== userId) {
    return { ok: false, error: 'You must be signed in to save a split.' }
  }

  const sanitized = await validateAndSanitizeCoachProposal(userId, proposal)
  if (!sanitized.ok) return { ok: false, error: sanitized.error }

  const payload = proposalToSaveInput(sanitized.proposal)
  if ('error' in payload) return { ok: false, error: payload.error }

  const result = await saveCustomSplit(payload)
  if (result.error || !result.data) {
    return { ok: false, error: result.error ?? 'Could not save that split.' }
  }
  return {
    ok: true,
    splitId: result.data.id,
    href: `/dashboard/splits/${result.data.id}`,
  }
}

export async function confirmUpdateSplit(
  userId: string,
  proposal: SplitProposal,
): Promise<{ ok: true; splitId: string; href: string } | { ok: false; error: string }> {
  const { userId: authId } = await getAuthIdentity()
  if (!authId || authId !== userId) {
    return { ok: false, error: 'You must be signed in to edit a split.' }
  }

  const existing = await getSplitDetail(proposal.splitId)
  if (!existing.data || existing.data.user_id !== userId || existing.data.is_system) {
    return { ok: false, error: 'You can only edit your own custom splits.' }
  }

  const sanitized = await validateAndSanitizeCoachProposal(userId, proposal)
  if (!sanitized.ok) return { ok: false, error: sanitized.error }

  const payload = proposalToSaveInput(sanitized.proposal)
  if ('error' in payload) return { ok: false, error: payload.error }

  const result = await updateCustomSplit(proposal.splitId, payload)
  if (result.error || !result.data) {
    return { ok: false, error: result.error ?? 'Could not update that split.' }
  }
  return {
    ok: true,
    splitId: result.data.id,
    href: `/dashboard/splits/${result.data.id}`,
  }
}

export async function confirmDiscardSession(userId: string, sessionId: string) {
  const { userId: authId } = await getAuthIdentity()
  if (!authId || authId !== userId) {
    return { ok: false as const, error: 'You must be signed in.' }
  }
  const result = await discardSessionAction(sessionId)
  if (result.error) return { ok: false as const, error: result.error }
  return { ok: true as const }
}
