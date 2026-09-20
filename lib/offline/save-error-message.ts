import type { SaveOfflineErrorCode } from '@/lib/offline/offline-splits'

/** Map save-offline failure codes to user-facing copy. */
export function offlineSaveErrorMessage(
  t: (key: string) => string,
  result: { error: string; code?: SaveOfflineErrorCode },
): string {
  switch (result.code) {
    case 'quota':
      return t('offlineSaveQuota')
    case 'media':
      return t('offlineSaveMediaFailed')
    case 'offline':
      return t('splitRequiresConnection')
    case 'generic':
      return t('offlineSaveInterrupted')
    default:
      return result.error || t('offlineSaveFailed')
  }
}
