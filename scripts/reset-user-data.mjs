/**
 * IronStack user-data reset — audit + wipe (service role).
 *
 * PRESERVE: lift_types (catalog), system splits (is_system=true),
 *           achievements catalog, schema/RLS/auth config.
 * DELETE:   all auth.users (cascades profiles + user-owned rows),
 *           user-owned splits, custom non-system lift_types if any,
 *           orphan cleanup where needed.
 *
 * Usage:
 *   node scripts/reset-user-data.mjs --audit
 *   node scripts/reset-user-data.mjs --execute
 *   node scripts/reset-user-data.mjs --verify
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadEnv() {
  const raw = readFileSync(join(root, '.env.local'), 'utf8')
  return Object.fromEntries(
    raw
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
      }),
  )
}

const env = loadEnv()
const url = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '')
const key = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** Tables we expect from app code + SQL; OpenAPI may list more. */
const KNOWN_USER_TABLES = [
  'profiles',
  'body_weight_logs',
  'lift_logs',
  'personal_records',
  'sessions',
  'splits',
  'split_days',
  'split_day_exercises',
  'friendships',
  'followers',
  'dm_threads',
  'dm_messages',
  'notifications',
  'push_subscriptions',
  'ai_conversations',
  'ai_messages',
  'ai_celebrations',
  'ai_insights',
  'ai_user_memory',
  'challenges',
  'user_achievements',
  'group_chats',
  'group_chat_members',
  'group_messages',
]

const VIEW_NAMES = new Set(['current_prs', 'leaderboard'])

const PRESERVE_ALWAYS = new Set([
  'lift_types',
  'achievements',
  // views — not deleted
  'current_prs',
  'leaderboard',
])

async function listOpenApiTables() {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: 'application/openapi+json',
    },
  })
  if (!res.ok) throw new Error(`OpenAPI ${res.status}`)
  const openapi = await res.json()
  const defs = openapi.definitions || openapi.components?.schemas || {}
  return Object.keys(defs)
    .filter((n) => !n.includes(' ') && /^[a-z][a-z0-9_]*$/i.test(n))
    .sort()
}

async function countTable(table, filterFn) {
  let q = sb.from(table).select('*', { count: 'exact', head: true })
  if (filterFn) q = filterFn(q)
  const { count, error } = await q
  if (error) return { error: error.message, count: null }
  return { count, error: null }
}

async function listAllAuthUsers() {
  const all = []
  let page = 1
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({
      page,
      perPage: 200,
    })
    if (error) throw new Error(error.message)
    const batch = data.users || []
    all.push(...batch)
    const total = data.total ?? all.length
    if (batch.length === 0 || all.length >= total) break
    page += 1
    if (page > 100) break
  }
  return all
}

async function audit() {
  const openapiTables = await listOpenApiTables()
  const tableSet = new Set([
    ...openapiTables,
    ...KNOWN_USER_TABLES,
    ...PRESERVE_ALWAYS,
  ])
  const counts = {}
  for (const table of [...tableSet].sort()) {
    counts[table] = await countTable(table)
  }

  const users = await listAllAuthUsers()
  const providers = users.reduce((acc, u) => {
    const p =
      u.app_metadata?.provider ||
      u.identities?.[0]?.provider ||
      (u.is_anonymous ? 'anonymous' : 'unknown')
    acc[p] = (acc[p] || 0) + 1
    return acc
  }, {})

  const special = {
    lift_types_system: await countTable('lift_types', (q) => q.eq('is_system', true)),
    lift_types_custom: await countTable('lift_types', (q) => q.eq('is_system', false)),
    splits_system: await countTable('splits', (q) => q.eq('is_system', true)),
    splits_user_owned: await countTable('splits', (q) => q.not('user_id', 'is', null)),
    splits_null_user: await countTable('splits', (q) => q.is('user_id', null)),
    group_chats_global: await countTable('group_chats', (q) => q.eq('is_global', true)),
    group_chats_user: await countTable('group_chats', (q) => q.eq('is_global', false)),
  }

  const report = {
    generatedAt: new Date().toISOString(),
    authUsers: users.length,
    providers,
    anonymous: users.filter((u) => u.is_anonymous).length,
    openapiTables,
    counts,
    special,
    plan: {
      method:
        'Delete all auth.users via Admin API (deleteUser). profiles ON DELETE CASCADE from auth.users clears most user rows. Explicitly delete user-owned splits (and cascade days/exercises) before or rely on profile cascade if splits.user_id → profiles. Preserve lift_types and system splits.',
      preserve: [
        'lift_types (all catalog rows / UUIDs)',
        'splits where is_system = true',
        'achievements catalog rows (if any)',
        'schema, RLS, triggers, functions, auth/OAuth config',
      ],
      delete: [
        'auth.users (all including anonymous/OAuth/email)',
        'profiles and all CASCADE dependents',
        'user-owned splits (user_id not null / is_system false)',
        'non-global group chats owned by users',
        'custom lift_types is_system=false only if present after cascade',
      ],
    },
  }

  mkdirSync(join(root, 'scripts'), { recursive: true })
  writeFileSync(
    join(root, 'scripts/_reset-audit-pre.json'),
    JSON.stringify(report, null, 2),
  )
  console.log(JSON.stringify(report, null, 2))
  return report
}

