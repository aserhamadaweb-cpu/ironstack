import {
  listOfflineSavedSplits,
  listOfflineUserSplitsForStart,
  type OfflineSavedSplit,
} from '@/lib/offline/offline-splits'
import { OFFLINE_CHANGED_EVENT } from '@/lib/offline/session-store'

export type CachedUserSplit = OfflineSavedSplit

/**
 * Splits explicitly saved for offline (pin set).
 * Not "whatever happened to be auto-cached."
 */
export async function listCachedUserSplits(): Promise<CachedUserSplit[]> {
  return listOfflineSavedSplits()
}

/**
 * Offline Start Session: splits saved for offline (pins only).
 */
export async function listStartableOfflineSplits(): Promise<CachedUserSplit[]> {
  return listOfflineUserSplitsForStart()
}

/** Subscribe to offline cache/session changes for split pickers. */
export function subscribeOfflineCacheChanged(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(OFFLINE_CHANGED_EVENT, onChange)
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  return () => {
    window.removeEventListener(OFFLINE_CHANGED_EVENT, onChange)
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
  }
}
