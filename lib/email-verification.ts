import type { SupabaseClient } from '@supabase/supabase-js'

/** Kept for a future Confirm-email / verified-domain rollout. Not used in signup while Confirm email is off. */

export async function sendVerificationCode(supabase: SupabaseClient) {
  const { data, error } = await supabase.functions.invoke(
    'send-verification-email',
  )
  if (error) {
    throw new Error(await resolveFunctionsErrorMessage(error, data))
  }
  return data
}

export async function verifyEmailCode(
  supabase: SupabaseClient,
  code: string,
) {
  const { data, error } = await supabase.functions.invoke('verify-email-code', {
    body: { code },
  })
  if (error) {
    throw new Error(await resolveFunctionsErrorMessage(error, data))
  }
  return data
}

async function resolveFunctionsErrorMessage(
  error: { message: string; context?: unknown },
  data: unknown,
): Promise<string> {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    if (typeof record.error === 'string' && record.error) return record.error
    if (typeof record.message === 'string' && record.message) return record.message
  }

  const context = error.context
  if (context && typeof Response !== 'undefined' && context instanceof Response) {
    try {
      const body = (await context.clone().json()) as Record<string, unknown>
      if (typeof body.error === 'string' && body.error) return body.error
      if (typeof body.message === 'string' && body.message) return body.message
    } catch {
      /* ignore parse errors */
    }
  }

  return error.message
}

/** True only when the profile row explicitly marks email as verified. */
export async function fetchIsEmailVerified(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('is_email_verified')
    .eq('id', userId)
    .maybeSingle()

  return data?.is_email_verified === true
}
