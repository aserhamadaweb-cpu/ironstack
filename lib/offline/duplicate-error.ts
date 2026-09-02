/** PostgREST / Postgres duplicate-key responses for an id we already wrote. */
export function isAlreadyExistsError(error: unknown): boolean {
  if (error == null) return false
  const err = error as {
    code?: string | number
    status?: number
    message?: string
  }
  const code = String(err.code ?? '')
  const status = Number(err.status ?? 0)
  const message = String(
    err.message ?? (error instanceof Error ? error.message : error),
  ).toLowerCase()
  return (
    status === 409 ||
    code === '409' ||
    code === '23505' ||
    message.includes('duplicate key') ||
    message.includes('unique constraint') ||
    message.includes('already exists') ||
    (message.includes('conflict') &&
      (message.includes('409') || code === '23505'))
  )
}
