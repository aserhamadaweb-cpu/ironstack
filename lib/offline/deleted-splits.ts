import { getOfflineDb } from '@/lib/offline/db'

const META_DELETED_SPLITS = 'deletedSplitIds'

export async function getDeletedSplitIds(): Promise<Set<string>> {
  const db = await getOfflineDb()
  const value = await db.get('meta', META_DELETED_SPLITS)
  return new Set(
    Array.isArray(value)
      ? value.filter((id): id is string => typeof id === 'string')
      : [],
  )
}

export async function rememberDeletedSplit(splitId: string) {
  const db = await getOfflineDb()
  const ids = await getDeletedSplitIds()
  ids.add(splitId)
  await db.put('meta', [...ids], META_DELETED_SPLITS)
}
