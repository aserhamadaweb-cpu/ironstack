'use server'

/**
 * Client entry points for proactive suggestions.
 *
 * Nothing here executes an action. Acting on a suggestion means sending its
 * `prompt` as a normal chat message, which lands back in the ordinary
 * propose -> confirm -> audit flow.
 */

import {
  countNewSuggestions,
  listLiveSuggestions,
  markSuggestionsSeen,
  refreshSuggestions,
  resolveSuggestion,
  type CoachSuggestion,
} from '@/lib/ai/suggestions'
import { createClient } from '@/lib/supabase/server'
import { rejectIfGuest } from '@/lib/data/guest-guard'

async function currentUserId(): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user?.id ?? null
}

export async function getSuggestionsAction(): Promise<{
  suggestions: CoachSuggestion[]
  newCount: number
}> {
  const guest = await rejectIfGuest()
  if (guest) return { suggestions: [], newCount: 0 }

  const userId = await currentUserId()
  if (!userId) return { suggestions: [], newCount: 0 }

  const suggestions = await refreshSuggestions(userId)
  return {
    suggestions,
    newCount: suggestions.filter((item) => item.status === 'new').length,
  }
}

/** Badge-only read. Deliberately does not run the rules. */
export async function getSuggestionBadgeAction(): Promise<{ newCount: number }> {
  const userId = await currentUserId()
  if (!userId) return { newCount: 0 }
  return { newCount: await countNewSuggestions(userId) }
}

export async function markSuggestionsSeenAction(): Promise<{ ok: true }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: true }

  const userId = await currentUserId()
  if (userId) await markSuggestionsSeen(userId)
  return { ok: true }
}

export async function dismissSuggestionAction(
  suggestionId: string,
): Promise<{ ok: boolean; suggestions: CoachSuggestion[] }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, suggestions: [] }

  const userId = await currentUserId()
  if (!userId) return { ok: false, suggestions: [] }

  const ok = await resolveSuggestion(userId, suggestionId, 'dismissed')
  return { ok, suggestions: await listLiveSuggestions(userId) }
}

/**
 * Marks a suggestion as acted on. Called when the athlete taps "Ask about
 * this" — it records intent only; the chat turn still has to propose and be
 * confirmed like any other request.
 */
export async function actOnSuggestionAction(
  suggestionId: string,
): Promise<{ ok: boolean }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false }

  const userId = await currentUserId()
  if (!userId) return { ok: false }
  return { ok: await resolveSuggestion(userId, suggestionId, 'acted') }
}
