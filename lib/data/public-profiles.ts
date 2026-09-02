import type { PublicProfile } from '@/lib/database.types'
import { PUBLIC_PROFILE_COLUMNS } from '@/lib/database.types'
import { isProfileUserIdParam } from '@/lib/profile-path'

/** Live Supabase view created for social / leaderboard-safe reads. */
export const PUBLIC_PROFILES_VIEW = 'public_profiles' as const

export type PublicProfileLite = Pick<
  PublicProfile,
  'id' | 'username' | 'display_name' | 'avatar_url'
>

export function friendlyPublicProfileError(
  fallback: string,
  message?: string | null,
) {
  const lower = (message ?? '').toLowerCase()
  if (
    lower.includes('permission denied') ||
    lower.includes('42501') ||
    lower.includes('not authenticated') ||
    lower.includes('jwt')
  ) {
    return 'Sign in to view athlete profiles.'
  }
  if (lower.includes('not found') || lower.includes('pgrst116')) {
    return 'Profile not found.'
  }
  return fallback
}

/** Accepts the app Supabase client without fighting PostgREST generics. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = { from: (relation: string) => any }

export async function fetchPublicProfilesByIds(
  supabase: AnySupabase,
  ids: string[],
): Promise<{ data: PublicProfile[]; error: string | null }> {
  const unique = [...new Set(ids.filter(Boolean))]
  if (unique.length === 0) return { data: [], error: null }

  const { data, error } = await supabase
    .from(PUBLIC_PROFILES_VIEW)
    .select(PUBLIC_PROFILE_COLUMNS)
    .in('id', unique)

  if (error) {
    return {
      data: [],
      error: friendlyPublicProfileError(
        'Could not load profiles.',
        error.message,
      ),
    }
  }

  return { data: (data ?? []) as PublicProfile[], error: null }
}

export async function fetchPublicProfileByUsernameOrId(
  supabase: AnySupabase,
  usernameOrId: string,
): Promise<{ data: PublicProfile | null; error: string | null }> {
  const raw = usernameOrId.trim()
  if (!raw) return { data: null, error: 'Profile not found.' }

  const query = isProfileUserIdParam(raw)
    ? supabase
        .from(PUBLIC_PROFILES_VIEW)
        .select(PUBLIC_PROFILE_COLUMNS)
        .eq('id', raw)
        .maybeSingle()
    : supabase
        .from(PUBLIC_PROFILES_VIEW)
        .select(PUBLIC_PROFILE_COLUMNS)
        .eq('username', raw.toLowerCase())
        .maybeSingle()

  const { data, error } = await query
  if (error) {
    return {
      data: null,
      error: friendlyPublicProfileError(
        'Could not load this profile.',
        error.message,
      ),
    }
  }
  return { data: (data as PublicProfile | null) ?? null, error: null }
}
