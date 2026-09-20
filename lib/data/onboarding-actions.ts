'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { rejectIfGuest } from '@/lib/data/guest-guard'
import type { ProfileGender } from '@/lib/database.types'
import {
  LOCALE_CHOSEN_COOKIE,
  LOCALE_COOKIE,
  type AppLocale,
  isAppLocale,
} from '@/lib/i18n'
import {
  buildOnboardingMetadataPatch,
  readOnboardingState,
  userNeedsOnboarding,
} from '@/lib/onboarding-storage'
import {
  buildTourSeedAfterOnboarding,
  homePathWithTourIfNeeded,
  readAppTourState,
} from '@/lib/app-tour-storage'
import {
  HOME_PATH,
  ONBOARDING_COOKIE,
  ONBOARDING_PATH,
  clampOnboardingStep,
  emptyOnboardingData,
  type OnboardingData,
} from '@/lib/onboarding-types'
import {
  isAppearanceMode,
  resolveAppearance,
  type AppearanceMode,
} from '@/lib/theme'
import { isValidHeightCm, isValidWeightKg } from '@/lib/units'
import { isAvatarPresetPath } from '@/lib/avatar-presets'

const USERNAME_RE = /^[a-z0-9_]{3,30}$/
const DISPLAY_NAME_MIN = 2
const DISPLAY_NAME_MAX = 40
const AVATAR_BUCKET = 'avatars'

export type OnboardingAvatarOptions = {
  newAvatarPath?: string | null
  avatarPresetPath?: string | null
}

export type OnboardingActionResult =
  | { ok: true; data: OnboardingData; completed: boolean; offerTour?: boolean }
  | { ok: false; error: string }

