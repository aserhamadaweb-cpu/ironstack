/**
 * Verify email/password sign-up returns an immediate session (Confirm email OFF).
 * Creates then deletes a throwaway user. Service role only in this script.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv() {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return env
}

const env = loadEnv()
const url = env.NEXT_PUBLIC_SUPABASE_URL
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !anon || !service) {
  console.error('Missing Supabase env')
  process.exit(1)
}

const settings = await fetch(`${url}/auth/v1/settings`, {
  headers: { apikey: anon, Authorization: `Bearer ${anon}` },
}).then((r) => r.json())

console.log('mailer_autoconfirm', settings.mailer_autoconfirm === true)

const client = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const email = `signup-now-${Date.now()}@example.com`
const password = `Test-${Math.random().toString(36).slice(2)}-Aa1!`

const { data, error } = await client.auth.signUp({
  email,
  password,
  options: {
    data: {
      display_name: 'signup-now',
      onboarding_completed: false,
      onboarding_step: 1,
    },
  },
})

if (error) {
  console.error('signUp error', error.message, error.code)
  process.exit(2)
}

const identities = data.user?.identities ?? []
const hasSession = Boolean(data.session?.access_token && data.session?.user?.id)
console.log('user_id', data.user?.id ? 'present' : 'missing')
console.log('identities', identities.length)
console.log('session', hasSession)

if (data.user?.id) {
  await admin.auth.admin.deleteUser(data.user.id)
}

const ok = settings.mailer_autoconfirm === true && hasSession && identities.length > 0
console.log(ok ? 'PROOF_OK' : 'PROOF_FAIL')
process.exit(ok ? 0 : 3)
