/**
 * Verifies personal_records UPDATE RLS (demote is_current_pr) and optionally
 * applies fix-personal-records-update-rls.sql via Supabase Management API.
 *
 * Usage:
 *   node scripts/verify-pr-demote-rls.mjs
 *   node scripts/verify-pr-demote-rls.mjs --apply-migration
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const applyMigration = process.argv.includes('--apply-migration')

function loadEnv() {
  return Object.fromEntries(
    readFileSync(join(root, '.env.local'), 'utf8')
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const i = line.indexOf('=')
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
      }),
  )
}

async function applySqlViaManagementApi(env, sql) {
  const ref = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]
  const token =
    process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT || ''
  if (!token) {
    return { ok: false, reason: 'SUPABASE_ACCESS_TOKEN not set (run supabase login)' }
  }
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  )
  const text = await res.text()
  if (!res.ok) {
    return { ok: false, reason: `${res.status} ${text}` }
  }
  return { ok: true, body: text }
}

async function userCanDemoteOwnPr(userClient, admin, userId) {
  const { data: lift, error: liftError } = await admin
    .from('lift_types')
    .select('id, name')
    .limit(1)
    .single()
  if (liftError || !lift) {
    throw new Error(liftError?.message || 'No lift_types row found')
  }

  const { data: prRow, error: insErr } = await userClient
    .from('personal_records')
    .insert({
      user_id: userId,
      lift_type_id: lift.id,
      lift_name: lift.name,
      weight: 100,
      reps: 5,
      is_current_pr: true,
    })
    .select('id, is_current_pr')
    .single()

  if (insErr || !prRow) {
    throw new Error(insErr?.message || 'Insert test PR failed')
  }

  const { data: upd, error: updErr } = await userClient
    .from('personal_records')
    .update({ is_current_pr: false })
    .eq('id', prRow.id)
    .select('id, is_current_pr')

  const { data: check } = await admin
    .from('personal_records')
    .select('is_current_pr')
    .eq('id', prRow.id)
    .single()

  const demoteOk =
    !updErr &&
    Array.isArray(upd) &&
    upd.length === 1 &&
    upd[0].is_current_pr === false &&
    check?.is_current_pr === false

  if (!demoteOk) {
    await admin.from('personal_records').delete().eq('id', prRow.id)
    return {
      works: false,
      updateError: updErr?.message ?? null,
      updateRows: upd ?? [],
      adminCheck: check,
    }
  }

  // finishSessionAction pattern: demote existing, then insert new current PR for same lift
  const { data: newPr, error: newInsErr } = await userClient
    .from('personal_records')
    .insert({
      user_id: userId,
      lift_type_id: lift.id,
      lift_name: lift.name,
      weight: 120,
      reps: 3,
      is_current_pr: true,
    })
    .select('id')
    .single()

  const { data: currentRows } = await admin
    .from('personal_records')
    .select('id, is_current_pr')
    .eq('user_id', userId)
    .eq('lift_type_id', lift.id)
    .eq('is_current_pr', true)

  await admin.from('personal_records').delete().eq('user_id', userId)

  const singleCurrent =
    !newInsErr &&
    Array.isArray(currentRows) &&
    currentRows.length === 1 &&
    currentRows[0].id === newPr?.id

  return {
    works: singleCurrent,
    updateError: updErr?.message ?? null,
    updateRows: upd ?? [],
    adminCheck: check,
    demoteInsertOk: singleCurrent,
    currentPrCount: currentRows?.length ?? 0,
    insertError: newInsErr?.message ?? null,
  }
}

async function main() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
  const admin = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  if (applyMigration) {
    const sql = readFileSync(
      join(root, 'supabase/fix-personal-records-update-rls.sql'),
      'utf8',
    )
    const applied = await applySqlViaManagementApi(env, sql)
    if (!applied.ok) {
      console.error('Could not apply migration via Management API:', applied.reason)
      console.error(
        'Run supabase/fix-personal-records-update-rls.sql in the SQL editor, then re-run this script.',
      )
      process.exit(1)
    }
    console.log('Applied fix-personal-records-update-rls.sql')
  }

  const email = `pr-rls-verify+${Date.now()}@ironstack.test`
  const password = 'TestPass123!xyz'
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (createErr || !created.user) {
    throw new Error(createErr?.message || 'createUser failed')
  }
  const userId = created.user.id

  await admin.from('profiles').upsert({
    id: userId,
    username: `prtest${Date.now().toString(36)}`,
    display_name: 'PR Test',
  })

  const userClient = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: signErr } = await userClient.auth.signInWithPassword({
    email,
    password,
  })
  if (signErr) throw new Error(signErr.message)

  const result = await userCanDemoteOwnPr(userClient, admin, userId)
  await admin.auth.admin.deleteUser(userId)

  console.log(JSON.stringify({ updatePolicyWorks: result.works, ...result }, null, 2))

  if (!result.works) {
    console.error(
      '\nUPDATE policy missing or ineffective. Apply supabase/fix-personal-records-update-rls.sql then re-run.',
    )
    process.exit(1)
  }

  console.log(
    '\nPASS: demote + insert leaves exactly one is_current_pr row per lift.',
  )
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
