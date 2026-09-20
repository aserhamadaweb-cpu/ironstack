/**
 * Gemini-facing surface for agent actions.
 *
 * Tool names are deliberately all `propose_*`. There is no tool that applies a
 * change — the only executor entry point is `confirmAgentAction`, reached when
 * the athlete taps Confirm. A tool call can therefore never mutate data.
 *
 * Several tools fan out to more than one registry action (e.g. one
 * `propose_social_action` tool covers follow/unfollow/friend requests) to keep
 * the declaration list small enough for reliable model routing, while the audit
 * log still records the precise action name.
 */

import { Type, type FunctionDeclaration } from '@google/genai'
import { proposeAgentAction, type ProposeResult } from '@/lib/ai/agent/executor'
import {
  getAccountSettings,
  getBodyWeightHistory,
  getPendingSocial,
  getSavedNotes,
} from '@/lib/ai/agent/reads'

export const AGENT_READ_TOOL_NAMES = [
  'get_body_weight_history',
  'get_saved_notes',
  'get_account_settings',
  'get_pending_social',
] as const

export const AGENT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  // --- reads -------------------------------------------------------------
  {
    name: 'get_account_settings',
    description:
      'Current units, language, theme, notifications, privacy, body stats (including current weight), fitness profile (goals, level, equipment, schedule), primary program, and profile text. Call before proposing any settings or profile change so you do not propose a no-op.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'get_body_weight_history',
    description:
      'Recent body weight entries with their log_id values. Needed before proposing to delete an entry.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'get_saved_notes',
    description:
      'Durable notes saved about this athlete, with memory_id values. Needed before proposing to forget one.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'get_pending_social',
    description:
      'Incoming friend requests and open challenges with challenge_id values. Needed before responding to a challenge.',
    parameters: { type: Type.OBJECT, properties: {} },
  },

  // --- splits ------------------------------------------------------------
  {
    name: 'propose_delete_split',
    description:
      'Preview deleting one of the athlete own custom splits. Does NOT delete until they confirm. Call get_user_splits first for the split_id.',
    parameters: {
      type: Type.OBJECT,
      properties: { split_id: { type: Type.STRING } },
      required: ['split_id'],
    },
  },
  {
    name: 'propose_split_sharing',
    description:
      'Preview making one of their own splits public (shareable) or private again. Does NOT apply until they confirm.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        split_id: { type: Type.STRING },
        is_shared: {
          type: Type.BOOLEAN,
          description: 'true to share publicly, false to make private.',
        },
      },
      required: ['split_id', 'is_shared'],
    },
  },
  {
    name: 'propose_save_recommended_split',
    description:
      'Preview copying a system or shared split into the athlete own library. Does NOT save until they confirm.',
    parameters: {
      type: Type.OBJECT,
      properties: { source_split_id: { type: Type.STRING } },
      required: ['source_split_id'],
    },
  },

  // --- body --------------------------------------------------------------
  {
    name: 'propose_body_weight_log',
    description:
      'Preview logging a body weight entry. Does NOT log until they confirm. Ask for the number if they did not give one — never guess a body weight.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        weight: { type: Type.NUMBER },
        unit: { type: Type.STRING, description: 'kg or lb. Defaults to kg.' },
      },
      required: ['weight'],
    },
  },
  {
    name: 'propose_delete_body_weight_log',
    description:
      'Preview removing one body weight entry by log_id from get_body_weight_history.',
    parameters: {
      type: Type.OBJECT,
      properties: { log_id: { type: Type.STRING } },
      required: ['log_id'],
    },
  },
  {
    name: 'propose_body_stats_update',
    description:
      'Preview updating height, sex, or birth date. Omitted fields keep their current value. Does NOT apply until they confirm. Prefer propose_fitness_profile_update when saving age range, goals, schedule, or equipment instead of birth date.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        height_cm: { type: Type.NUMBER },
        gender: { type: Type.STRING, description: 'male or female.' },
        birth_date: { type: Type.STRING, description: 'ISO date, YYYY-MM-DD.' },
      },
    },
  },
  {
    name: 'propose_fitness_profile_update',
    description:
      'Preview saving missing fitness-profile fields (weight, height, sex, age_range, primary_goal, fitness_level, days_per_week, workout_duration, training_location, equipment, avoidances, limitations). Use when the athlete answers profile questions in chat or asks you to save training prefs. Does NOT apply until they confirm. Point them to /dashboard/fitness-profile if they prefer the form.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        weight: { type: Type.NUMBER },
        unit: { type: Type.STRING, description: 'kg or lb. Defaults to kg.' },
        height_cm: { type: Type.NUMBER },
        gender: {
          type: Type.STRING,
          description: 'male, female, or prefer_not.',
        },
        age_range: {
          type: Type.STRING,
          description:
            'under_18, 18_24, 25_34, 35_44, 45_54, 55_plus, or prefer_not.',
        },
        primary_goal: {
          type: Type.STRING,
          description:
            'build_muscle, lose_fat, get_stronger, endurance, stay_active, athletic, or other.',
        },
        fitness_level: {
          type: Type.STRING,
          description: 'beginner, intermediate, or advanced.',
        },
        days_per_week: { type: Type.NUMBER },
        workout_duration: {
          type: Type.STRING,
          description: 'under_30, 30_45, 45_60, or over_60.',
        },
        training_location: {
          type: Type.STRING,
          description: 'home, gym, or both.',
        },
        equipment: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description:
            'bodyweight, dumbbells, bands, kettlebells, bench, pullup_bar, barbell, machines, other.',
        },
        avoidances: { type: Type.STRING },
        limitations: { type: Type.STRING },
      },
    },
  },

  // --- settings ----------------------------------------------------------
  {
    name: 'propose_setting_change',
    description:
      'Preview changing weight units, app language, or theme. Does NOT apply until they confirm.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        setting: {
          type: Type.STRING,
          description: 'One of: unit, language, theme.',
        },
        value: {
          type: Type.STRING,
          description: 'unit: kg|lb. language: en|ar. theme: dark|light.',
        },
      },
      required: ['setting', 'value'],
    },
  },
  {
    name: 'propose_notification_setting',
    description:
      'Preview turning one in-app notification category on or off. Keys: friend_request, friend_accepted, new_follower, new_message, message_request, pr_achievement, split_saved, unfinished_session.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        key: { type: Type.STRING },
        enabled: { type: Type.BOOLEAN },
      },
      required: ['key', 'enabled'],
    },
  },
  {
    name: 'propose_privacy_setting',
    description:
      'Preview changing who can follow, friend-request, or message the athlete. Omitted fields keep their current value.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        follow: { type: Type.STRING, description: 'everyone or nobody.' },
        friend_request: { type: Type.STRING, description: 'everyone or nobody.' },
        message: {
          type: Type.STRING,
          description: 'everyone, friends, or nobody.',
        },
      },
    },
  },

  // --- profile -----------------------------------------------------------
  {
    name: 'propose_profile_update',
    description:
      'Preview changing display name and/or bio. Usernames CANNOT be changed from chat — if they ask, tell them to use the profile edit page.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        display_name: { type: Type.STRING },
        bio: { type: Type.STRING, description: 'Max 160 characters.' },
      },
    },
  },
  {
    name: 'propose_avatar_change',
    description:
      'Preview setting a preset avatar or removing the current picture. Presets: barbell, kettlebell, power, flex, stride, pulse, plates, champion.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        preset: { type: Type.STRING, description: 'Preset id or label.' },
        remove: {
          type: Type.BOOLEAN,
          description: 'true to remove the current picture instead.',
        },
      },
    },
  },
  {
    name: 'propose_forget_note',
    description:
      'Preview forgetting a durable note you previously saved. Pass memory_id from get_saved_notes, or fact text to match on.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        memory_id: { type: Type.STRING },
        fact: { type: Type.STRING },
      },
    },
  },

  // --- social ------------------------------------------------------------
  {
    name: 'propose_social_action',
    description:
      'Preview a social action on another athlete. actions: follow, unfollow, send_friend_request, accept_friend_request, decline_friend_request, cancel_friend_request, unfriend. You CANNOT send messages — messaging is not available to you at all.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING },
        username: {
          type: Type.STRING,
          description: 'Their username, without the @.',
        },
      },
      required: ['action', 'username'],
    },
  },
  {
    name: 'propose_challenge',
    description:
      'Preview challenging a friend on a lift. Both athletes must already be friends.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        username: { type: Type.STRING },
        exercise_name: { type: Type.STRING },
        target_weight: { type: Type.NUMBER },
        target_reps: { type: Type.NUMBER },
        unit: { type: Type.STRING, description: 'kg or lb. Defaults to kg.' },
      },
      required: ['username', 'exercise_name', 'target_weight', 'target_reps'],
    },
  },
  {
    name: 'propose_challenge_response',
    description:
      'Preview accepting, declining, or cancelling an existing challenge. Call get_pending_social first for the challenge_id.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: 'accept, decline, or cancel.' },
        challenge_id: { type: Type.STRING },
      },
      required: ['action', 'challenge_id'],
    },
  },
]

