/** Parse a builder/home-workout reps or duration string into numeric targets. */
export function parseTargetReps(reps: string | null | undefined): {
  min: number | null
  max: number | null
} {
  if (!reps?.trim()) return { min: null, max: null }
  const nums = reps.match(/\d+/g)
  if (!nums?.length) return { min: null, max: null }
  const min = Number(nums[0])
  const max = nums.length > 1 ? Number(nums[1]) : min
  if (!Number.isFinite(min) || min < 0) return { min: null, max: null }
  if (!Number.isFinite(max) || max < 0) return { min, max: min }
  return { min, max: Math.max(min, max) }
}

export function formatTargetReps(
  min: number | null | undefined,
  max: number | null | undefined,
  fallback = '8–12',
): string {
  if (min == null && max == null) return fallback
  const lo = min ?? max
  const hi = max ?? min
  if (lo == null || hi == null) return fallback
  if (lo === hi) return String(lo)
  return `${lo}–${hi}`
}
