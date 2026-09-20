/**
 * Proves the AI coach cannot reach sensitive account operations.
 *
 * These are structural assertions, not prompt checks. A passing run means the
 * code path does not exist — the model's cooperation is irrelevant. Run with:
 *
 *   npx tsx scripts/verify-ai-boundaries.ts
 *
 * The suite is deliberately offline: it inspects the registry, the Gemini tool
 * surface, and the source tree. No Supabase connection, no API key.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import {
  BLOCKED_CAPABILITIES,
  BLOCKED_SERVER_ACTIONS,
  matchBlockedCapability,
} from '../lib/ai/agent/blocked'
import {
  AGENT_ACTIONS,
  listAgentActionNames,
  resolveAgentAction,
} from '../lib/ai/agent/registry'
import {
  AGENT_READ_TOOL_NAMES,
  AGENT_TOOL_DECLARATIONS,
  routeAgentToolCall,
} from '../lib/ai/agent/tool-bridge'

const ROOT = join(import.meta.dirname, '..')

let passed = 0
const failures: string[] = []

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1
    return
  }
  failures.push(detail ? `${label}\n      ${detail}` : label)
}

function group(name: string) {
  console.log(`\n${name}`)
}

// ---------------------------------------------------------------------------
// 1. The allow-list is exactly what was reviewed
// ---------------------------------------------------------------------------
// Adding a capability must be a deliberate act that updates this list. If this
// assertion fails, someone widened what the AI can do without review.
const APPROVED_ACTIONS = [
  'accept_challenge',
  'accept_friend_request',
  'cancel_challenge',
  'cancel_friend_request',
  'create_challenge',
  'decline_challenge',
  'decline_friend_request',
  'delete_body_weight_log',
  'delete_split',
  'follow_user',
  'forget_note',
  'log_body_weight',
  'remove_avatar',
  'save_recommended_split',
  'send_friend_request',
  'set_avatar_preset',
  'set_language',
  'set_notification_preferences',
  'set_preferred_unit',
  'set_privacy_settings',
  'set_split_sharing',
  'set_theme',
  'unfollow_user',
  'unfriend',
  'update_body_stats',
  'update_fitness_profile',
  'update_profile_details',
].sort()

group('Allow-list integrity')

const actual = listAgentActionNames()
const added = actual.filter((name) => !APPROVED_ACTIONS.includes(name))
const removed = APPROVED_ACTIONS.filter((name) => !actual.includes(name))

check(
  'registry matches the reviewed allow-list',
  added.length === 0 && removed.length === 0,
  `unreviewed additions: [${added.join(', ')}] | missing: [${removed.join(', ')}]`,
)

check(
  'every action declares a preview and an executor',
  [...AGENT_ACTIONS.values()].every(
    (action) =>
      typeof action.prepare === 'function' && typeof action.execute === 'function',
  ),
)

// ---------------------------------------------------------------------------
// 2. Blocked capabilities are unreachable by name
// ---------------------------------------------------------------------------
group('Blocked capabilities refuse by name')

const BLOCKED_ATTEMPTS = [
  'change_password',
  'update_password',
  'set_password',
  'reset_password',
  'change-password',
  'Change Password',
  'update_email',
  'change_email',
  'set_account_email',
  'delete_account',
  'deactivate_account',
  'close_account',
  'remove_account',
  'add_payment_method',
  'update_billing',
  'change_card',
  'cancel_subscription',
  'checkout',
  'sign_out',
  'log_out',
  'sign_in_as',
  'change_username',
  'set_handle',
  'save_push_subscription',
  'send_message',
  'send_dm',
  'delete_message',
  'read_messages',
  'update_other_user_profile',
  'grant_admin',
  'execute_sql',
]

for (const attempt of BLOCKED_ATTEMPTS) {
  const lookup = resolveAgentAction(attempt)
  check(`"${attempt}" is refused`, lookup.ok === false)
  if (lookup.ok === false) {
    const message = String(lookup.refusal.message ?? '')
    check(
      `"${attempt}" refusal tells the coach not to retry`,
      message.length > 0,
      'refusal had no message',
    )
  }
}

for (const capability of BLOCKED_CAPABILITIES) {
  for (const token of capability.matches) {
    const lookup = resolveAgentAction(`propose_${token}_change`)
    check(
      `blocked token "${token}" cannot resolve to an action`,
      lookup.ok === false,
    )
    if (lookup.ok === false) {
      check(
        `blocked token "${token}" points at a settings page`,
        typeof lookup.refusal.settings_href === 'string' ||
          lookup.refusal.error === 'unsupported_action',
      )
    }
  }
}

check(
  'no blocked capability name collides with an allowed action',
  actual.every((name) => matchBlockedCapability(name) === null),
  `colliding: [${actual.filter((n) => matchBlockedCapability(n)).join(', ')}]`,
)

// ---------------------------------------------------------------------------
// 3. The Gemini tool surface cannot mutate
// ---------------------------------------------------------------------------
group('Gemini tool surface')

const toolNames = AGENT_TOOL_DECLARATIONS.map((d) => d.name ?? '')

check(
  'every agent tool is a read or a proposal',
  toolNames.every(
    (name) => name.startsWith('get_') || name.startsWith('propose_'),
  ),
  `offenders: [${toolNames.filter((n) => !n.startsWith('get_') && !n.startsWith('propose_')).join(', ')}]`,
)

const MUTATING_PREFIXES = ['apply_', 'execute_', 'confirm_', 'do_', 'run_', 'commit_']
check(
  'no tool name implies direct execution',
  toolNames.every(
    (name) => !MUTATING_PREFIXES.some((prefix) => name.startsWith(prefix)),
  ),
)

const writeTools = toolNames.filter((name) => name.startsWith('propose_'))
for (const tool of writeTools) {
  // Route with permissive args so the routing table itself is what is tested.
  const routed = routeAgentToolCall(tool, {
    setting: 'unit',
    value: 'kg',
    action: 'follow',
    preset: 'barbell',
  })
  check(
    `${tool} routes somewhere`,
    routed !== null,
    'tool declared to Gemini but not wired to any registry action',
  )
  if (routed && 'actionName' in routed) {
    check(
      `${tool} routes into the registry (${routed.actionName})`,
      AGENT_ACTIONS.has(routed.actionName),
    )
  }
}

for (const tool of AGENT_READ_TOOL_NAMES) {
  check(
    `read tool ${tool} is not a write route`,
    routeAgentToolCall(tool, {}) === null,
  )
}

// A model that guesses a tool name must fall through to nothing.
for (const invented of [
  'apply_change',
  'propose_password_change',
  'propose_account_deletion',
  'propose_payment_method',
  'propose_send_message',
  'propose_username_change',
  'propose_email_change',
]) {
  check(
    `invented tool "${invented}" routes nowhere`,
    routeAgentToolCall(invented, {}) === null,
  )
}

// Adversarial args on real tools must be rejected, not coerced.
for (const setting of ['password', 'email', 'username', 'payment', 'billing']) {
  const routed = routeAgentToolCall('propose_setting_change', {
    setting,
    value: 'x',
  })
  check(
    `propose_setting_change rejects setting="${setting}"`,
    routed !== null && 'error' in routed,
  )
}

for (const action of ['send_message', 'message', 'dm', 'block', 'report']) {
  const routed = routeAgentToolCall('propose_social_action', {
    action,
    username: 'someone',
  })
  check(
    `propose_social_action rejects action="${action}"`,
    routed !== null && 'error' in routed,
  )
}

// ---------------------------------------------------------------------------
// 4. Source-level: no privileged client, no blocked server action, under lib/ai
// ---------------------------------------------------------------------------
group('Source boundaries across the AI code path')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...walk(full))
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const aiFiles = [
  ...walk(join(ROOT, 'lib', 'ai')),
  ...walk(join(ROOT, 'app', 'api', 'ai-coach')),
]
check('found AI source files to scan', aiFiles.length > 0)

const FORBIDDEN_SOURCE = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SERVICE_ROLE',
  'supabase/admin',
  'supabase.auth.admin',
  'auth.admin',
  'updateUser(',
  'admin.deleteUser',
  'createServerClient(',
  'createAdminClient',
]

for (const file of aiFiles) {
  const source = readFileSync(file, 'utf8')
  const rel = relative(ROOT, file)

  for (const needle of FORBIDDEN_SOURCE) {
    check(
      `${rel} does not use "${needle}"`,
      !source.includes(needle),
      'the coach must run on the athlete\u2019s own RLS-scoped session only',
    )
  }

  // blocked.ts is the deny-list itself, so it names these on purpose.
  if (!rel.endsWith(join('agent', 'blocked.ts'))) {
    for (const blocked of BLOCKED_SERVER_ACTIONS) {
      check(
        `${rel} does not reference ${blocked}`,
        !source.includes(blocked),
        'a blocked server action is importable from the AI code path',
      )
    }
  }

  // Messaging is fully out of scope, including reads.
  if (rel.includes(join('lib', 'ai', 'agent'))) {
    for (const needle of ["from('dm_", 'from("dm_', "from('messages'"]) {
      check(
        `${rel} does not touch messaging tables (${needle})`,
        !source.includes(needle),
      )
    }
  }
}

// ---------------------------------------------------------------------------
// 5. Confirmation is structurally required
// ---------------------------------------------------------------------------
group('Confirmation flow is structural')

const executorSource = readFileSync(
  join(ROOT, 'lib', 'ai', 'agent', 'executor.ts'),
  'utf8',
)

check(
  'confirm claims the pending row atomically',
  executorSource.includes("'pending'") && executorSource.includes("'confirmed'"),
  'executor no longer flips pending -> confirmed before executing',
)

check(
  'every executed action is written to the audit table',
  executorSource.includes('ai_action_audit'),
)

const actionFiles = readdirSync(join(ROOT, 'lib', 'ai', 'agent')).filter((name) =>
  name.startsWith('actions-'),
)
check('found action modules', actionFiles.length > 0)

for (const name of actionFiles) {
  const source = readFileSync(join(ROOT, 'lib', 'ai', 'agent', name), 'utf8')
  check(
    `${name} cannot self-execute (does not import the executor)`,
    !source.includes('agent/executor'),
    'an action module importing the executor could bypass confirmation',
  )
}

const bridgeSource = readFileSync(
  join(ROOT, 'lib', 'ai', 'agent', 'tool-bridge.ts'),
  'utf8',
)
// Only the import matters — the prose above it deliberately names the executor.
const bridgeExecutorImport =
  bridgeSource.match(
    /import\s*\{([^}]*)\}\s*from\s*'@\/lib\/ai\/agent\/executor'/,
  )?.[1] ?? ''

check(
  'the tool bridge imports the executor at all',
  bridgeExecutorImport.includes('proposeAgentAction'),
)

check(
  'the tool bridge can only propose, never confirm or undo',
  !bridgeExecutorImport.includes('confirmAgentAction') &&
    !bridgeExecutorImport.includes('undoAgentAction'),
  'a Gemini tool call could apply a change without a confirmation tap',
)

const suggestionSource = readFileSync(
  join(ROOT, 'lib', 'ai', 'suggestions.ts'),
  'utf8',
)
check(
  'suggestions cannot execute anything',
  !suggestionSource.includes('confirmAgentAction') &&
    !suggestionSource.includes('proposeAgentAction'),
  'a proactive suggestion must never auto-execute',
)

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log('')
if (failures.length === 0) {
  console.log(`PASS — ${passed} boundary assertions held.`)
  process.exit(0)
}

console.log(`FAIL — ${failures.length} of ${passed + failures.length} assertions failed:\n`)
for (const failure of failures) {
  console.log(`  \u2717 ${failure}`)
}
process.exit(1)
