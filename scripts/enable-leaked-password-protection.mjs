/**
 * Enable Supabase Auth leaked-password protection (HaveIBeenPwned / HIBP).
 *
 * Same Management API pattern as scripts/configure-supabase-smtp.mjs —
 * you run this locally with your own access token (never paste the token in chat).
 *
 * Prerequisites:
 *   1. Supabase Personal Access Token (Owner/Admin) from
 *      https://supabase.com/dashboard/account/tokens
 *   2. Project must be on Pro (or above) — HIBP is a paid Auth entitlement.
 *      https://supabase.com/docs/guides/auth/password-security
 *
 * Usage (PowerShell):
 *   $env:SUPABASE_ACCESS_TOKEN="sbp_..."
 *   node scripts/enable-leaked-password-protection.mjs
 *
 * Optional:
 *   --dry-run     Print current value + intended PATCH without applying
 *   --disable     Turn protection OFF (not recommended for production)
 */
const PROJECT_REF = 'jasxefogqpqkpzgjcxht'
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`

const args = new Set(process.argv.slice(2))
const dryRun = args.has('--dry-run')
const disable = args.has('--disable')
const enable = !disable

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
if (!token) {
  console.error('Missing SUPABASE_ACCESS_TOKEN.')
  console.error('Create one at https://supabase.com/dashboard/account/tokens')
  process.exit(1)
}

async function main() {
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const before = await fetch(API, { headers })
  if (!before.ok) {
    console.error('GET auth config failed:', before.status, await before.text())
    process.exit(1)
  }
  const current = await before.json()
  console.log(
    'Current password_hibp_enabled:',
    current.password_hibp_enabled ?? '(unset / false)',
  )

  const patchBody = { password_hibp_enabled: enable }
  console.log(
    enable
      ? 'Will ENABLE leaked password protection (HaveIBeenPwned).'
      : 'Will DISABLE leaked password protection.',
  )

  if (dryRun) {
    console.log('\nDry run — would PATCH:')
    console.log(JSON.stringify(patchBody, null, 2))
    return
  }

  const res = await fetch(API, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(patchBody),
  })
  const text = await res.text()
  if (!res.ok) {
    console.error('PATCH failed:', res.status, text)
    if (res.status === 403 || /entitlement|plan|pro/i.test(text)) {
      console.error(
        '\nHint: Leaked password protection requires Supabase Pro (or above).',
      )
      console.error(
        'Upgrade the project, or enable the toggle in Dashboard → Authentication → Passwords.',
      )
    }
    process.exit(1)
  }

  let updated = null
  try {
    updated = JSON.parse(text)
  } catch {
    /* ignore */
  }
  console.log('\nAuth password config updated.')
  console.log(
    'password_hibp_enabled:',
    updated?.password_hibp_enabled ?? enable,
  )
  console.log(
    'New / changed passwords will be checked against HaveIBeenPwned (k-anonymity).',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
