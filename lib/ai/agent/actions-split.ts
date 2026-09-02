import type { SplitProposal } from '@/lib/ai/action-types'
import { proposalToSaveInput } from '@/lib/ai/proposals'
import { ownedSplitToProposal } from '@/lib/ai/read-tools'
import { getSplitDetail } from '@/lib/data/queries'
import {
  deleteCustomSplit,
  saveCustomSplit,
  saveRecommendedSplit,
  setSplitShared,
} from '@/lib/data/save-split'
import { createClient } from '@/lib/supabase/server'
import {
  defineAgentAction,
  fail,
  type AnyAgentAction,
  type JsonValue,
} from '@/lib/ai/agent/types'

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/**
 * Re-create a split from a snapshot taken before deletion. Reuses the same
 * split id so links and history references still resolve.
 */
async function restoreSplitFromSnapshot(
  snapshot: JsonValue,
): Promise<{ ok: true; splitId: string } | { ok: false; error: string }> {
  const proposal = snapshot as unknown as SplitProposal | null
  if (!proposal || !Array.isArray(proposal.days) || proposal.days.length === 0) {
    return { ok: false, error: 'No saved copy of that split to restore.' }
  }
  const payload = proposalToSaveInput(proposal)
  if ('error' in payload) return { ok: false, error: payload.error }

  const result = await saveCustomSplit(payload)
  if (result.error || !result.data) {
    return { ok: false, error: result.error ?? 'Could not restore that split.' }
  }
  return { ok: true, splitId: result.data.id }
}

