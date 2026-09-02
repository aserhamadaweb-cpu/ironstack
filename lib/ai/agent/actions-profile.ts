import { AVATAR_PRESETS, isAvatarPresetPath } from '@/lib/avatar-presets'
import { removeAvatarAction, updateProfileAction } from '@/lib/data/profile-actions'
import { deactivateMemory, getActiveMemories } from '@/lib/ai/memory'
import { createClient } from '@/lib/supabase/server'
import {
  defineAgentAction,
  fail,
  type AnyAgentAction,
  type JsonValue,
} from '@/lib/ai/agent/types'

const BIO_MAX = 160

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

type ProfileSnapshot = {
  username: string
  displayName: string
  bio: string
  avatarUrl: string | null
}

async function loadProfileSnapshot(
  userId: string,
): Promise<ProfileSnapshot | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('username, display_name, bio, avatar_url')
    .eq('id', userId)
    .maybeSingle()
  if (!data?.username) return null
  return {
    username: data.username,
    displayName: data.display_name ?? '',
    bio: data.bio ?? '',
    avatarUrl: data.avatar_url ?? null,
  }
}

/**
 * Writes profile presentation fields while pinning `username` to its current
 * value. Username changes are capped at two per lifetime and are deliberately
 * outside the coach's reach.
 */
async function writeProfile(
  current: ProfileSnapshot,
  patch: Partial<Pick<ProfileSnapshot, 'displayName' | 'bio' | 'avatarUrl'>>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await updateProfileAction({
    username: current.username,
    displayName: patch.displayName ?? current.displayName,
    bio: patch.bio ?? current.bio,
    avatarUrl:
      patch.avatarUrl !== undefined ? patch.avatarUrl : current.avatarUrl,
  })
  if (result.ok) return { ok: true }
  const errors = result.errors
  return {
    ok: false,
    error:
      errors.displayName ??
      errors.bio ??
      errors.avatar ??
      errors.username ??
      errors.form ??
      'Could not update your profile.',
  }
}

const updateDetails = defineAgentAction<{
  displayName: string
  bio: string
  changed: string[]
}>({
  name: 'update_profile_details',
  domain: 'profile',
  async prepare(ctx, raw) {
    const current = await loadProfileSnapshot(ctx.userId)
    if (!current) {
      return fail('Set a username in your profile before I can edit it.')
    }

    const hasDisplayName = typeof raw.display_name === 'string'
    const hasBio = typeof raw.bio === 'string'
    if (!hasDisplayName && !hasBio) {
      return fail('What should I set — your display name, your bio, or both?')
    }

    const displayName = hasDisplayName
      ? asString(raw.display_name)
      : current.displayName
    const bio = hasBio ? asString(raw.bio) : current.bio

    if (!displayName || displayName.length > 60) {
      return fail('Display name is required and must be 60 characters or fewer.')
    }
    if (bio.length > BIO_MAX) {
      return fail(`Bio must be ${BIO_MAX} characters or fewer.`)
    }

    const changed: string[] = []
    if (displayName !== current.displayName) {
      changed.push(`Display name: "${current.displayName}" to "${displayName}"`)
    }
    if (bio !== current.bio) {
      changed.push(
        current.bio
          ? `Bio: "${current.bio}" to "${bio || '(empty)'}"`
          : `Bio set to "${bio}"`,
      )
    }
    if (changed.length === 0) {
      return fail('Your profile already says exactly that.')
    }

    return {
      ok: true,
      args: { displayName, bio, changed },
      before: current as unknown as JsonValue,
      preview: {
        title: 'Update your profile',
        changes: [
          ...changed,
          'Your username stays the same — I cannot change that',
        ],
        undoable: true,
        confirmLabel: 'Update profile',
      },
    }
  },
  async execute(ctx, prepared) {
    const current = await loadProfileSnapshot(ctx.userId)
    if (!current) return fail('Could not load your profile.')
    const result = await writeProfile(current, {
      displayName: prepared.args.displayName,
      bio: prepared.args.bio,
    })
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: `Updated profile (${prepared.args.changed.join('; ')})`,
      after: {
        displayName: prepared.args.displayName,
        bio: prepared.args.bio,
      },
      href: '/dashboard/profile',
    }
  },
  async undo(ctx, input) {
    const before = input.before as ProfileSnapshot | null
    const current = await loadProfileSnapshot(ctx.userId)
    if (!before || !current) return fail('Could not restore your previous profile.')
    const result = await writeProfile(current, {
      displayName: before.displayName,
      bio: before.bio,
    })
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: 'Restored your previous display name and bio',
      after: before as unknown as JsonValue,
    }
  },
})

