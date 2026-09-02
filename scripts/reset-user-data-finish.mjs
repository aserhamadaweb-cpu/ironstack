/**
 * Finish wipe for Auth users that failed deleteUser (HTTP 500).
 * Clears dependent rows first, then retries Admin API deletion.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  readFileSync(join(root, '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)
const url = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')
const key = env.SUPABASE_SERVICE_ROLE_KEY
const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function delIn(table, column, ids) {
  if (!ids.length) return { table, column, ok: true, count: 0 }
  const { error, count } = await sb
    .from(table)
    .delete({ count: 'exact' })
    .in(column, ids)
  return {
    table,
    column,
    ok: !error,
    count: count ?? null,
    error: error?.message ?? null,
  }
}

async function countAll(table) {
  const { count, error } = await sb
    .from(table)
    .select('*', { count: 'exact', head: true })
  return { count, error: error?.message ?? null }
}

const { data: listed, error: listErr } = await sb.auth.admin.listUsers({
  page: 1,
  perPage: 200,
})
if (listErr) throw new Error(listErr.message)
const ids = (listed.users || []).map((u) => u.id)
console.log('Remaining auth users:', ids.length)
if (!ids.length) {
  console.log('Nothing to finish.')
  process.exit(0)
}

const results = []

// AI messages via conversations
const { data: convs } = await sb
  .from('ai_conversations')
  .select('id')
  .in('user_id', ids)
const convIds = (convs || []).map((c) => c.id)
results.push(await delIn('ai_messages', 'conversation_id', convIds))

for (const t of [
  'ai_conversations',
  'ai_celebrations',
  'ai_insights',
  'ai_user_memory',
  'lift_logs',
  'personal_records',
  'sessions',
  'body_weight_logs',
  'notifications',
  'push_subscriptions',
  'user_achievements',
  'group_chat_members',
]) {
  results.push(await delIn(t, 'user_id', ids))
}

results.push(await delIn('friendships', 'user_id', ids))
results.push(await delIn('friendships', 'friend_id', ids))
results.push(await delIn('followers', 'follower_id', ids))
results.push(await delIn('followers', 'followed_id', ids))
results.push(await delIn('challenges', 'creator_id', ids))
results.push(await delIn('challenges', 'opponent_id', ids))
results.push(await delIn('challenges', 'winner_id', ids))
results.push(await delIn('group_messages', 'sender_id', ids))
results.push(await delIn('notifications', 'related_user_id', ids))

// DM threads involving these users
const orParts = []
for (const id of ids) {
  orParts.push(`user_a_id.eq.${id}`)
  orParts.push(`user_b_id.eq.${id}`)
  orParts.push(`initiated_by.eq.${id}`)
}
const { data: threads } = await sb
  .from('dm_threads')
  .select('id')
  .or(orParts.join(','))
const threadIds = (threads || []).map((t) => t.id)
results.push(await delIn('dm_messages', 'thread_id', threadIds))
results.push(await delIn('dm_threads', 'id', threadIds))

// Detach global chat ownership
{
  const { error } = await sb
    .from('group_chats')
    .update({ created_by: null })
    .in('created_by', ids)
  results.push({
    table: 'group_chats',
    column: 'created_by=null',
    ok: !error,
    error: error?.message ?? null,
  })
}

// Any remaining user-owned splits
{
  const { data: splits } = await sb
    .from('splits')
    .select('id')
    .in('user_id', ids)
  const splitIds = (splits || []).map((s) => s.id)
  results.push(await delIn('splits', 'id', splitIds))
}

results.push(await delIn('profiles', 'id', ids))
console.log('Dependent deletes:', JSON.stringify(results, null, 2))

const authResults = []
for (const id of ids) {
  const res = await fetch(`${url}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  })
  const text = await res.text()
  authResults.push({ id, status: res.status, body: text.slice(0, 300) })
  console.log('auth delete', id, res.status, text.slice(0, 120))
  // brief pause to avoid rate limits
  await new Promise((r) => setTimeout(r, 200))
}

const { data: after } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 })
const tables = [
  'profiles',
  'lift_logs',
  'sessions',
  'personal_records',
  'body_weight_logs',
  'ai_conversations',
  'ai_messages',
  'ai_insights',
  'ai_celebrations',
  'ai_user_memory',
  'notifications',
  'push_subscriptions',
  'friendships',
  'followers',
  'dm_threads',
  'dm_messages',
  'challenges',
  'user_achievements',
  'group_chat_members',
  'group_messages',
  'email_verification_codes',
  'lift_types',
  'achievements',
  'splits',
  'split_days',
  'split_day_exercises',
  'group_chats',
]
const counts = {}
for (const t of tables) counts[t] = await countAll(t)

const summary = {
  authRemaining: after.users?.length ?? after.total,
  authResults,
  counts,
  special: {
    splits_system: await countAll('splits').then(async () => {
      const { count } = await sb
        .from('splits')
        .select('*', { count: 'exact', head: true })
        .eq('is_system', true)
      return count
    }),
    group_chats_global: (
      await sb
        .from('group_chats')
        .select('*', { count: 'exact', head: true })
        .eq('is_global', true)
    ).count,
  },
}
writeFileSync(
  join(root, 'scripts/_reset-audit-finish.json'),
  JSON.stringify(summary, null, 2),
)
console.log(JSON.stringify(summary, null, 2))