const deleteSplit = defineAgentAction<{ splitId: string; name: string }>({
  name: 'delete_split',
  domain: 'split',
  async prepare(ctx, raw) {
    const splitId = asString(raw.split_id) || asString(raw.splitId)
    if (!splitId) return fail('Which split should I delete?')

    // Snapshot the full program so Undo can rebuild it exactly.
    const snapshot = await ownedSplitToProposal(ctx.userId, splitId)
    if (!snapshot.ok) return fail(snapshot.error)

    const exerciseCount = snapshot.proposal.days.reduce(
      (total, day) => total + day.exercises.length,
      0,
    )

    return {
      ok: true,
      args: { splitId, name: snapshot.proposal.name },
      before: snapshot.proposal as unknown as JsonValue,
      preview: {
        title: `Delete "${snapshot.proposal.name}"`,
        changes: [
          `Removes the split and all ${snapshot.proposal.days.length} of its days`,
          `${exerciseCount} exercise ${exerciseCount === 1 ? 'entry' : 'entries'} go with it`,
          'Completed workout history stays — only the program is removed',
        ],
        warning:
          'Undo rebuilds the program from a snapshot taken right now, so confirm only if you are sure.',
        undoable: true,
        confirmLabel: 'Delete split',
        destructive: true,
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await deleteCustomSplit(prepared.args.splitId)
    if (result.error) return fail(result.error)
    return {
      ok: true,
      summary: `Deleted the split "${prepared.args.name}"`,
      after: null,
    }
  },
  async undo(_ctx, input) {
    const restored = await restoreSplitFromSnapshot(input.before)
    if (!restored.ok) return fail(restored.error)
    return {
      ok: true,
      summary: 'Restored the deleted split',
      after: { splitId: restored.splitId },
      href: `/dashboard/splits/${restored.splitId}`,
    }
  },
})

const setSplitSharing = defineAgentAction<{
  splitId: string
  name: string
  isShared: boolean
}>({
  name: 'set_split_sharing',
  domain: 'split',
  affectsOthers: true,
  async prepare(ctx, raw) {
    const splitId = asString(raw.split_id) || asString(raw.splitId)
    if (!splitId) return fail('Which split should I change sharing for?')
    const isShared =
      typeof raw.is_shared === 'boolean'
        ? raw.is_shared
        : typeof raw.isShared === 'boolean'
          ? raw.isShared
          : null
    if (isShared === null) {
      return fail('Should the split be shared publicly, or made private?')
    }

    const detail = await getSplitDetail(splitId)
    if (!detail.data) return fail('That split was not found.')
    if (detail.data.user_id !== ctx.userId || detail.data.is_system) {
      return fail('You can only change sharing on your own custom splits.')
    }
    if (detail.data.is_shared === isShared) {
      return fail(
        isShared
          ? `"${detail.data.name}" is already shared.`
          : `"${detail.data.name}" is already private.`,
      )
    }

    return {
      ok: true,
      args: { splitId, name: detail.data.name, isShared },
      before: { isShared: detail.data.is_shared },
      preview: {
        title: isShared
          ? `Share "${detail.data.name}" publicly`
          : `Make "${detail.data.name}" private`,
        changes: isShared
          ? [
              'Any IronStack athlete will be able to find this split',
              'They can save their own copy of it',
              'Your logged sets and weights are not shared — only the program',
            ]
          : [
              'Removes the split from public discovery',
              'Copies other athletes already saved stay with them',
            ],
        warning: isShared
          ? 'This changes who can see the program. It is reversible at any time.'
          : undefined,
        undoable: true,
        confirmLabel: isShared ? 'Share split' : 'Make private',
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await setSplitShared(prepared.args.splitId, prepared.args.isShared)
    if (result.error) return fail(result.error)
    return {
      ok: true,
      summary: prepared.args.isShared
        ? `Shared "${prepared.args.name}" publicly`
        : `Made "${prepared.args.name}" private`,
      after: { isShared: prepared.args.isShared },
      href: `/dashboard/splits/${prepared.args.splitId}`,
    }
  },
  async undo(_ctx, input) {
    const splitId = asString(input.args.splitId)
    const previous = (input.before as { isShared?: boolean } | null)?.isShared
    if (!splitId || typeof previous !== 'boolean') {
      return fail('Could not work out the previous sharing state.')
    }
    const result = await setSplitShared(splitId, previous)
    if (result.error) return fail(result.error)
    return {
      ok: true,
      summary: previous
        ? 'Restored public sharing on the split'
        : 'Made the split private again',
      after: { isShared: previous },
    }
  },
})

const saveRecommended = defineAgentAction<{ sourceSplitId: string; name: string }>({
  name: 'save_recommended_split',
  domain: 'split',
  async prepare(ctx, raw) {
    const sourceSplitId =
      asString(raw.source_split_id) || asString(raw.sourceSplitId)
    if (!sourceSplitId) return fail('Which recommended split should I save?')

    const detail = await getSplitDetail(sourceSplitId)
    if (!detail.data) return fail('That split was not found.')
    if (!detail.data.is_system && !detail.data.is_shared) {
      return fail('That split is not available to copy.')
    }

    const supabase = await createClient()
    const { count } = await supabase
      .from('splits')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.userId)
      .eq('is_system', false)

    return {
      ok: true,
      args: { sourceSplitId, name: detail.data.name },
      before: { existingCustomSplits: count ?? 0 },
      preview: {
        title: `Save "${detail.data.name}" to your splits`,
        changes: [
          `Copies all ${detail.data.days_per_week} training days into your own library`,
          'You can edit your copy without affecting the original',
        ],
        undoable: true,
        confirmLabel: 'Save split',
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await saveRecommendedSplit(prepared.args.sourceSplitId)
    if (result.error || !result.data) {
      const message = result.error ?? 'Could not save that split.'
      return fail(
        message,
        message.includes('custom splits') ? 'split_limit_reached' : undefined,
      )
    }
    return {
      ok: true,
      summary: `Saved "${prepared.args.name}" to your splits`,
      after: { splitId: result.data.id },
      href: `/dashboard/splits/${result.data.id}`,
    }
  },
  async undo(_ctx, input) {
    const splitId = asString((input.after as { splitId?: string } | null)?.splitId)
    if (!splitId) return fail('Could not find the saved copy to remove.')
    const result = await deleteCustomSplit(splitId)
    if (result.error) return fail(result.error)
    return { ok: true, summary: 'Removed the saved copy', after: null }
  },
})

export const SPLIT_AGENT_ACTIONS: AnyAgentAction[] = [
  deleteSplit,
  setSplitSharing,
  saveRecommended,
]
