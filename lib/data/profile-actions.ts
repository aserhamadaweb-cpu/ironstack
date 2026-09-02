'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import {
  isAvatarPresetPath,
  isTemporaryUsername,
} from '@/lib/avatar-presets'
import type {
  NotificationPreferences,
  PrivacyFollow,
  PrivacyFriendRequest,
  PrivacyMessage,
  ProfileGender,
} from '@/lib/database.types'
import { LOCALE_CHOSEN_COOKIE, LOCALE_COOKIE, type AppLocale } from '@/lib/i18n'
import { suggestUsernameFromEmail } from '@/lib/profile-path'
import { createClient } from '@/lib/supabase/server'
import { rejectIfGuest } from '@/lib/data/guest-guard'
import {
  isValidBirthDate,
  isValidHeightCm,
  isValidWeightKg,
} from '@/lib/units'
import { normalizeUsername, validateUsernameFormat } from '@/lib/username'

const USERNAME_RE = /^[a-z0-9_]{3,30}$/
const BIO_MAX = 160
const AVATAR_BUCKET = 'avatars'
/** Max times a user may change an already-set username. */
const USERNAME_CHANGE_LIMIT = 2

export type ProfileFieldErrors = {
  username?: string
  displayName?: string
  bio?: string
  avatar?: string
  form?: string
}

function parseAvatarPath(avatarUrl: string | null): string | null {
  if (!avatarUrl) return null
  const marker = `/object/public/${AVATAR_BUCKET}/`
  const idx = avatarUrl.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(avatarUrl.slice(idx + marker.length))
}

async function assertUsernameAvailable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  username: string,
  userId: string,
): Promise<string | null> {
  if (!USERNAME_RE.test(username)) {
    return 'Username must be 3-30 characters: lowercase letters, numbers, underscores.'
  }
  const { data: taken } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .neq('id', userId)
    .maybeSingle()
  if (taken) return 'That username is already taken.'
  return null
}

/** Whether the signed-in user is an anonymous guest. */
export async function getIsGuestAction(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  if (user.is_anonymous) return true

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_guest')
    .eq('id', user.id)
    .maybeSingle()

  return profile?.is_guest === true
}

/** Lightweight status for the choose-username / complete-profile gate. */
export async function getUsernameStatusAction(): Promise<{
  needsUsername: boolean
  needsBodyStats: boolean
  isGuest: boolean
  suggestion: string
  displayName: string
  userId: string | null
  avatarUrl: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      needsUsername: false,
      needsBodyStats: false,
      isGuest: false,
      suggestion: 'athlete',
      displayName: 'Athlete',
      userId: null,
      avatarUrl: null,
    }
  }

  const email = user.email ?? null

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'username, display_name, is_guest, height_cm, gender, birth_date, current_weight_kg, avatar_url',
    )
    .eq('id', user.id)
    .maybeSingle()

  const emailLocal = email?.split('@')[0] ?? 'athlete'
  const suggestionSource =
    profile?.username && !isTemporaryUsername(profile.username)
      ? profile.username
      : profile?.display_name && !isTemporaryUsername(profile.display_name)
        ? profile.display_name
        : emailLocal
  const suggestion = suggestUsernameFromEmail(suggestionSource)

  if (user.is_anonymous || profile?.is_guest === true) {
    return {
      needsUsername: false,
      needsBodyStats: false,
      isGuest: true,
      suggestion,
      displayName: profile?.display_name || emailLocal || 'Athlete',
      userId: user.id,
      avatarUrl: profile?.avatar_url ?? null,
    }
  }

  const needsBodyStats =
    profile?.height_cm == null ||
    profile?.gender == null ||
    !profile?.birth_date ||
    profile?.current_weight_kg == null

  // Fitness onboarding handles body stats. Username is still required for
  // Google/OAuth accounts that only have a temporary `tmp_*` handle.
  const onboardingDone = user.user_metadata?.onboarding_completed === true
  const onboardingInProgress =
    user.user_metadata?.onboarding_completed === false
  const needsUsername =
    !profile?.username?.trim() || isTemporaryUsername(profile.username)

  if (onboardingDone || onboardingInProgress) {
    return {
      needsUsername,
      needsBodyStats: false,
      isGuest: false,
      suggestion,
      displayName: profile?.display_name || emailLocal || 'Athlete',
      userId: user.id,
      avatarUrl: profile?.avatar_url ?? null,
    }
  }

  return {
    needsUsername,
    needsBodyStats,
    isGuest: false,
    suggestion,
    displayName: profile?.display_name || emailLocal || 'Athlete',
    userId: user.id,
    avatarUrl: profile?.avatar_url ?? null,
  }
}