export const AGENT_TOOL_NAMES: Set<string> = new Set(
  AGENT_TOOL_DECLARATIONS.map((declaration) => declaration.name ?? ''),
)

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

const SOCIAL_ACTIONS: Record<string, string> = {
  follow: 'follow_user',
  unfollow: 'unfollow_user',
  send_friend_request: 'send_friend_request',
  add_friend: 'send_friend_request',
  accept_friend_request: 'accept_friend_request',
  decline_friend_request: 'decline_friend_request',
  reject_friend_request: 'decline_friend_request',
  cancel_friend_request: 'cancel_friend_request',
  unfriend: 'unfriend',
  remove_friend: 'unfriend',
}

const SETTING_ACTIONS: Record<string, string> = {
  unit: 'set_preferred_unit',
  units: 'set_preferred_unit',
  weight_unit: 'set_preferred_unit',
  language: 'set_language',
  locale: 'set_language',
  theme: 'set_theme',
  appearance: 'set_theme',
}

const CHALLENGE_RESPONSES: Record<string, string> = {
  accept: 'accept_challenge',
  decline: 'decline_challenge',
  reject: 'decline_challenge',
  cancel: 'cancel_challenge',
}

const DIRECT_TOOL_ACTIONS: Record<string, string> = {
  propose_delete_split: 'delete_split',
  propose_split_sharing: 'set_split_sharing',
  propose_save_recommended_split: 'save_recommended_split',
  propose_body_weight_log: 'log_body_weight',
  propose_delete_body_weight_log: 'delete_body_weight_log',
  propose_body_stats_update: 'update_body_stats',
  propose_fitness_profile_update: 'update_fitness_profile',
  propose_notification_setting: 'set_notification_preferences',
  propose_privacy_setting: 'set_privacy_settings',
  propose_profile_update: 'update_profile_details',
  propose_forget_note: 'forget_note',
  propose_challenge: 'create_challenge',
}

