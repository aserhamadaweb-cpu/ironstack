/**
 * Focused auth audit: signup session, duplicate, weak password, bad sign-in.
 * Cleans up throwaway users. Does not modify schema or existing user data permanently.
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
const app = process.env.APP_ORIGIN || 'http://localhost:3000'

const client = createClient(url, anon, {
  auth: { autoRefreshToken: false, persistSession: false },
})
const admin = createClient(url, service, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
function pass(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(ok ? 'PASS' : 'FAIL', name, detail)
}

const email = `audit-${Date.now()}@example.com`
const password = `Good-${Math.random().toString(36).slice(2)}-Aa1!`
let userId = null

// 1) Immediate signup
{
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { onboarding_completed: false, onboarding_step: 1 },
    },
  })
  userId = data.user?.id ?? null
  pass(
    'signup_immediate_session',
    !error && Boolean(data.session?.user?.id),
    error?.message || '',
  )
}

// 2) Duplicate signup
{
  const { data, error } = await client.auth.signUp({ email, password })
  const identities = data.user?.identities ?? []
  const duplicate =
    Boolean(error?.message?.toLowerCase().includes('already')) ||
    (data.user && identities.length === 0) ||
    !data.session
  pass('signup_duplicate_handled', duplicate, error?.message || 'no session / empty identities')
}

// 3) Weak password
{
  const { error } = await client.auth.signUp({
    email: `weak-${Date.now()}@example.com`,
    password: '123',
  })
  pass('signup_weak_password', Boolean(error), error?.message || '')
}

// 4) Sign-in correct
{
  await client.auth.signOut()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  pass('signin_ok', !error && Boolean(data.session), error?.message || '')
}

// 5) Sign-in wrong password
{
  const { error } = await client.auth.signInWithPassword({
    email,
    password: 'WrongPassword123!',
  })
  pass('signin_bad_password', Boolean(error), error?.code || error?.message || '')
}

// 6) Routes still present
for (const path of [
  '/login',
  '/auth/callback',
  '/auth/finalize',
  '/auth/error',
]) {
  try {
    const res = await fetch(`${app}${path}`, { redirect: 'manual' })
    const ok = res.status === 200 || (res.status >= 300 && res.status < 400)
    pass(`route_${path}`, ok, String(res.status))
  } catch (e) {
    pass(`route_${path}`, false, String(e))
  }
}

if (userId) await admin.auth.admin.deleteUser(userId)

const failed = results.filter((r) => !r.ok)
console.log(failed.length === 0 ? 'AUDIT_OK' : 'AUDIT_FAIL')
process.exit(failed.length === 0 ? 0 : 1)
