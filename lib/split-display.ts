import type { Split } from '@/lib/database.types'

/** Most recently saved = updated_at, fallback created_at. */
export function splitSavedTimestamp(split: Pick<Split, 'updated_at' | 'created_at'>) {
  return split.updated_at || split.created_at
}

export function sortSplitsByRecentSaved<T extends Pick<Split, 'updated_at' | 'created_at'>>(
  splits: T[],
): T[] {
  return [...splits].sort(
    (a, b) =>
      new Date(splitSavedTimestamp(b)).getTime() -
      new Date(splitSavedTimestamp(a)).getTime(),
  )
}

export function formatSplitSavedDate(
  split: Pick<Split, 'updated_at' | 'created_at'>,
  locale: 'en' | 'ar' = 'en',
) {
  const iso = splitSavedTimestamp(split)
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso))
}
