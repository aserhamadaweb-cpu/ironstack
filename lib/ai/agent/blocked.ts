/**
 * Capabilities the AI coach must never have.
 *
 * This is defence in depth, not the primary control. The primary control is
 * that `AGENT_ACTIONS` is an allow-list and none of these server actions are
 * imported anywhere under `lib/ai/` — so there is no code path to reach them
 * even if the model asks perfectly. This module exists so that:
 *
 *   1. A request that clearly targets a blocked capability gets a specific,
 *      useful refusal that points at the real settings page, instead of a
 *      generic "unknown action".
 *   2. `scripts/verify-ai-boundaries.ts` has a concrete list to assert against,
 *      so adding a sensitive action to the registry fails the check.
 */

export type BlockedCapability = {
  id: string
  /** Server actions that implement it — asserted absent from the registry. */
  serverActions: string[]
  /** Where the athlete should go instead. */
  href: string
  /** Substrings that identify an attempt to invoke it. */
  matches: string[]
}

export const BLOCKED_CAPABILITIES: BlockedCapability[] = [
  {
    id: 'password',
    serverActions: ['updateAccountPasswordAction'],
    href: '/dashboard/settings',
    matches: ['password', 'passcode', 'credential'],
  },
  {
    id: 'email',
    serverActions: ['updateAccountEmailAction'],
    href: '/dashboard/settings',
    matches: ['email_address', 'account_email', 'change_email', 'update_email'],
  },
  {
    id: 'account_deletion',
    serverActions: ['deleteAccountAction'],
    href: '/dashboard/settings',
    matches: ['delete_account', 'close_account', 'remove_account', 'deactivate_account'],
  },
  {
    id: 'auth_session',
    serverActions: ['signIn', 'signUp', 'signOut'],
    href: '/dashboard/settings',
    matches: ['sign_in', 'sign_up', 'sign_out', 'log_in', 'log_out', 'logout', 'signout'],
  },
  {
    id: 'payment',
    serverActions: [],
    href: '/dashboard/settings',
    matches: ['payment', 'billing', 'card', 'subscription', 'invoice', 'checkout'],
  },
  {
    id: 'username',
    serverActions: [],
    href: '/dashboard/profile/edit',
    matches: ['username', 'handle'],
  },
  {
    id: 'push_credentials',
    serverActions: [
      'savePushSubscriptionAction',
      'removePushSubscriptionAction',
    ],
    href: '/dashboard/notifications',
    matches: ['push_subscription', 'push_endpoint', 'vapid'],
  },
]

/** Every server action name the coach must never be able to reach. */
export const BLOCKED_SERVER_ACTIONS: string[] = BLOCKED_CAPABILITIES.flatMap(
  (capability) => capability.serverActions,
)

/**
 * Identifies a blocked capability from an attempted action name.
 * Only used to produce a better refusal — never to permit anything.
 */
export function matchBlockedCapability(
  actionName: string,
): BlockedCapability | null {
  const needle = actionName.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!needle) return null
  for (const capability of BLOCKED_CAPABILITIES) {
    if (capability.matches.some((token) => needle.includes(token))) {
      return capability
    }
  }
  return null
}

/**
 * Refusal copy returned to the model as a tool result. Phrased as an
 * instruction so the coach relays it rather than retrying.
 */
export function blockedRefusal(capability: BlockedCapability): {
  error: 'not_permitted'
  capability: string
  settings_href: string
  message: string
} {
  const label: Record<string, string> = {
    password: 'passwords',
    email: 'the account email address',
    account_deletion: 'account deletion',
    auth_session: 'signing in or out',
    payment: 'payment methods or billing',
    username: 'usernames',
    push_credentials: 'push notification device registrations',
  }
  const subject = label[capability.id] ?? 'account security settings'
  return {
    error: 'not_permitted',
    capability: capability.id,
    settings_href: capability.href,
    message:
      `You cannot change ${subject}. Tell the athlete you are not able to do ` +
      `that from chat for security reasons, and that they can do it themselves ` +
      `at ${capability.href}. Do not attempt any other tool for this request.`,
  }
}
