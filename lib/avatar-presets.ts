/** Curated fitness avatar presets — assets under /public/avatars/presets. */

export const AVATAR_PRESETS = [
  { id: 'barbell', path: '/avatars/presets/barbell.webp', label: 'Barbell' },
  { id: 'kettlebell', path: '/avatars/presets/kettlebell.webp', label: 'Kettlebell' },
  { id: 'power', path: '/avatars/presets/power.webp', label: 'Power' },
  { id: 'flex', path: '/avatars/presets/flex.webp', label: 'Flex' },
  { id: 'stride', path: '/avatars/presets/stride.webp', label: 'Stride' },
  { id: 'pulse', path: '/avatars/presets/pulse.webp', label: 'Pulse' },
  { id: 'plates', path: '/avatars/presets/plates.webp', label: 'Plates' },
  { id: 'champion', path: '/avatars/presets/champion.webp', label: 'Champion' },
] as const

export type AvatarPresetId = (typeof AVATAR_PRESETS)[number]['id']

const PRESET_PATHS = new Set<string>(AVATAR_PRESETS.map((p) => p.path))

export function isAvatarPresetPath(url: string | null | undefined): boolean {
  if (!url) return false
  return PRESET_PATHS.has(url.trim())
}

/** Placeholder handles assigned at OAuth signup until the user claims a real one. */
export function isTemporaryUsername(username: string | null | undefined): boolean {
  if (!username) return true
  return /^tmp_[a-z0-9_]+$/i.test(username.trim())
}
