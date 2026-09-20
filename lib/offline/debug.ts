/** Debug trail for offline session/split sync. Filter DevTools console with `ironstack-offline`. */
const PREFIX = '[ironstack-offline]'

const enabled =
  typeof process !== 'undefined' && process.env.NODE_ENV === 'development'

export function offlineLog(
  event: string,
  details?: Record<string, unknown>,
) {
  if (!enabled || typeof console === 'undefined') return
  console.info(PREFIX, event, details ?? {})
}

export function offlineWarn(
  event: string,
  details?: Record<string, unknown>,
) {
  if (!enabled || typeof console === 'undefined') return
  console.warn(PREFIX, event, details ?? {})
}