/** Claim / set username + display name (signup, Google gate, backfill). */
export async function claimUsernameAction(input: {
  username: string
  displayName?: string
  /** Whitelisted preset path under /avatars/presets, or null to leave avatar. */
  avatarPresetPath?: string | null
  /** Storage path from client upload (`userId/timestamp.ext`). */
  newAvatarPath?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const username = normalizeUsername(input.username)
  const formatError = validateUsernameFormat(username)
  if (formatError) return { ok: false, error: formatError }
  if (isTemporaryUsername(username)) {
    return { ok: false, error: 'Choose a personal username (not a temporary one).' }
  }

  const unavailable = await assertUsernameAvailable(supabase, username, user.id)
  if (unavailable) return { ok: false, error: unavailable }

  const displayName =
    input.displayName?.trim() ||
    (typeof user.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : null) ||
    user.email?.split('@')[0] ||
    username

  if (displayName.length < 2 || displayName.length > 60) {
    return { ok: false, error: 'Display name must be 2–60 characters.' }
  }

  const patch: Record<string, unknown> = {
    username,
    display_name: displayName,
    updated_at: new Date().toISOString(),
  }

  if (input.newAvatarPath) {
    if (
      input.newAvatarPath.includes('..') ||
      !input.newAvatarPath.startsWith(`${user.id}/`)
    ) {
      return { ok: false, error: 'Invalid avatar path.' }
    }
    const { data: pub } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(input.newAvatarPath)
    patch.avatar_url = pub.publicUrl
  } else if (
    typeof input.avatarPresetPath === 'string' &&
    isAvatarPresetPath(input.avatarPresetPath)
  ) {
    patch.avatar_url = input.avatarPresetPath
  }

  // Profiles are created by a signup trigger — never insert/upsert here.
  const { data: updated, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('id')
    .maybeSingle()

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return { ok: false, error: 'That username is already taken.' }
    }
    return { ok: false, error: error.message }
  }

  if (!updated) {
    return {
      ok: false,
      error: 'Profile not found. Refresh and try again.',
    }
  }

  await supabase.auth.updateUser({
    data: {
      username,
      display_name: displayName,
      username_claimed: true,
    },
  })

  revalidatePath('/dashboard/home')
  revalidatePath('/dashboard/profile')
  revalidatePath(`/profile/${username}`)
  revalidatePath(`/profile/${user.id}`)
  return { ok: true }
}

