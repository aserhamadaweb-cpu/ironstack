import { redirect } from 'next/navigation'
import { OfflineHomeRedirect } from '@/components/offline-home-redirect'
import { SettingsPageClient } from '@/components/settings-page'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
  type PrivacyFollow,
  type PrivacyFriendRequest,
  type PrivacyMessage,
  type ProfileGender,
} from '@/lib/database.types'
import { getProfile, listBodyWeightLogs } from '@/lib/data/queries'
import { getAuthIdentity } from '@/lib/supabase/server'
import type { AppLocale } from '@/lib/i18n'
import type { WeightUnit } from '@/lib/units'

export const metadata = {
  title: 'Settings — IRONSTACK',
  description: 'Units, notifications, privacy, and account settings.',
}

function asPrefs(value: unknown): NotificationPreferences {
  const base = { ...DEFAULT_NOTIFICATION_PREFERENCES }
  if (!value || typeof value !== 'object') return base
  const raw = value as Record<string, unknown>
  for (const key of Object.keys(base) as Array<keyof NotificationPreferences>) {
    if (typeof raw[key] === 'boolean') base[key] = raw[key]
  }
  return base
}

export default async function SettingsPage() {
  const { userId, email } = await getAuthIdentity()
  if (!userId) redirect('/login')

  const [profileResult, weightLogsResult] = await Promise.all([
    getProfile(userId),
    listBodyWeightLogs(userId),
  ])
  const displayName =
    profileResult.data?.display_name || email?.split('@')[0] || 'Athlete'
  const unit = (profileResult.data?.preferred_unit ?? 'kg') as WeightUnit
  const prefs = asPrefs(profileResult.data?.notification_preferences)
  const privacyFollow = (profileResult.data?.privacy_follow ??
    'everyone') as PrivacyFollow
  const privacyFriend = (profileResult.data?.privacy_friend_request ??
    'everyone') as PrivacyFriendRequest
  const privacyMessage = (profileResult.data?.privacy_message ??
    'everyone') as PrivacyMessage
  const language = (profileResult.data?.language === 'ar' ? 'ar' : 'en') as AppLocale
  const gender =
    profileResult.data?.gender === 'male' ||
    profileResult.data?.gender === 'female'
      ? (profileResult.data.gender as ProfileGender)
      : null

  return (
    <OfflineHomeRedirect>

      <SettingsPageClient
        email={email ?? ''}
        preferredUnit={unit}
        notificationPreferences={prefs}
        privacyFollow={privacyFollow}
        privacyFriendRequest={privacyFriend}
        privacyMessage={privacyMessage}
        initialLanguage={language}
        heightCm={
          profileResult.data?.height_cm != null
            ? Number(profileResult.data.height_cm)
            : null
        }
        gender={gender}
        birthDate={profileResult.data?.birth_date ?? null}
        currentWeightKg={
          profileResult.data?.current_weight_kg != null
            ? Number(profileResult.data.current_weight_kg)
            : null
        }
        weightLogs={weightLogsResult.data ?? []}
        isGuest={profileResult.data?.is_guest === true}
      />
    </OfflineHomeRedirect>
  )
}
