export function finalizeRedirect(next: string) {
  return `/auth/finalize?next=${encodeURIComponent(next)}`
}