const setAvatarPreset = defineAgentAction<{ path: string; label: string }>({
  name: 'set_avatar_preset',
  domain: 'profile',
  async prepare(ctx, raw) {
    const current = await loadProfileSnapshot(ctx.userId)
    if (!current) {
      return fail('Set a username in your profile before I can edit it.')
    }

    const requested = asString(raw.preset).toLowerCase()
    if (!requested) {
      return fail(
        `Which avatar? Options: ${AVATAR_PRESETS.map((p) => p.label).join(', ')}.`,
      )
    }
    const preset = AVATAR_PRESETS.find(
      (candidate) =>
        candidate.id === requested ||
        candidate.label.toLowerCase() === requested ||
        candidate.path === asString(raw.preset),
    )
    if (!preset) {
      return fail(
        `I do not have that avatar. Options: ${AVATAR_PRESETS.map((p) => p.label).join(', ')}.`,
      )
    }
    if (current.avatarUrl === preset.path) {
      return fail(`You are already using the ${preset.label} avatar.`)
    }

    const hadUpload =
      Boolean(current.avatarUrl) && !isAvatarPresetPath(current.avatarUrl)

    return {
      ok: true,
      args: { path: preset.path, label: preset.label },
      before: { avatarUrl: current.avatarUrl },
      preview: {
        title: `Set your avatar to ${preset.label}`,
        changes: [
          `Uses the ${preset.label} preset as your profile picture`,
          hadUpload
            ? 'Replaces your uploaded photo'
            : 'Replaces your current preset',
        ],
        warning: hadUpload
          ? 'Your uploaded photo is deleted from storage and cannot be recovered by Undo.'
          : undefined,
        undoable: !hadUpload,
        confirmLabel: 'Set avatar',
      },
    }
  },
  async execute(ctx, prepared) {
    const current = await loadProfileSnapshot(ctx.userId)
    if (!current) return fail('Could not load your profile.')
    const result = await writeProfile(current, { avatarUrl: prepared.args.path })
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: `Set profile avatar to the ${prepared.args.label} preset`,
      after: { avatarUrl: prepared.args.path },
      href: '/dashboard/profile',
    }
  },
  async undo(ctx, input) {
    const previous = (input.before as { avatarUrl?: string | null } | null)
      ?.avatarUrl
    const current = await loadProfileSnapshot(ctx.userId)
    if (!current) return fail('Could not load your profile.')
    if (previous && !isAvatarPresetPath(previous)) {
      return fail('Your previous uploaded photo was deleted and cannot be restored.')
    }
    const result = await writeProfile(current, { avatarUrl: previous ?? null })
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: previous
        ? 'Restored your previous avatar preset'
        : 'Removed the avatar again',
      after: { avatarUrl: previous ?? null },
    }
  },
})

const removeAvatar = defineAgentAction<Record<string, never>>({
  name: 'remove_avatar',
  domain: 'profile',
  async prepare(ctx) {
    const current = await loadProfileSnapshot(ctx.userId)
    if (!current) return fail('Could not load your profile.')
    if (!current.avatarUrl) {
      return fail('You do not have a profile picture set.')
    }
    const isPreset = isAvatarPresetPath(current.avatarUrl)

    return {
      ok: true,
      args: {},
      before: { avatarUrl: current.avatarUrl },
      preview: {
        title: 'Remove your profile picture',
        changes: [
          isPreset
            ? 'Clears the preset avatar you selected'
            : 'Deletes your uploaded photo from storage',
          'Your profile falls back to initials',
        ],
        warning: isPreset
          ? undefined
          : 'The uploaded file is permanently deleted — this cannot be undone.',
        undoable: isPreset,
        confirmLabel: 'Remove picture',
        destructive: true,
      },
    }
  },
  async execute() {
    const result = await removeAvatarAction()
    if (!result.ok) return fail(result.error ?? 'Could not remove your picture.')
    return {
      ok: true,
      summary: 'Removed the profile picture',
      after: { avatarUrl: null },
      href: '/dashboard/profile',
    }
  },
  async undo(ctx, input) {
    const previous = (input.before as { avatarUrl?: string | null } | null)
      ?.avatarUrl
    if (!previous || !isAvatarPresetPath(previous)) {
      return fail('The removed photo was deleted from storage and cannot be restored.')
    }
    const current = await loadProfileSnapshot(ctx.userId)
    if (!current) return fail('Could not load your profile.')
    const result = await writeProfile(current, { avatarUrl: previous })
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: 'Restored your previous avatar preset',
      after: { avatarUrl: previous },
    }
  },
})

const forgetNote = defineAgentAction<{ memoryId: string; fact: string }>({
  name: 'forget_note',
  domain: 'memory',
  async prepare(ctx, raw) {
    const memories = await getActiveMemories(ctx.userId)
    if (memories.length === 0) {
      return fail('I do not have any saved notes about you right now.')
    }

    const memoryId = asString(raw.memory_id) || asString(raw.memoryId)
    const search = asString(raw.fact).toLowerCase()
    const target =
      memories.find((m) => m.id === memoryId) ??
      (search
        ? memories.find((m) => m.fact.toLowerCase().includes(search))
        : undefined)

    if (!target) {
      return fail(
        `Which note should I forget? I currently remember: ${memories
          .slice(0, 8)
          .map((m) => `"${m.fact}"`)
          .join(', ')}.`,
      )
    }

    return {
      ok: true,
      args: { memoryId: target.id, fact: target.fact },
      before: { fact: target.fact, category: target.category },
      preview: {
        title: 'Forget a saved note',
        changes: [
          `Stops using the note "${target.fact}"`,
          'I will no longer factor it into programming advice',
        ],
        undoable: true,
        confirmLabel: 'Forget note',
      },
    }
  },
  async execute(ctx, prepared) {
    const result = await deactivateMemory(ctx.userId, prepared.args.memoryId)
    if (!result.ok) return fail(result.error ?? 'Could not forget that note.')
    return {
      ok: true,
      summary: `Forgot the note "${prepared.args.fact}"`,
      after: { memoryId: prepared.args.memoryId, active: false },
    }
  },
  async undo(ctx, input) {
    const memoryId = asString(input.args.memoryId)
    if (!memoryId) return fail('Could not find that note to restore.')
    const supabase = await createClient()
    const { error } = await supabase
      .from('ai_user_memory')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', memoryId)
      .eq('user_id', ctx.userId)
    if (error) return fail(error.message)
    return {
      ok: true,
      summary: 'Restored the saved note',
      after: { memoryId, active: true },
    }
  },
})

export const PROFILE_AGENT_ACTIONS: AnyAgentAction[] = [
  updateDetails,
  setAvatarPreset,
  removeAvatar,
  forgetNote,
]
