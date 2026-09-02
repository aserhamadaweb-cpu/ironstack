import { getCachedSplits, getCachedUserId } from '@/lib/offline/cache'

export type CachedUserSplit = {
  id: string
  slug: string
  name: string
  days: number
}

/** Splits the signed-in user owns — excludes platform/system programs. */
export function filterCachedUserSplits(
  rows: Awaited<ReturnType<typeof getCachedSplits>>,
  userId: string | null | undefined,
): CachedUserSplit[] {
  if (!userId) return []
  return rows
    .filter((row) => row.row.user_id === userId && !row.row.is_system)
    .map((row) => ({
      id: row.id,
      slug: row.detail.slug,
      name: row.detail.name,
      days: row.detail.daysPerWeek,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export async function listCachedUserSplits(): Promise<CachedUserSplit[]> {
  const [rows, uid] = await Promise.all([
    getCachedSplits().catch(() => []),
    getCachedUserId().catch(() => null),
  ])
  return filterCachedUserSplits(rows, uid)
}
