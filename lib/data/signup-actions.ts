'use server'

import { revalidatePath } from 'next/cache'
import { isAvatarPresetPath } from '@/lib/avatar-presets'
import { createClient } from '@/lib/supabase/server'
import {
  normalizeUsername,
  validateUsernameFormat,
} from '@/lib/username'

const AVATAR_BUCKET = 'avatars'

export type FinalizeSignupResult =
  | { ok: true; username: string; avatarUrl: string | null; avatarError?: string }
  | { ok: false; error: string }

/**
 * After email sign-up session exists: require username, claim it on profiles,
 * optionally attach an already-uploaded avatar storage path or a preset.
 */
export async function finalizeEmailSignupAction(input: {
  username: string
  /** Storage object path under avatars/ (e.g. `{userId}/ts.webp`). */
  newAvatarPath?: string | null
  /** Local preset path under /avatars/presets (used when no upload). */
  presetAvatarPath?: string | null
}): Promise<FinalizeSignupResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }
  if (user.is_anonymous) {
    return { ok: false, error: 'Guest accounts cannot set a username here.' }
  }

  const username = normalizeUsername(input.username)
  const formatError = validateUsernameFormat(username)
  if (formatError) return { ok: false, error: formatError }

  const { data: taken } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', user.id)
    .maybeSingle()
  if (taken) return { ok: false, error: 'That username is already taken.' }

  let avatarUrl: string | null = null
  let avatarError: string | undefined

  if (input.newAvatarPath) {
    const expectedPrefix = `${user.id}/`
    if (
      input.newAvatarPath.includes('..') ||
      !input.newAvatarPath.startsWith(expectedPrefix)
    ) {
      avatarError = 'Invalid avatar path.'
    } else {
      const { data: pub } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(input.newAvatarPath)
      avatarUrl = pub.publicUrl
    }
  } else if (input.presetAvatarPath) {
    if (!isAvatarPresetPath(input.presetAvatarPath)) {
      avatarError = 'Invalid avatar preset.'
    } else {
      avatarUrl = input.presetAvatarPath.trim()
    }
  }

  const displayName =
    (typeof user.user_metadata?.display_name === 'string' &&
      user.user_metadata.display_name.trim()) ||
    user.email?.split('@')[0] ||
    username

  const patch: Record<string, unknown> = {
    username,
    display_name: displayName,
    updated_at: new Date().toISOString(),
  }
  if (avatarUrl) patch.avatar_url = avatarUrl

  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return { ok: false, error: 'That username is already taken.' }
    }
    if (msg.includes('username') && msg.includes('null')) {
      return { ok: false, error: 'Username is required.' }
    }
    return { ok: false, error: error.message }
  }

  await supabase.auth.updateUser({
    data: {
      username,
      display_name: displayName,
    },
  })

  revalidatePath('/onboarding')
  revalidatePath('/dashboard/home')
  revalidatePath(`/profile/${username}`)

  return { ok: true, username, avatarUrl, avatarError }
}

/** Pre-check username availability before creating the auth user. */
export async function checkSignupUsernameAction(
  raw: string,
): Promise<{ available: boolean; error?: string; username: string }> {
  const username = normalizeUsername(raw)
  const formatError = validateUsernameFormat(username)
  if (formatError) {
    return { available: false, error: formatError, username }
  }

  const supabase = await createClient()
  const { data: available, error } = await supabase.rpc('is_username_available', {
    desired: username,
  })

  if (error) {
    // Fallback if RPC not deployed yet: best-effort select (may be RLS-limited).
    const { data: taken } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username)
      .maybeSingle()
    if (taken) {
      return {
        available: false,
        error: 'That username is already taken.',
        username,
      }
    }
    return { available: true, username }
  }

  if (available === false) {
    return {
      available: false,
      error: 'That username is already taken.',
      username,
    }
  }
  return { available: true, username }
}
