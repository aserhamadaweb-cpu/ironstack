import { createClient } from '@/lib/supabase/client'
import { isAlreadyExistsError } from '@/lib/offline/duplicate-error'

export { isAlreadyExistsError }

/**
 * Id-based upsert with an explicit Prefer header.
 * PostgREST ignores `on_conflict` unless Prefer: resolution=merge-duplicates
 * is set; without it, retries become 409s on the row from the first success.
 * HTTP 409 is treated as success — the id is already on the server.
 */
export async function upsertRows(
  table: string,
  rows: Record<string, unknown> | Record<string, unknown>[],
  onConflict = 'id',
): Promise<void> {
  const supabase = createClient()
  const { data: auth } = await supabase.auth.getSession()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Supabase is not configured.')

  const token = auth.session?.access_token
  if (!token) {
    throw new Error('Auth session expired — will retry when online.')
  }
  const res = await fetch(
    `${url.replace(/\/$/, '')}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
    {
      method: 'POST',
      headers: {
        apikey: anon,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(rows),
    },
  )

  if (res.ok || res.status === 409) return

  const text = await res.text()
  let message = text || `Upsert failed (${res.status})`
  let code = String(res.status)
  try {
    const parsed = JSON.parse(text) as { code?: string; message?: string }
    if (parsed.message) message = parsed.message
    if (parsed.code) code = parsed.code
  } catch {
    /* non-JSON body */
  }
  const err = Object.assign(new Error(message), { code, status: res.status })
  if (isAlreadyExistsError(err)) return
  throw err
}
