/** Prefix for structured split-share payloads embedded in DM / group message text. */
export const SPLIT_SHARE_PREFIX = 'ironstack:split-share:v1'

export type SplitSharePayload = {
  v: 1
  splitId: string
  shareToken: string
  name: string
  daysPerWeek: number
  category: string | null
  exerciseCount: number
  note?: string
}

export function encodeSplitShareMessage(payload: SplitSharePayload): string {
  return `${SPLIT_SHARE_PREFIX}${JSON.stringify(payload)}`
}

export function parseSplitShareMessage(
  content: string,
): SplitSharePayload | null {
  const trimmed = content.trim()
  if (!trimmed.startsWith(SPLIT_SHARE_PREFIX)) return null
  try {
    const raw = JSON.parse(trimmed.slice(SPLIT_SHARE_PREFIX.length)) as unknown
    if (!raw || typeof raw !== 'object') return null
    const row = raw as Record<string, unknown>
    if (row.v !== 1) return null
    if (typeof row.splitId !== 'string' || !row.splitId.trim()) return null
    if (typeof row.shareToken !== 'string' || !row.shareToken.trim()) return null
    if (typeof row.name !== 'string') return null
    if (typeof row.daysPerWeek !== 'number') return null
    if (row.category !== null && typeof row.category !== 'string') return null
    if (typeof row.exerciseCount !== 'number') return null
    if (row.note !== undefined && typeof row.note !== 'string') return null
    return {
      v: 1,
      splitId: row.splitId,
      shareToken: row.shareToken,
      name: row.name,
      daysPerWeek: row.daysPerWeek,
      category: row.category as string | null,
      exerciseCount: row.exerciseCount,
      note: typeof row.note === 'string' ? row.note : undefined,
    }
  } catch {
    return null
  }
}

export function splitShareInboxPreview(content: string): string | null {
  const payload = parseSplitShareMessage(content)
  if (!payload) return null
  return payload.name
}
