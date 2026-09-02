import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
  type PrivacyFollow,
  type PrivacyFriendRequest,
  type PrivacyMessage,
} from '@/lib/database.types'
import {
  updateLanguagePreferenceAction,
  updateNotificationPreferencesAction,
  updatePreferredUnitAction,
  updatePrivacySettingsAction,
} from '@/lib/data/profile-actions'
import { updateAppearanceAction } from '@/lib/data/onboarding-actions'
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

const NOTIFICATION_KEYS = Object.keys(
  DEFAULT_NOTIFICATION_PREFERENCES,
) as Array<keyof NotificationPreferences>

const NOTIFICATION_LABELS: Record<keyof NotificationPreferences, string> = {
  friend_request: 'friend requests',
  friend_accepted: 'accepted friend requests',
  new_follower: 'new followers',
  new_message: 'new messages',
  message_request: 'message requests',
  pr_achievement: 'personal record alerts',
  split_saved: 'saved split confirmations',
  unfinished_session: 'unfinished workout reminders',
}

const setUnit = defineAgentAction<{ unit: 'kg' | 'lb'; previous: 'kg' | 'lb' }>({
  name: 'set_preferred_unit',
  domain: 'preference',
  async prepare(ctx, raw) {
    const requested = asString(raw.unit).toLowerCase()
    if (requested !== 'kg' && requested !== 'lb') {
      return fail('Should weights show in kg or lb?')
    }

    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferred_unit')
      .eq('id', ctx.userId)
      .maybeSingle()

    const previous = profile?.preferred_unit === 'lb' ? 'lb' : 'kg'
    if (previous === requested) {
      return fail(`Weights are already shown in ${requested}.`)
    }

    return {
      ok: true,
      args: { unit: requested, previous },
      before: { unit: previous },
      preview: {
        title: `Switch weight units to ${requested}`,
        changes: [
          `Displays every weight in ${requested} instead of ${previous}`,
          'Your logged data is unchanged — this only affects display',
        ],
        undoable: true,
        confirmLabel: `Use ${requested}`,
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await updatePreferredUnitAction(prepared.args.unit)
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: `Switched weight units to ${prepared.args.unit}`,
      after: { unit: prepared.args.unit },
      href: '/dashboard/settings',
    }
  },
  async undo(_ctx, input) {
    const previous = (input.before as { unit?: string } | null)?.unit
    if (previous !== 'kg' && previous !== 'lb') {
      return fail('Could not work out the previous unit.')
    }
    const result = await updatePreferredUnitAction(previous)
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: `Switched weight units back to ${previous}`,
      after: { unit: previous },
    }
  },
})

const setLanguage = defineAgentAction<{
  language: 'en' | 'ar'
  previous: 'en' | 'ar'
}>({
  name: 'set_language',
  domain: 'preference',
  async prepare(ctx, raw) {
    const requested = asString(raw.language).toLowerCase()
    if (requested !== 'en' && requested !== 'ar') {
      return fail('I can switch the app to English or Arabic — which one?')
    }

    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('language')
      .eq('id', ctx.userId)
      .maybeSingle()

    const previous = profile?.language === 'ar' ? 'ar' : 'en'
    if (previous === requested) {
      return fail(
        requested === 'ar'
          ? 'The app is already in Arabic.'
          : 'The app is already in English.',
      )
    }

    return {
      ok: true,
      args: { language: requested, previous },
      before: { language: previous },
      preview: {
        title:
          requested === 'ar'
            ? 'Switch the app to Arabic'
            : 'Switch the app to English',
        changes: [
          `Changes every screen to ${requested === 'ar' ? 'Arabic' : 'English'}`,
          requested === 'ar'
            ? 'Layout flips to right-to-left'
            : 'Layout returns to left-to-right',
          'I will reply in that language from then on',
        ],
        undoable: true,
        confirmLabel: requested === 'ar' ? 'Switch to Arabic' : 'Switch to English',
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await updateLanguagePreferenceAction(prepared.args.language)
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: `Switched app language to ${prepared.args.language}`,
      after: { language: prepared.args.language },
      href: '/dashboard/settings',
    }
  },
  async undo(_ctx, input) {
    const previous = (input.before as { language?: string } | null)?.language
    if (previous !== 'en' && previous !== 'ar') {
      return fail('Could not work out the previous language.')
    }
    const result = await updateLanguagePreferenceAction(previous)
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: `Switched app language back to ${previous}`,
      after: { language: previous },
    }
  },
})

