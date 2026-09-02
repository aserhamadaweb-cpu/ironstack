/** Debug trail for offline session/split sync. Filter DevTools console with `ironstack-offline`. */
const PREFIX = '[ironstack-offline]'

export function offlineLog(
  event: string,
  details?: Record<string, unknown>,
) {
  if (typeof console === 'undefined') return
  console.info(PREFIX, event, details ?? {})
}

export function offlineWarn(
  event: string,
  details?: Record<string, unknown>,
) {
  if (typeof console === 'undefined') return
  console.warn(PREFIX, event, details ?? {})
}