async function setNeedsOnboardingCookie(needs: boolean) {
  const jar = await cookies()
  if (needs) {
    jar.set(ONBOARDING_COOKIE, '1', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  } else {
    jar.set(ONBOARDING_COOKIE, '', {
      path: '/',
      maxAge: 0,
      sameSite: 'lax',
    })
  }
}

async function assertUsernameAvailable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  username: string,
  userId: string,
): Promise<string | null> {
  if (!username) return null
  if (!USERNAME_RE.test(username)) {
    return 'Username must be 3–30 characters: lowercase letters, numbers, underscores.'
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

function normalizeIncoming(
  partial: Partial<OnboardingData>,
  base: OnboardingData,
): OnboardingData {
  return {
    ...base,
    ...partial,
    version: 3,
    step: clampOnboardingStep(partial.step ?? base.step),
    displayName:
      typeof partial.displayName === 'string'
        ? partial.displayName.trim().replace(/\s+/g, ' ')
        : base.displayName,
    username:
      typeof partial.username === 'string'
        ? partial.username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
        : base.username,
    secondaryGoals: Array.isArray(partial.secondaryGoals)
      ? partial.secondaryGoals
      : base.secondaryGoals,
    preferredDays: Array.isArray(partial.preferredDays)
      ? partial.preferredDays
      : base.preferredDays,
    equipment: Array.isArray(partial.equipment)
      ? partial.equipment
      : base.equipment,
    trainingStyles: Array.isArray(partial.trainingStyles)
      ? partial.trainingStyles
      : base.trainingStyles,
    favoriteMuscleGroups: Array.isArray(partial.favoriteMuscleGroups)
      ? partial.favoriteMuscleGroups
      : base.favoriteMuscleGroups,
    avoidances:
      typeof partial.avoidances === 'string'
        ? partial.avoidances.trim().slice(0, 500)
        : base.avoidances,
    limitations:
      typeof partial.limitations === 'string'
        ? partial.limitations.trim().slice(0, 500)
        : base.limitations,
  }
}

async function persistOnboarding(
  data: OnboardingData,
  completed: boolean,
  options?: { logWeight?: boolean; avatar?: OnboardingAvatarOptions },
): Promise<OnboardingActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }
  if (user.is_anonymous) {
    return { ok: false, error: 'Guest accounts cannot complete onboarding.' }
  }

  const displayName = data.displayName.trim().replace(/\s+/g, ' ')
  if (displayName.length < DISPLAY_NAME_MIN || displayName.length > DISPLAY_NAME_MAX) {
    return {
      ok: false,
      error: `Display name must be ${DISPLAY_NAME_MIN}–${DISPLAY_NAME_MAX} characters.`,
    }
  }

  const username = data.username.trim().toLowerCase()
  if (!username) {
    return { ok: false, error: 'Username is required.' }
  }
  const unavailable = await assertUsernameAvailable(supabase, username, user.id)
  if (unavailable) return { ok: false, error: unavailable }

  if (data.heightCm != null && !isValidHeightCm(data.heightCm)) {
    return { ok: false, error: 'Enter a height between 100 and 250 cm (or equivalent).' }
  }
  if (data.weightKg != null && !isValidWeightKg(data.weightKg)) {
    return { ok: false, error: 'Enter a weight between 30 and 300 kg (or equivalent).' }
  }

  if (completed && !data.primaryGoal) {
    return { ok: false, error: 'Choose a primary fitness goal to finish setup.' }
  }
  if (completed && !data.fitnessLevel) {
    return { ok: false, error: 'Choose your fitness level to finish setup.' }
  }
  if (completed && (data.daysPerWeek == null || data.daysPerWeek < 1 || data.daysPerWeek > 7)) {
    return { ok: false, error: 'Choose how many days you can train each week.' }
  }
  if (completed && !data.workoutDuration) {
    return { ok: false, error: 'Choose a preferred workout duration.' }
  }
  if (completed && !data.trainingLocation) {
    return { ok: false, error: 'Choose where you usually train.' }
  }

  const appearance: AppearanceMode = isAppearanceMode(data.appearance)
    ? data.appearance
    : 'system'
  const resolvedTheme = resolveAppearance(appearance)

  const profileGender: ProfileGender | null =
    data.gender === 'male' || data.gender === 'female' ? data.gender : null

  const profilePatch: Record<string, unknown> = {
    display_name: displayName,
    preferred_unit: data.preferredUnit === 'lb' ? 'lb' : 'kg',
    updated_at: new Date().toISOString(),
  }

  // Persist resolved light/dark, or clear the column when System is selected
  // so a prior preference cannot override device theme after refresh.
  // Some DBs still have theme_preference NOT NULL — handled below on error.
  if (appearance === 'system') {
    profilePatch.theme_preference = null
  } else {
    profilePatch.theme_preference = resolvedTheme
  }

  profilePatch.username = username
  if (data.language === 'en' || data.language === 'ar') {
    profilePatch.language = data.language
  }
  if (data.heightCm != null) profilePatch.height_cm = data.heightCm
  if (data.weightKg != null && Number.isFinite(data.weightKg)) {
    profilePatch.current_weight_kg = Math.round(data.weightKg * 100) / 100
  }
  if (profileGender) profilePatch.gender = profileGender
  // Prefer-not / skipped → do not overwrite an existing gender with null mid-flow
  // unless completing with explicit prefer_not.
  if (completed && data.gender === 'prefer_not') {
    profilePatch.gender = null
  }

  if (options?.avatar?.newAvatarPath) {
    if (
      options.avatar.newAvatarPath.includes('..') ||
      !options.avatar.newAvatarPath.startsWith(`${user.id}/`)
    ) {
      return { ok: false, error: 'Invalid avatar path.' }
    }
    const { data: pub } = supabase.storage
      .from(AVATAR_BUCKET)
      .getPublicUrl(options.avatar.newAvatarPath)
    profilePatch.avatar_url = pub.publicUrl
  } else if (
    typeof options?.avatar?.avatarPresetPath === 'string' &&
    isAvatarPresetPath(options.avatar.avatarPresetPath)
  ) {
    profilePatch.avatar_url = options.avatar.avatarPresetPath
  }

  let { error: profileError } = await supabase
    .from('profiles')
    .update(profilePatch)
    .eq('id', user.id)

  // System mode: if nulling theme_preference is rejected (NOT NULL / check),
  // save the rest of the profile and keep appearance in auth metadata.
  if (profileError && appearance === 'system') {
    console.warn(
      '[onboarding] could not clear theme_preference for system mode:',
      profileError.message,
    )
    const { theme_preference: _ignored, ...withoutTheme } = profilePatch
    const retry = await supabase
      .from('profiles')
      .update(withoutTheme)
      .eq('id', user.id)
    profileError = retry.error
  }

  if (profileError) {
    console.error('[onboarding] profile update failed:', profileError.message)
    const msg = profileError.message.toLowerCase()
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return { ok: false, error: 'That username is already taken.' }
    }
    if (msg.includes('username can only be changed')) {
      return {
        ok: false,
        error: 'You can only change your username 2 times.',
      }
    }
    return { ok: false, error: 'Could not save your profile. Please try again.' }
  }

  if (options?.logWeight && data.weightKg != null && Number.isFinite(data.weightKg)) {
    await supabase.from('body_weight_logs').insert({
      user_id: user.id,
      weight_kg: Math.round(data.weightKg * 100) / 100,
      logged_at: new Date().toISOString(),
    })
  }

  const tourSeed = completed
    ? buildTourSeedAfterOnboarding(user.user_metadata as Record<string, unknown>)
    : {}
  const metaPatch = {
    ...buildOnboardingMetadataPatch(
      { ...data, displayName, username, appearance },
      completed,
    ),
    ...tourSeed,
  }

  const { error: metaError } = await supabase.auth.updateUser({
    data: metaPatch,
  })

  if (metaError) {
    return { ok: false, error: 'Could not save your progress. Please try again.' }
  }

  if (completed) {
    await supabase.auth.refreshSession()
  }

  const offerTour =
    completed &&
    (Object.keys(tourSeed).length > 0 ||
      readAppTourState({
        ...user,
        user_metadata: { ...user.user_metadata, ...metaPatch },
      }).shouldAutoOffer)

  if (data.language === 'en' || data.language === 'ar') {
    const jar = await cookies()
    jar.set(LOCALE_COOKIE, data.language, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
    jar.set(LOCALE_CHOSEN_COOKIE, '1', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    })
  }

  await setNeedsOnboardingCookie(!completed)

  revalidatePath(ONBOARDING_PATH)
  revalidatePath(HOME_PATH)
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/profile')
  revalidatePath('/dashboard/fitness-profile')

  return {
    ok: true,
    data: { ...data, displayName, username, appearance },
    completed,
    offerTour,
  }
}