const setTheme = defineAgentAction<{
  theme: 'dark' | 'light'
  previous: 'dark' | 'light' | null
}>({
  name: 'set_theme',
  domain: 'preference',
  async prepare(ctx, raw) {
    const requested = asString(raw.theme).toLowerCase()
    if (requested !== 'dark' && requested !== 'light') {
      return fail('Dark mode or light mode?')
    }

    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('theme_preference')
      .eq('id', ctx.userId)
      .maybeSingle()

    const previous =
      profile?.theme_preference === 'dark' || profile?.theme_preference === 'light'
        ? profile.theme_preference
        : null
    if (previous === requested) {
      return fail(`You are already on the ${requested} theme.`)
    }

    return {
      ok: true,
      args: { theme: requested, previous },
      before: { theme: previous },
      preview: {
        title: `Switch to the ${requested} theme`,
        changes: [
          `Sets the app appearance to ${requested}`,
          previous
            ? `Currently ${previous}`
            : 'Currently following your system setting',
        ],
        undoable: true,
        confirmLabel: `Use ${requested} theme`,
      },
    }
  },
  async execute(_ctx, prepared) {
    // Same write path as Settings: profile theme + auth metadata appearance.
    // updateThemePreferenceAction alone leaves localStorage / ThemeProvider on
    // the old mode, so the athlete sees no change after Confirm.
    const result = await updateAppearanceAction(prepared.args.theme)
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: `Switched to the ${prepared.args.theme} theme`,
      after: { theme: prepared.args.theme },
      href: '/dashboard/settings',
    }
  },
  async undo(_ctx, input) {
    const previous = (input.before as { theme?: string | null } | null)?.theme
    if (previous !== 'dark' && previous !== 'light') {
      // Restore "follow system" when that was the prior mode.
      const result = await updateAppearanceAction('system')
      if (!result.ok) return fail(result.error)
      return {
        ok: true,
        summary: 'Restored system appearance',
        after: { theme: null },
      }
    }
    const result = await updateAppearanceAction(previous)
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: `Switched back to the ${previous} theme`,
      after: { theme: previous },
    }
  },
})

async function loadNotificationPreferences(
  userId: string,
): Promise<NotificationPreferences | null> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('notification_preferences')
    .eq('id', userId)
    .maybeSingle()
  if (!profile) return null
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...((profile.notification_preferences ?? {}) as Partial<NotificationPreferences>),
  }
}

const setNotificationPreference = defineAgentAction<{
  next: NotificationPreferences
  changed: string[]
}>({
  name: 'set_notification_preferences',
  domain: 'preference',
  async prepare(ctx, raw) {
    const current = await loadNotificationPreferences(ctx.userId)
    if (!current) return fail('Could not load your notification settings.')

    // Accept either a single { key, enabled } pair, a partial map, or a prior
    // prepared { next } payload so confirm re-prepare cannot strand the card.
    const patch: Partial<NotificationPreferences> = {}
    if (raw.next && typeof raw.next === 'object') {
      const incoming = raw.next as Record<string, unknown>
      for (const key of NOTIFICATION_KEYS) {
        if (typeof incoming[key] === 'boolean') {
          patch[key] = incoming[key] as boolean
        }
      }
    }
    const singleKey = asString(raw.key) as keyof NotificationPreferences
    if (singleKey && NOTIFICATION_KEYS.includes(singleKey)) {
      if (typeof raw.enabled !== 'boolean') {
        return fail('Should I turn that notification on or off?')
      }
      patch[singleKey] = raw.enabled
    } else if (raw.preferences && typeof raw.preferences === 'object') {
      const incoming = raw.preferences as Record<string, unknown>
      for (const key of NOTIFICATION_KEYS) {
        if (typeof incoming[key] === 'boolean') {
          patch[key] = incoming[key] as boolean
        }
      }
    }

    if (Object.keys(patch).length === 0) {
      return fail(
        `Which notification should I change? Options: ${NOTIFICATION_KEYS.join(', ')}.`,
      )
    }

    const changed: string[] = []
    for (const key of NOTIFICATION_KEYS) {
      const value = patch[key]
      if (value !== undefined && value !== current[key]) {
        changed.push(
          `${value ? 'Turns on' : 'Turns off'} notifications for ${NOTIFICATION_LABELS[key]}`,
        )
      }
    }
    if (changed.length === 0) {
      return fail('Those notification settings are already set that way.')
    }

    return {
      ok: true,
      args: { next: { ...current, ...patch }, changed },
      before: current as unknown as JsonValue,
      preview: {
        title: 'Update notification settings',
        changes: changed,
        undoable: true,
        confirmLabel: 'Update notifications',
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await updateNotificationPreferencesAction(prepared.args.next)
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: `Updated notification settings (${prepared.args.changed.join('; ')})`,
      after: prepared.args.next as unknown as JsonValue,
      href: '/dashboard/settings',
    }
  },
  async undo(_ctx, input) {
    const before = input.before as Partial<NotificationPreferences> | null
    if (!before) return fail('Could not recover your previous notification settings.')
    const result = await updateNotificationPreferencesAction({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...before,
    })
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: 'Restored your previous notification settings',
      after: before as unknown as JsonValue,
    }
  },
})

