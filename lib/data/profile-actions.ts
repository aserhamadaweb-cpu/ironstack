'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import type {
  NotificationPreferences,
  PrivacyFollow,
  PrivacyFriendRequest,
  PrivacyMessage,
  ProfileGender,
  BodyWeightLog,
} from '@/lib/database.types'
import { LOCALE_COOKIE, type AppLocale } from '@/lib/i18n'
import { suggestUsernameFromEmail } from '@/lib/profile-path'
import { createClient } from '@/lib/supabase/server'
import {
  isValidBirthDate,
  isValidHeightCm,
  isValidWeightKg,
} from '@/lib/units'

const USERNAME_RE = /^[a-z0-9_]{3,30}$/
const BIO_MAX = 160
const AVATAR_BUCKET = 'avatars'

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
    return 'Username must be 3?30 characters: lowercase letters, numbers, underscores.'
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
    }
  }

  const email = user.email ?? null

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'username, display_name, is_guest, height_cm, gender, birth_date, current_weight_kg',
    )
    .eq('id', user.id)
    .maybeSingle()

  const emailLocal = email?.split('@')[0] ?? 'athlete'
  const suggestion = suggestUsernameFromEmail(
    profile?.username || profile?.display_name || emailLocal,
  )

  if (user.is_anonymous || profile?.is_guest === true) {
    return {
      needsUsername: false,
      needsBodyStats: false,
      isGuest: true,
      suggestion,
      displayName: profile?.display_name || emailLocal || 'Athlete',
    }
  }

  const needsBodyStats =
    profile?.height_cm == null ||
    profile?.gender == null ||
    !profile?.birth_date ||
    profile?.current_weight_kg == null

  return {
    needsUsername: !profile?.username?.trim(),
    needsBodyStats,
    isGuest: false,
    suggestion,
    displayName: profile?.display_name || emailLocal || 'Athlete',
  }
}

/** Claim / set username only (signup + backfill). */
export async function claimUsernameAction(input: {
  username: string
  displayName?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const username = input.username.trim().toLowerCase()
  const unavailable = await assertUsernameAvailable(supabase, username, user.id)
  if (unavailable) return { ok: false, error: unavailable }

  const displayName =
    input.displayName?.trim() ||
    (typeof user.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : null) ||
    user.email?.split('@')[0] ||
    username

  // Profiles are created by a signup trigger — never insert/upsert here.
  const { data: updated, error } = await supabase
    .from('profiles')
    .update({
      username,
      display_name: displayName,
      updated_at: new Date().toISOString(),
    })
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
    data: { username, display_name: displayName },
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
    .select('avatar_url')
    .eq('id', user.id)
    .maybeSingle()

  let nextAvatarUrl = input.avatarUrl ?? current?.avatar_url ?? null

  if (input.newAvatarPath) {
    const { data: pub } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(input.newAvatarPath)
    nextAvatarUrl = pub.publicUrl

    const oldPath = parseAvatarPath(current?.avatar_url ?? null)
    if (oldPath && oldPath !== input.newAvatarPath) {
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
  if (language !== 'en' && language !== 'ar') {
    return { ok: false, error: 'Language must be en or ar.' }
  }

  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, language, {
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
export async function deleteAccountAction(
  confirmText: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
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
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) return { ok: false, error: error.message }
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