export async function getOnboardingStateAction(): Promise<{
  incomplete: boolean
  completed: boolean
  data: OnboardingData
  email: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      incomplete: false,
      completed: true,
      data: emptyOnboardingData(),
      email: null,
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'display_name, username, preferred_unit, height_cm, current_weight_kg, gender, language, theme_preference',
    )
    .eq('id', user.id)
    .maybeSingle()

  const state = readOnboardingState(user, profile ?? undefined)
  return {
    incomplete: state.incomplete,
    completed: state.completed && !state.incomplete,
    data: state.data,
    email: user.email ?? null,
  }
}

export async function markOnboardingStartedAction(): Promise<OnboardingActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  if (user.user_metadata?.onboarding_completed === true) {
    const state = readOnboardingState(user)
    return { ok: true, data: state.data, completed: true }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'display_name, username, preferred_unit, height_cm, current_weight_kg, gender, language, theme_preference',
    )
    .eq('id', user.id)
    .maybeSingle()

  const state = readOnboardingState(user, profile ?? undefined)
  const data = {
    ...state.data,
    displayName:
      state.data.displayName ||
      profile?.display_name ||
      user.email?.split('@')[0] ||
      'Athlete',
  }

  const { error } = await supabase.auth.updateUser({
    data: buildOnboardingMetadataPatch(data, false),
  })
  if (error) return { ok: false, error: 'Could not start onboarding.' }

  await setNeedsOnboardingCookie(true)
  return { ok: true, data, completed: false }
}