/**
 * Map a tool call to a registry action name, plus the args to hand it.
 * Returning null means the tool is not an agent write tool.
 *
 * Exported so `scripts/verify-ai-boundaries.ts` can prove no tool call — however
 * spelled — routes anywhere outside the registry.
 */
export function routeAgentToolCall(
  toolName: string,
  args: Record<string, unknown>,
): { actionName: string; args: Record<string, unknown> } | { error: string } | null {
  const direct = DIRECT_TOOL_ACTIONS[toolName]
  if (direct) return { actionName: direct, args }

  if (toolName === 'propose_setting_change') {
    const actionName = SETTING_ACTIONS[str(args.setting)]
    if (!actionName) {
      return { error: 'setting must be one of: unit, language, theme.' }
    }
    const value = args.value
    const key =
      actionName === 'set_preferred_unit'
        ? 'unit'
        : actionName === 'set_language'
          ? 'language'
          : 'theme'
    return { actionName, args: { [key]: value } }
  }

  if (toolName === 'propose_avatar_change') {
    if (args.remove === true) return { actionName: 'remove_avatar', args: {} }
    if (!str(args.preset)) {
      return { error: 'Pass a preset name, or remove: true to clear the picture.' }
    }
    return { actionName: 'set_avatar_preset', args }
  }

  if (toolName === 'propose_social_action') {
    const actionName = SOCIAL_ACTIONS[str(args.action)]
    if (!actionName) {
      return {
        error:
          'Unsupported social action. Messaging is not available to you. ' +
          `Supported: ${Object.keys(SOCIAL_ACTIONS).join(', ')}.`,
      }
    }
    return { actionName, args }
  }

  if (toolName === 'propose_challenge_response') {
    const actionName = CHALLENGE_RESPONSES[str(args.action)]
    if (!actionName) {
      return { error: 'action must be accept, decline, or cancel.' }
    }
    return { actionName, args }
  }

  return null
}

export type AgentToolContext = {
  userId: string
  conversationId: string | null
  requestText: string
}

/**
 * Execute an agent tool call. Reads return data; writes only ever queue a
 * pending confirmation.
 *
 * Returns null when `toolName` is not one of ours, so the caller can fall
 * through to the original coach tools.
 */
export async function executeAgentTool(
  ctx: AgentToolContext,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown | null> {
  switch (toolName) {
    case 'get_account_settings':
      return getAccountSettings(ctx.userId)
    case 'get_body_weight_history':
      return getBodyWeightHistory(ctx.userId)
    case 'get_saved_notes':
      return getSavedNotes(ctx.userId)
    case 'get_pending_social':
      return getPendingSocial(ctx.userId)
    default:
      break
  }

  const routed = routeAgentToolCall(toolName, args)
  if (!routed) return null
  if ('error' in routed) {
    return { error: 'invalid_arguments', message: routed.error }
  }

  const result: ProposeResult = await proposeAgentAction({
    userId: ctx.userId,
    conversationId: ctx.conversationId,
    actionName: routed.actionName,
    args: routed.args,
    requestText: ctx.requestText,
  })
  return result
}