async function snapshotLiftTypeIds() {
  const ids = []
  let from = 0
  const page = 1000
  for (;;) {
    const { data, error } = await sb
      .from('lift_types')
      .select('id')
      .order('id')
      .range(from, from + page - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    ids.push(...data.map((r) => r.id))
    if (data.length < page) break
    from += page
  }
  return ids.sort()
}

async function clearEmailVerificationCodes() {
  const { count: before } = await sb
    .from('email_verification_codes')
    .select('*', { count: 'exact', head: true })
  if (before == null) return { before: 0, deleted: 0 }
  // Delete all rows — table is user-owned verification state.
  const { error } = await sb
    .from('email_verification_codes')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) {
    // Some schemas use different PK; try delete with gte on created_at if present
    const { error: err2 } = await sb
      .from('email_verification_codes')
      .delete()
      .gte('created_at', '1970-01-01')
    if (err2) throw new Error(`email_verification_codes: ${error.message} / ${err2.message}`)
  }
  const { count: after } = await sb
    .from('email_verification_codes')
    .select('*', { count: 'exact', head: true })
  return { before: before ?? 0, deleted: (before ?? 0) - (after ?? 0), after: after ?? 0 }
}

async function deleteUserOwnedSplits() {
  // System splits must remain. Delete user-owned first (children cascade from split).
  const { data: userSplits, error } = await sb
    .from('splits')
    .select('id, is_system, user_id')
    .or('is_system.eq.false,user_id.not.is.null')
  if (error) throw new Error(`list splits: ${error.message}`)

  const toDelete = (userSplits || []).filter(
    (s) => s.is_system !== true && s.user_id != null,
  )
  const ids = toDelete.map((s) => s.id)
  console.log(`Deleting ${ids.length} user-owned splits…`)
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const { error: delErr } = await sb.from('splits').delete().in('id', chunk)
    if (delErr) throw new Error(`delete splits: ${delErr.message}`)
  }
  return ids.length
}

async function deleteNonGlobalGroupChats() {
  const { data, error } = await sb
    .from('group_chats')
    .select('id, is_global')
    .eq('is_global', false)
  if (error) {
    if (/relation|does not exist|Could not find/i.test(error.message)) {
      console.log('group_chats skip:', error.message)
      return 0
    }
    throw new Error(error.message)
  }
  const ids = (data || []).map((r) => r.id)
  console.log(`Deleting ${ids.length} non-global group chats…`)
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    const { error: delErr } = await sb.from('group_chats').delete().in('id', chunk)
    if (delErr) throw new Error(`delete group_chats: ${delErr.message}`)
  }
  return ids.length
}

async function deleteCustomLiftTypes() {
  // Only non-system. Catalog (is_system true) stays. Requires no remaining FK refs.
  const { data, error } = await sb
    .from('lift_types')
    .select('id')
    .eq('is_system', false)
  if (error) throw new Error(error.message)
  const ids = (data || []).map((r) => r.id)
  if (!ids.length) return 0
  console.log(`Deleting ${ids.length} custom lift_types…`)
  const { error: delErr } = await sb.from('lift_types').delete().eq('is_system', false)
  if (delErr) throw new Error(`delete custom lift_types: ${delErr.message}`)
  return ids.length
}

async function clearAllUserOwnedRows(ids) {
  if (!ids.length) return []
  const results = []
  const { data: convs } = await sb
    .from('ai_conversations')
    .select('id')
    .in('user_id', ids)
  const convIds = (convs || []).map((c) => c.id)
  if (convIds.length) {
    const { error, count } = await sb
      .from('ai_messages')
      .delete({ count: 'exact' })
      .in('conversation_id', convIds)
    results.push({ table: 'ai_messages', count, error: error?.message })
  }
  for (const [table, col] of [
    ['ai_conversations', 'user_id'],
    ['ai_celebrations', 'user_id'],
    ['ai_insights', 'user_id'],
    ['ai_user_memory', 'user_id'],
    ['lift_logs', 'user_id'],
    ['personal_records', 'user_id'],
    ['sessions', 'user_id'],
    ['body_weight_logs', 'user_id'],
    ['notifications', 'user_id'],
    ['push_subscriptions', 'user_id'],
    ['user_achievements', 'user_id'],
    ['group_chat_members', 'user_id'],
    ['friendships', 'user_id'],
    ['friendships', 'friend_id'],
    ['followers', 'follower_id'],
    ['followers', 'followed_id'],
    ['challenges', 'creator_id'],
    ['challenges', 'opponent_id'],
    ['challenges', 'winner_id'],
    ['group_messages', 'sender_id'],
    ['notifications', 'related_user_id'],
  ]) {
    const { error, count } = await sb
      .from(table)
      .delete({ count: 'exact' })
      .in(col, ids)
    results.push({ table, col, count, error: error?.message })
  }
  const orParts = []
  for (const id of ids) {
    orParts.push(`user_a_id.eq.${id}`, `user_b_id.eq.${id}`, `initiated_by.eq.${id}`)
  }
  const { data: threads } = await sb.from('dm_threads').select('id').or(orParts.join(','))
  const threadIds = (threads || []).map((t) => t.id)
  if (threadIds.length) {
    await sb.from('dm_messages').delete().in('thread_id', threadIds)
    await sb.from('dm_threads').delete().in('id', threadIds)
  }
  await sb.from('group_chats').update({ created_by: null }).in('created_by', ids)
  return results
}