type PrivacyState = {
  privacy_follow: PrivacyFollow
  privacy_friend_request: PrivacyFriendRequest
  privacy_message: PrivacyMessage
}

const setPrivacy = defineAgentAction<{ next: PrivacyState; changed: string[] }>({
  name: 'set_privacy_settings',
  domain: 'preference',
  async prepare(ctx, raw) {
    const supabase = await createClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('privacy_follow, privacy_friend_request, privacy_message')
      .eq('id', ctx.userId)
      .maybeSingle()
    if (!profile) return fail('Could not load your privacy settings.')

    const current: PrivacyState = {
      privacy_follow: profile.privacy_follow ?? 'everyone',
      privacy_friend_request: profile.privacy_friend_request ?? 'everyone',
      privacy_message: profile.privacy_message ?? 'everyone',
    }

    const follow = asString(raw.follow || (raw.next as { privacy_follow?: string } | undefined)?.privacy_follow).toLowerCase()
    const friendRequest = asString(
      raw.friend_request ||
        (raw.next as { privacy_friend_request?: string } | undefined)
          ?.privacy_friend_request,
    ).toLowerCase()
    const message = asString(
      raw.message ||
        (raw.next as { privacy_message?: string } | undefined)?.privacy_message,
    ).toLowerCase()

    const next: PrivacyState = { ...current }
    if (follow === 'everyone' || follow === 'nobody') {
      next.privacy_follow = follow
    } else if (follow) {
      return fail('Follow privacy can be "everyone" or "nobody".')
    }
    if (friendRequest === 'everyone' || friendRequest === 'nobody') {
      next.privacy_friend_request = friendRequest
    } else if (friendRequest) {
      return fail('Friend-request privacy can be "everyone" or "nobody".')
    }
    if (message === 'everyone' || message === 'friends' || message === 'nobody') {
      next.privacy_message = message
    } else if (message) {
      return fail('Message privacy can be "everyone", "friends", or "nobody".')
    }

    const changed: string[] = []
    if (next.privacy_follow !== current.privacy_follow) {
      changed.push(`Who can follow you: ${current.privacy_follow} to ${next.privacy_follow}`)
    }
    if (next.privacy_friend_request !== current.privacy_friend_request) {
      changed.push(
        `Who can send friend requests: ${current.privacy_friend_request} to ${next.privacy_friend_request}`,
      )
    }
    if (next.privacy_message !== current.privacy_message) {
      changed.push(
        `Who can message you: ${current.privacy_message} to ${next.privacy_message}`,
      )
    }
    if (changed.length === 0) {
      return fail('Those privacy settings are already set that way.')
    }

    return {
      ok: true,
      args: { next, changed },
      before: current as unknown as JsonValue,
      preview: {
        title: 'Update privacy settings',
        changes: changed,
        warning: 'This changes who can reach you across the whole app.',
        undoable: true,
        confirmLabel: 'Update privacy',
      },
    }
  },
  async execute(_ctx, prepared) {
    const result = await updatePrivacySettingsAction(prepared.args.next)
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: `Updated privacy settings (${prepared.args.changed.join('; ')})`,
      after: prepared.args.next as unknown as JsonValue,
      href: '/dashboard/settings',
    }
  },
  async undo(_ctx, input) {
    const before = input.before as PrivacyState | null
    if (!before?.privacy_follow) {
      return fail('Could not recover your previous privacy settings.')
    }
    const result = await updatePrivacySettingsAction(before)
    if (!result.ok) return fail(result.error)
    return {
      ok: true,
      summary: 'Restored your previous privacy settings',
      after: before as unknown as JsonValue,
    }
  },
})

export const PREFERENCE_AGENT_ACTIONS: AnyAgentAction[] = [
  setUnit,
  setLanguage,
  setTheme,
  setNotificationPreference,
  setPrivacy,
]