export async function updateProfileAction(input: {
  username: string
  displayName: string
  bio: string
  avatarUrl?: string | null
  newAvatarPath?: string | null
}): Promise<{ ok: true } | { ok: false; errors: ProfileFieldErrors }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, errors: { form: guest } }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, errors: { form: 'Not signed in.' } }
  }

  const errors: ProfileFieldErrors = {}
  const username = input.username.trim().toLowerCase()
  const displayName = input.displayName.trim()
  const bio = input.bio.trim()

  const unavailable = await assertUsernameAvailable(supabase, username, user.id)
  if (unavailable) errors.username = unavailable
  if (isTemporaryUsername(username)) {
    errors.username = 'Choose a personal username (not a temporary one).'
  }
  if (!displayName || displayName.length > 60) {
    errors.displayName = 'Display name is required (max 60 characters).'
  }
  if (bio.length > BIO_MAX) {
    errors.bio = `Bio must be ${BIO_MAX} characters or fewer.`
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors }
  }

  const { data: current } = await supabase
    .from('profiles')
    .select('avatar_url, username, username_change_count')
    .eq('id', user.id)
    .maybeSingle()

  const currentUsername = current?.username?.trim().toLowerCase() || null
  const usernameChanged = currentUsername !== null && currentUsername !== username
  const changeCount = current?.username_change_count ?? 0

  if (usernameChanged && changeCount >= USERNAME_CHANGE_LIMIT) {
    return {
      ok: false,
      errors: {
        username: `You can only change your username ${USERNAME_CHANGE_LIMIT} times.`,
      },
    }
  }

  let nextAvatarUrl = current?.avatar_url ?? null

  if (input.newAvatarPath) {
    if (
      input.newAvatarPath.includes('..') ||
      !input.newAvatarPath.startsWith(`${user.id}/`)
    ) {
      return { ok: false, errors: { avatar: 'Invalid avatar path.' } }
    }
    const { data: pub } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(input.newAvatarPath)
    nextAvatarUrl = pub.publicUrl

    const oldPath = parseAvatarPath(current?.avatar_url ?? null)
    if (oldPath && oldPath !== input.newAvatarPath) {
      await supabase.storage.from(AVATAR_BUCKET).remove([oldPath])
    }
  } else if (input.avatarUrl !== undefined) {
    const requested = input.avatarUrl?.trim() || null
    if (requested && !isAvatarPresetPath(requested)) {
      // Keep an existing uploaded URL only if the client echoed it back unchanged.
      if (requested !== current?.avatar_url) {
        return { ok: false, errors: { avatar: 'Invalid avatar selection.' } }
      }
    }
    nextAvatarUrl = requested

    const oldPath = parseAvatarPath(current?.avatar_url ?? null)
    if (oldPath && requested !== current?.avatar_url) {
      await supabase.storage.from(AVATAR_BUCKET).remove([oldPath])
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      username,
      display_name: displayName,
      bio: bio || null,
      avatar_url: nextAvatarUrl,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return {
        ok: false,
        errors: { username: 'That username is already taken.' },
      }
    }
    if (msg.includes('username can only be changed')) {
      return {
        ok: false,
        errors: {
          username: `You can only change your username ${USERNAME_CHANGE_LIMIT} times.`,
        },
      }
    }
    return { ok: false, errors: { form: error.message } }
  }

  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard/profile/edit')
  revalidatePath(`/profile/${username}`)
  revalidatePath(`/profile/${user.id}`)
  revalidatePath('/dashboard/home')
  return { ok: true }
}

