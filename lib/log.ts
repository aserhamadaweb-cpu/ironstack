/** True when Supabase/Next could not reach the network (expected while offline). */
export function isNetworkFailure(err: unknown): boolean {
  const message =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err ?? '')
  return /fetch failed|failed to fetch|networkerror|network request failed|load failed|err_internet|err_name_not_resolved|could not reach the server/i.test(
    message,
  )
}

/**
 * Log unexpected server errors only.
 * Network failures while offline must not use console.error — Next.js
 * surfaces those as blocking overlays in development.
 */
export function logServerError(scope: string, err: unknown) {
  if (isNetworkFailure(err)) return
  console.error(scope, err)
}