async function deleteAllAuthUsers() {
  const users = await listAllAuthUsers()
  const ids = users.map((u) => u.id)
  console.log(`Clearing dependents for ${ids.length} users, then Admin deleteUser…`)
  await clearAllUserOwnedRows(ids)
  // profiles last among public rows
  await sb.from('profiles').delete().in('id', ids)

  let ok = 0
  const failed = []
  for (const u of users) {
    const res = await fetch(`${url}/auth/v1/admin/users/${u.id}`, {
      method: 'DELETE',
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    if (res.ok) ok += 1
    else failed.push({ id: u.id, status: res.status, body: (await res.text()).slice(0, 200) })
    await new Promise((r) => setTimeout(r, 150))
  }
  return { ok, failed, total: users.length }
}

async function execute() {
  const before = await audit()
  const liftIdsBefore = await snapshotLiftTypeIds()
  const achievementsBefore = (await countTable('achievements')).count
  const systemSplitsBefore = (await countTable('splits', (q) => q.eq('is_system', true)))
    .count
  const globalChatsBefore = (
    await countTable('group_chats', (q) => q.eq('is_global', true))
  ).count

  console.log('\n=== EXECUTE RESET ===')
  console.log('lift_types before:', liftIdsBefore.length)
  console.log('achievements before:', achievementsBefore)
  console.log('system splits before:', systemSplitsBefore)
  console.log('global group chats before:', globalChatsBefore)

  const emailCodes = await clearEmailVerificationCodes()
  console.log('email_verification_codes cleared:', emailCodes)

  const deletedSplits = await deleteUserOwnedSplits()
  const deletedGroups = await deleteNonGlobalGroupChats()

  const authResult = await deleteAllAuthUsers()

  let deletedCustomLifts = 0
  try {
    deletedCustomLifts = await deleteCustomLiftTypes()
  } catch (e) {
    console.warn('custom lift_types cleanup:', e.message)
  }

  const after = await audit()
  const liftIdsAfter = await snapshotLiftTypeIds()
  const liftIdsMatch =
    liftIdsBefore.length === liftIdsAfter.length &&
    liftIdsBefore.every((id, i) => id === liftIdsAfter[i])

  const summary = {
    before,
    after,
    deletedSplits,
    deletedGroups,
    deletedCustomLifts,
    emailCodes,
    authResult,
    preserved: {
      lift_types_count_before: liftIdsBefore.length,
      lift_types_count_after: liftIdsAfter.length,
      lift_type_ids_unchanged: liftIdsMatch,
      achievements_before: achievementsBefore,
      achievements_after: (await countTable('achievements')).count,
      system_splits_before: systemSplitsBefore,
      system_splits_after: (
        await countTable('splits', (q) => q.eq('is_system', true))
      ).count,
      global_group_chats_before: globalChatsBefore,
      global_group_chats_after: (
        await countTable('group_chats', (q) => q.eq('is_global', true))
      ).count,
    },
  }

  writeFileSync(
    join(root, 'scripts/_reset-audit-post.json'),
    JSON.stringify(summary, null, 2),
  )
  console.log('\n=== AUTH DELETE ===', authResult)
  console.log('Deleted user splits:', deletedSplits)
  console.log('Deleted non-global group chats:', deletedGroups)
  console.log('Deleted custom lift_types:', deletedCustomLifts)
  console.log('PRESERVED lift_types unchanged:', liftIdsMatch, liftIdsAfter.length)
  return summary
}

async function verify() {
  const report = await audit()
  writeFileSync(
    join(root, 'scripts/_reset-audit-verify.json'),
    JSON.stringify(report, null, 2),
  )
  const liftCount = report.special.lift_types_system.count
  const custom = report.special.lift_types_custom.count
  const totalLift =
    (await countTable('lift_types')).count
  console.log('\nVERIFY lift_types total', totalLift, 'system', liftCount, 'custom', custom)
  console.log('AUTH remaining', report.authUsers)
  console.log('profiles', report.counts.profiles)
  return report
}

const mode = process.argv.includes('--execute')
  ? 'execute'
  : process.argv.includes('--verify')
    ? 'verify'
    : 'audit'

if (mode === 'execute') await execute()
else if (mode === 'verify') await verify()
else await audit()