export async function removeAvatarAction(): Promise<{
  ok: boolean
  error?: string
}> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { data: current } = await supabase
    .from('profiles')
    .select('avatar_url, username')
    .eq('id', user.id)
    .maybeSingle()

  const path = parseAvatarPath(current?.avatar_url ?? null)
  if (path) {
    await supabase.storage.from(AVATAR_BUCKET).remove([path])
  }

  await supabase
    .from('profiles')
    .update({ avatar_url: null, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard/profile/edit')
  if (current?.username) revalidatePath(`/profile/${current.username}`)
  revalidatePath(`/profile/${user.id}`)
  return { ok: true }
}

export async function updatePreferredUnitAction(
  unit: 'kg' | 'lb',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  if (unit !== 'kg' && unit !== 'lb') {
    return { ok: false, error: 'Unit must be kg or lb.' }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase
    .from('profiles')
    .update({ preferred_unit: unit, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/home')
  revalidatePath('/dashboard/leaderboard')
  revalidatePath('/dashboard/history')
  revalidatePath('/dashboard/records')
  revalidatePath('/dashboard/workout')
  revalidatePath('/dashboard/explore')
  return { ok: true }
}

export async function updateLanguagePreferenceAction(
  language: AppLocale,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  if (language !== 'en' && language !== 'ar') {
    return { ok: false, error: 'Language must be en or ar.' }
  }

  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, language, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  cookieStore.set(LOCALE_CHOSEN_COOKIE, '1', {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: true }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      language,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { ok: false, error: error.message }

  // Regenerate coach insight for the new language so Home/Workout don't
  // keep a stale cached tip until the next daily/session refresh.
  try {
    const { getOrRefreshCoachInsight } = await import('@/lib/ai/insights')
    await getOrRefreshCoachInsight(user.id, { force: true })
  } catch (err) {
    console.error('[language] insight refresh failed', err)
  }

  revalidatePath('/', 'layout')
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/home')
  revalidatePath('/dashboard/workout')
  revalidatePath('/dashboard/ai-coach')
  return { ok: true }
}

export async function updateAccountEmailAction(
  email: string,
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const next = email.trim().toLowerCase()
  if (!next || !next.includes('@')) {
    return { ok: false, error: 'Enter a valid email address.' }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase.auth.updateUser({ email: next })
  if (error) return { ok: false, error: error.message }

  return {
    ok: true,
    message:
      'Check your inbox ? Supabase will email a confirmation link for the new address.',
  }
}

export async function updateAccountPasswordAction(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (password.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters.' }
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Deletes the auth user via service role. Profile + child rows cascade
 * (profiles.id ? auth.users ON DELETE CASCADE; most app tables ? profiles).
 */
function formatAccountDeleteError(
  error: { message?: string; code?: string; status?: number } | null | undefined,
  fallback: string,
): string {
  const raw = typeof error?.message === 'string' ? error.message.trim() : ''
  // auth-js uses JSON.stringify(body) when GoTrue returns an empty/unhelpful body,
  // which surfaces in the UI as the literal "{}" string.
  if (!raw || raw === '{}' || raw === 'null') return fallback
  return raw
}

/**
 * Clears rows that still use ON DELETE NO ACTION toward profiles/auth.users so
 * admin.deleteUser → profiles CASCADE is not blocked (e.g. dm_messages.sender_id).
 */
async function clearAccountDeleteBlockers(
  admin: ReturnType<
    typeof import('@/lib/supabase/admin').createAdminClient
  >,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const steps: Array<{ label: string; run: () => Promise<{ error: { message?: string } | null }> }> = [
    {
      label: 'dm_messages',
      run: async () =>
        admin.from('dm_messages').delete().eq('sender_id', userId),
    },
    {
      label: 'group_messages',
      run: async () =>
        admin.from('group_messages').delete().eq('sender_id', userId),
    },
    {
      label: 'challenges.winner_id',
      run: async () =>
        admin.from('challenges').update({ winner_id: null }).eq('winner_id', userId),
    },
    {
      label: 'personal_records',
      run: async () =>
        admin.from('personal_records').delete().eq('user_id', userId),
    },
  ]

  for (const step of steps) {
    const { error } = await step.run()
    if (error) {
      return {
        ok: false,
        error: formatAccountDeleteError(
          error,
          `Could not clear ${step.label} before deleting the account.`,
        ),
      }
    }
  }

  // initiated_by is NOT NULL + NO ACTION; reassign to the other participant.
  const { data: threads, error: threadsError } = await admin
    .from('dm_threads')
    .select('id, user_a_id, user_b_id, initiated_by')
    .eq('initiated_by', userId)
  if (threadsError) {
    return {
      ok: false,
      error: formatAccountDeleteError(
        threadsError,
        'Could not clear DM threads before deleting the account.',
      ),
    }
  }
  for (const thread of threads ?? []) {
    const next =
      thread.user_a_id === userId ? thread.user_b_id : thread.user_a_id
    if (!next || next === userId) continue
    const { error } = await admin
      .from('dm_threads')
      .update({ initiated_by: next })
      .eq('id', thread.id)
    if (error) {
      return {
        ok: false,
        error: formatAccountDeleteError(
          error,
          'Could not clear DM thread initiator before deleting the account.',
        ),
      }
    }
  }

  return { ok: true }
}

export async function deleteAccountAction(
  confirmText: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  if (confirmText.trim().toUpperCase() !== 'DELETE') {
    return { ok: false, error: 'Type DELETE to confirm.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    const cleared = await clearAccountDeleteBlockers(admin, user.id)
    if (!cleared.ok) return cleared

    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) {
      return {
        ok: false,
        error: formatAccountDeleteError(
          error,
          'Could not delete the account.',
        ),
      }
    }
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Account deletion is not configured (missing service role).',
    }
  }

  await supabase.auth.signOut()
  return { ok: true }
}

const NOTIFICATION_KEYS = [
  'friend_request',
  'friend_accepted',
  'new_follower',
  'new_message',
  'message_request',
  'pr_achievement',
  'split_saved',
] as const

export async function updateNotificationPreferencesAction(
  prefs: NotificationPreferences,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  for (const key of NOTIFICATION_KEYS) {
    if (typeof prefs[key] !== 'boolean') {
      return { ok: false, error: `Invalid preference: ${key}` }
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase
    .from('profiles')
    .update({
      notification_preferences: prefs,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/settings')
  return { ok: true }
}

export async function updatePrivacySettingsAction(input: {
  privacy_follow: PrivacyFollow
  privacy_friend_request: PrivacyFriendRequest
  privacy_message: PrivacyMessage
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  if (input.privacy_follow !== 'everyone' && input.privacy_follow !== 'nobody') {
    return { ok: false, error: 'Invalid follow privacy.' }
  }
  if (
    input.privacy_friend_request !== 'everyone' &&
    input.privacy_friend_request !== 'nobody'
  ) {
    return { ok: false, error: 'Invalid friend-request privacy.' }
  }
  if (
    input.privacy_message !== 'everyone' &&
    input.privacy_message !== 'friends' &&
    input.privacy_message !== 'nobody'
  ) {
    return { ok: false, error: 'Invalid message privacy.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase
    .from('profiles')
    .update({
      privacy_follow: input.privacy_follow,
      privacy_friend_request: input.privacy_friend_request,
      privacy_message: input.privacy_message,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/dashboard/settings')
  return { ok: true }
}

async function revalidateBodyPaths(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/profile')
  revalidatePath(`/profile/${userId}`)
  const { data } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle()
  if (data?.username) revalidatePath(`/profile/${data.username}`)
}

export async function updateBodyStatsAction(input: {
  height_cm: number
  gender: ProfileGender
  birth_date: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  if (!isValidHeightCm(input.height_cm)) {
    return { ok: false, error: 'Height must be between 100 and 250 cm.' }
  }
  if (input.gender !== 'male' && input.gender !== 'female') {
    return { ok: false, error: 'Gender must be male or female.' }
  }
  if (!isValidBirthDate(input.birth_date)) {
    return {
      ok: false,
      error: 'Birth date must imply an age between 10 and 100.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase
    .from('profiles')
    .update({
      height_cm: Math.round(input.height_cm * 10) / 10,
      gender: input.gender,
      birth_date: input.birth_date,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { ok: false, error: error.message }

  await revalidateBodyPaths(supabase, user.id)
  return { ok: true }
}

export async function logBodyWeightAction(
  weightKg: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  if (!isValidWeightKg(weightKg)) {
    return { ok: false, error: 'Weight must be between 30 and 300 kg.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase.from('body_weight_logs').insert({
    user_id: user.id,
    weight_kg: Math.round(weightKg * 100) / 100,
  })

  if (error) return { ok: false, error: error.message }

  await revalidateBodyPaths(supabase, user.id)
  return { ok: true }
}

export async function deleteBodyWeightLogAction(
  logId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  if (!logId) return { ok: false, error: 'Missing log id.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const { error } = await supabase
    .from('body_weight_logs')
    .delete()
    .eq('id', logId)
    .eq('user_id', user.id)

  if (error) return { ok: false, error: error.message }

  await revalidateBodyPaths(supabase, user.id)
  return { ok: true }
}