export async function saveOnboardingProgressAction(
  partial: Partial<OnboardingData>,
  avatar?: OnboardingAvatarOptions,
): Promise<OnboardingActionResult> {
  const current = await getOnboardingStateAction()
  if (current.completed && current.data.step >= 4) {
    // Editing from settings after completion — allow updates without flipping incomplete.
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  const alreadyComplete = user.user_metadata?.onboarding_completed !== false
  const merged = normalizeIncoming(partial, current.data)

  // While incomplete, keep completed=false. Settings edits after complete stay complete.
  // Missing onboarding_completed means legacy complete — do not flip to incomplete.
  return persistOnboarding(merged, alreadyComplete, {
    logWeight: false,
    avatar,
  })
}

export async function syncOnboardingGateCookieAction(
  needs: boolean,
): Promise<void> {
  await setNeedsOnboardingCookie(needs)
}

export async function completeOnboardingAction(
  partial: Partial<OnboardingData>,
  avatar?: OnboardingAvatarOptions,
): Promise<OnboardingActionResult> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  const current = await getOnboardingStateAction()
  const alreadyComplete =
    current.completed && !current.incomplete
  const merged = normalizeIncoming(
    { ...partial, step: partial.step ?? 4 },
    current.data,
  )
  // Avoid duplicate weight logs when re-saving from Settings edit mode.
  return persistOnboarding(merged, true, {
    logWeight: !alreadyComplete && merged.weightKg != null,
    avatar,
  })
}

export async function resolvePostAuthPathAction(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return '/login'
  if (userNeedsOnboarding(user)) {
    await setNeedsOnboardingCookie(true)
    return ONBOARDING_PATH
  }
  await setNeedsOnboardingCookie(false)
  return homePathWithTourIfNeeded(user)
}

export async function checkUsernameAvailableAction(
  username: string,
): Promise<{ available: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { available: false, error: 'Not signed in.' }
  const handle = username.trim().toLowerCase()
  if (!handle) return { available: true }
  const unavailable = await assertUsernameAvailable(supabase, handle, user.id)
  if (unavailable) return { available: false, error: unavailable }
  return { available: true }
}

export async function updateAppearanceAction(
  appearance: AppearanceMode,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const guest = await rejectIfGuest()
  if (guest) return { ok: false, error: guest }

  if (!isAppearanceMode(appearance)) {
    return { ok: false, error: 'Invalid appearance.' }
  }
  const resolved = resolveAppearance(appearance)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: true }

  // System must clear the stored light/dark column so refresh/login cannot
  // resurrect a stale preference over device theme.
  const profileUpdate: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (appearance === 'system') {
    profileUpdate.theme_preference = null
  } else {
    profileUpdate.theme_preference = resolved
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('id', user.id)

  if (profileError && appearance === 'system') {
    // Some deployments may still require a non-null theme_preference.
    // Metadata appearance remains the source of truth for System.
    console.warn(
      '[appearance] could not clear theme_preference for system mode:',
      profileError.message,
    )
    const { theme_preference: _ignored, ...withoutTheme } = profileUpdate
    const retry = await supabase
      .from('profiles')
      .update(withoutTheme)
      .eq('id', user.id)
    if (retry.error) {
      return { ok: false, error: 'Could not save appearance.' }
    }
  } else if (profileError) {
    return { ok: false, error: 'Could not save appearance.' }
  }

  const { error: metaError } = await supabase.auth.updateUser({
    data: {
      appearance,
      theme_preference: appearance === 'system' ? null : resolved,
    },
  })
  if (metaError) {
    return { ok: false, error: 'Could not save appearance.' }
  }

  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard', 'layout')
  return { ok: true }
}

export async function syncLocaleFromOnboarding(
  language: AppLocale,
): Promise<void> {
  if (!isAppLocale(language)) return
  const jar = await cookies()
  jar.set(LOCALE_COOKIE, language, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  jar.set(LOCALE_CHOSEN_COOKIE, '1', {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
}
