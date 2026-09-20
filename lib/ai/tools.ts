import type { FunctionDeclaration } from '@google/genai'
import { Type } from '@google/genai'
import { resolveAgentAction } from '@/lib/ai/agent/registry'
import {
  AGENT_TOOL_DECLARATIONS,
  executeAgentTool,
  type AgentToolContext,
} from '@/lib/ai/agent/tool-bridge'
import { saveUserNote } from '@/lib/ai/memory'
import { createClient } from '@/lib/supabase/server'
import { exerciseDetailsForCoach, searchCatalogExercises } from '@/lib/ai/catalog-lookup'
import { applySplitOps, buildSplitProposal, coerceArray, type SplitMutationOp } from '@/lib/ai/proposals'
import {
  getActiveSessionForCoach,
  getUserSplitsDetailed,
  getUserWorkoutPreferences,
  getWorkoutHistorySummary,
  ownedSplitToProposal,
} from '@/lib/ai/read-tools'
import { getCustomSplitSlots } from '@/lib/ai/split-context'
import { getSplitDetail } from '@/lib/data/queries'
import {
  applyCoachSplitSafety,
  coachSplitProposalIsSaveable,
} from '@/lib/ai/split-safety'

/**
 * Gemini tool declarations. None accept user_id — that is injected only from
 * the authenticated server session when tools are executed.
 *
 * Agent write tools live in `lib/ai/agent/tool-bridge.ts` and are appended
 * below, so the model sees one flat tool list while the permission boundary
 * stays in one place.
 */
const BASE_COACH_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'get_user_prs',
    description:
      "Get the athlete's current personal records (exercise name, weight, reps, date).",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_current_streak',
    description:
      'Get the athlete current training streak in consecutive days with completed sessions.',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'get_recent_sessions',
    description:
      'Get recent completed training sessions with date, duration, volume, and split used.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: {
          type: Type.NUMBER,
          description: 'Max sessions to return (1-10). Defaults to 5.',
        },
      },
    },
  },
  {
    name: 'get_exercise_history',
    description:
      'Get logged set history for a specific exercise by name (for progress questions).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        exercise_name: {
          type: Type.STRING,
          description: 'Exercise name to look up, e.g. "Bench Press".',
        },
      },
      required: ['exercise_name'],
    },
  },
  {
    name: 'get_current_split',
    description:
      'Get the custom splits the athlete has saved (name, days/week, category).',
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: 'save_user_note',
    description:
      'Save a durable fact about the athlete for future chats (injury/limitation, equipment constraint, training preference, or long-term goal). Do NOT use for casual chat or one-off questions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fact: {
          type: Type.STRING,
          description:
            'Short durable note, e.g. "Bad left knee — avoid heavy barbell squats".',
        },
        category: {
          type: Type.STRING,
          description:
            'One of: injury, equipment, preference, goal, other.',
        },
      },
      required: ['fact'],
    },
  },
  {
    name: 'search_exercises',
    description:
      'Search the IronStack exercise catalog (1,324 real exercises). Always use returned ids — never invent exercises.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Name or keyword, e.g. "dumbbell bench".' },
        muscle: { type: Type.STRING, description: 'Filter label such as Chest, Back, Quads.' },
        equipment: { type: Type.STRING, description: 'Equipment string from the catalog, e.g. barbell, dumbbell, body weight.' },
        home_only: { type: Type.BOOLEAN, description: 'If true, only home-suitable equipment.' },
        limit: { type: Type.NUMBER, description: 'Max results (1-20). Defaults to 18.' },
      },
    },
  },
  {
    name: 'get_exercise_details',
    description: 'Get one catalog exercise by its real id (4-digit source id from search_exercises).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        exercise_id: { type: Type.STRING, description: 'Catalog id such as "0025".' },
      },
      required: ['exercise_id'],
    },
  },
  {
    name: 'get_user_workout_preferences',
    description:
      "Get this athlete's PRs, frequently logged lifts (mapped to catalog ids when possible), and durable notes. Call this before building a split from 'best' or 'favorite' exercises. If has_best_exercises is false, ask clarifying questions instead of inventing favorites.",
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'get_user_splits',
    description:
      'List the athlete custom splits with day names, catalog exercise ids, sets, and reps. Use split id for updates.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'get_active_session',
    description: 'Get the in-progress workout session if one exists, including resume URL.',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'get_workout_history_summary',
    description: 'Recent completed workouts (date, volume, split name).',
    parameters: { type: Type.OBJECT, properties: {} },
  },
  {
    name: 'propose_split',
    description:
      'Build a validated split PREVIEW from catalog exercises. Does NOT save. Pass exercise "name" (English catalog name) for speed — server resolves to ids. Use exercise_id only when you already have it. The app shows the plan and the athlete must tap Save.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        description: { type: Type.STRING },
        days_per_week: { type: Type.NUMBER },
        home_only: { type: Type.BOOLEAN },
        based_on: {
          type: Type.STRING,
          description: 'prs | history | preferences | catalog_defaults | mixed',
        },
        assumptions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        questions: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
        days: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              subtitle: { type: Type.STRING },
              exercises: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    exercise_id: {
                      type: Type.STRING,
                      description: 'Catalog id such as "0025". Optional if name is set.',
                    },
                    name: {
                      type: Type.STRING,
                      description:
                        'Catalog exercise name (preferred) — e.g. "Barbell Bench Press". Server resolves automatically.',
                    },
                    sets: { type: Type.NUMBER },
                    reps: { type: Type.STRING },
                  },
                },
              },
            },
            required: ['name', 'exercises'],
          },
        },
      },
      required: ['name', 'days'],
    },
  },
  {
    name: 'propose_update_split',
    description:
      'Preview add/remove/replace/reorder/set_targets/rename_day on an owned custom split. Does NOT save until the athlete confirms.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        split_id: { type: Type.STRING },
        name: { type: Type.STRING, description: 'Optional new split name.' },
        operations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              op: { type: Type.STRING },
              day_index: { type: Type.NUMBER },
              exercise_id: { type: Type.STRING },
              from_exercise_id: { type: Type.STRING },
              to_exercise_id: { type: Type.STRING },
              from_index: { type: Type.NUMBER },
              to_index: { type: Type.NUMBER },
              index: { type: Type.NUMBER },
              sets: { type: Type.NUMBER },
              reps: { type: Type.STRING },
              name: { type: Type.STRING },
            },
            required: ['op', 'day_index'],
          },
        },
      },
      required: ['split_id', 'operations'],
    },
  },
  {
    name: 'propose_session_action',
    description:
      'Preview navigation or discarding an active session. Does NOT start/finish/discard until the athlete confirms. action: open_split | start_session | resume_session | discard_session. Finishing a session is not available here — send them to the live workout screen.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING },
        split_id: { type: Type.STRING },
      },
      required: ['action'],
    },
  },
  {
    name: 'propose_profile_interview',
    description:
      'Show a guided choice-button interview (same UX as Create Split with AI) so the athlete fills MISSING fitness-profile fields by tapping options instead of typing free-text answers. Call this whenever ATHLETE PROFILE lists MISSING fields and you need them for a split or personalized advice. Do NOT ask those questions as plain chat text. Does NOT save until they finish the card.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        resume_prompt: {
          type: Type.STRING,
          description:
            'Optional: the athlete request to continue after they finish (e.g. their split ask).',
        },
      },
    },
  },
]

export const COACH_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  ...BASE_COACH_TOOL_DECLARATIONS,
  ...AGENT_TOOL_DECLARATIONS,
]

/** Tools the model may call while building/revising a split — keeps the turn short. */
const SPLIT_BUILD_TOOL_NAMES = new Set([
  'propose_split',
  'propose_profile_interview',
  'search_exercises',
])

/**
 * Full tool surface normally; a tight allow-list for split-build / revise so the
 * model cannot burn the round budget on PR/history lookups (those are pre-loaded).
 */
export function coachToolDeclarationsForMode(options?: {
  splitBuildMode?: boolean
  revisePendingSplit?: boolean
}): FunctionDeclaration[] {
  if (!options?.splitBuildMode && !options?.revisePendingSplit) {
    return COACH_TOOL_DECLARATIONS
  }
  return COACH_TOOL_DECLARATIONS.filter((tool) =>
    SPLIT_BUILD_TOOL_NAMES.has(tool.name ?? ''),
  )
}

type ToolArgs = Record<string, unknown>

function asBool(value: unknown): boolean {
  if (value === true || value === 1) return true
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    return v === 'true' || v === '1' || v === 'yes'
  }
  return false
}

/**
 * Execute a coach tool. The context comes from the authenticated server
 * session — never from the model.
 */
export async function executeCoachTool(
  ctx: AgentToolContext,
  name: string,
  args: ToolArgs,
): Promise<unknown> {
  const userId = ctx.userId
  try {
    // Agent tools first: reads return data, writes only queue a confirmation.
    const agentResult = await executeAgentTool(ctx, name, args)
    if (agentResult !== null) return agentResult

    switch (name) {
      case 'get_user_prs':
        return await getUserPrs(userId)
      case 'get_current_streak':
        return await getCurrentStreak(userId)
      case 'get_recent_sessions':
        return await getRecentSessions(userId, Number(args.limit) || 5)
      case 'get_exercise_history':
        return await getExerciseHistory(
          userId,
          String(args.exercise_name ?? ''),
        )
      case 'get_current_split':
        return await getCurrentSplit(userId)
      case 'get_user_splits':
        return await getUserSplitsDetailed(userId)
      case 'get_user_workout_preferences':
        return await getUserWorkoutPreferences(userId)
      case 'get_active_session':
        return await getActiveSessionForCoach(userId)
      case 'get_workout_history_summary':
        return await getWorkoutHistorySummary(userId)
      case 'search_exercises':
        return {
          exercises: searchCatalogExercises({
            query: String(args.query ?? ''),
            muscle: args.muscle ? String(args.muscle) : undefined,
            equipment: args.equipment ? String(args.equipment) : undefined,
            homeOnly: asBool(args.home_only),
            limit: Math.min(20, Math.max(1, Number(args.limit) || 18)),
          }),
        }
      case 'get_exercise_details':
        return exerciseDetailsForCoach(String(args.exercise_id ?? ''))
      case 'propose_split':
        return await proposeSplitTool(userId, args)
      case 'propose_update_split':
        return await proposeUpdateSplitTool(userId, args)
      case 'propose_session_action':
        return await proposeSessionTool(userId, args)
      case 'propose_profile_interview':
        return await proposeProfileInterviewTool(userId, args)
      case 'save_user_note':
        return await saveUserNote(
          userId,
          String(args.fact ?? ''),
          args.category,
        )
      default: {
        // Not a real tool. Route through the registry so an attempt at a
        // blocked capability gets a specific refusal pointing at settings,
        // rather than a generic "unknown tool" the model might retry.
        const lookup = resolveAgentAction(name)
        return lookup.ok
          ? { error: `Unknown tool: ${name}` }
          : lookup.refusal
      }
    }
  } catch (err) {
    console.error('[ai-coach tool]', name, err)
    return {
      error: 'no_data',
      message: 'Could not load that data right now.',
    }
  }
}

async function getUserPrs(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('personal_records')
    .select(
      'weight, reps, logged_at, lift_types(name, muscle_group)',
    )
    .eq('user_id', userId)
    .eq('is_current_pr', true)
    .order('weight', { ascending: false })
    .limit(40)

  if (error) return { error: 'no_data', message: error.message }
  if (!data?.length) {
    return { records: [], message: 'No personal records logged yet.' }
  }

  return {
    records: data.map((row) => {
      const lift = Array.isArray(row.lift_types)
        ? row.lift_types[0]
        : row.lift_types
      return {
        exercise: (lift as { name?: string } | null)?.name ?? 'Lift',
        muscle_group: (lift as { muscle_group?: string } | null)?.muscle_group ?? null,
        weight_kg: Number(row.weight) || 0,
        reps: Number(row.reps) || 0,
        logged_at: row.logged_at,
      }
    }),
  }
}

async function getCurrentStreak(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_current_streak', {
    p_user_id: userId,
  })

  if (error) return { error: 'no_data', message: error.message }

  return { current_streak_days: Math.max(0, Math.floor(Number(data) || 0)) }
}

async function getRecentSessions(userId: string, limit: number) {
  const supabase = await createClient()
  const safeLimit = Math.min(10, Math.max(1, Math.floor(limit) || 5))
  const { data, error } = await supabase
    .from('sessions')
    .select(
      'started_at, finished_at, duration_seconds, total_volume, total_sets_completed, splits(name), split_days(name)',
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('finished_at', { ascending: false })
    .limit(safeLimit)

  if (error) return { error: 'no_data', message: error.message }
  if (!data?.length) {
    return { sessions: [], message: 'No completed sessions yet.' }
  }

  return {
    sessions: data.map((s) => {
      const split = Array.isArray(s.splits) ? s.splits[0] : s.splits
      const day = Array.isArray(s.split_days) ? s.split_days[0] : s.split_days
      return {
        date: s.finished_at ?? s.started_at,
        duration_seconds: s.duration_seconds,
        volume_kg: Number(s.total_volume) || 0,
        sets_completed: s.total_sets_completed,
        split: (split as { name?: string } | null)?.name ?? null,
        day: (day as { name?: string } | null)?.name ?? null,
      }
    }),
  }
}

async function getExerciseHistory(userId: string, exerciseName: string) {
  const name = exerciseName.trim()
  if (!name) {
    return { error: 'no_data', message: 'exercise_name is required.' }
  }

  const supabase = await createClient()
  const { data: lifts, error: liftError } = await supabase
    .from('lift_types')
    .select('id, name')
    .ilike('name', `%${name.replace(/[%_]/g, '')}%`)
    .limit(5)

  if (liftError) return { error: 'no_data', message: liftError.message }
  if (!lifts?.length) {
    return {
      exercise: name,
      sets: [],
      message: `No lift type matching "${name}" found.`,
    }
  }

  const liftIds = lifts.map((l) => l.id)
  const { data: logs, error } = await supabase
    .from('lift_logs')
    .select('weight, reps, logged_at, is_skipped, lift_type_id, lift_types(name)')
    .eq('user_id', userId)
    .in('lift_type_id', liftIds)
    .or('is_skipped.is.null,is_skipped.eq.false')
    .order('logged_at', { ascending: false })
    .limit(30)

  if (error) return { error: 'no_data', message: error.message }
  if (!logs?.length) {
    return {
      exercise: lifts[0].name,
      sets: [],
      message: 'No logged sets for that exercise yet.',
    }
  }

  return {
    matched_exercises: lifts.map((l) => l.name),
    sets: logs.map((log) => {
      const lift = Array.isArray(log.lift_types)
        ? log.lift_types[0]
        : log.lift_types
      return {
        exercise: (lift as { name?: string } | null)?.name ?? name,
        weight_kg: Number(log.weight) || 0,
        reps: Number(log.reps) || 0,
        logged_at: log.logged_at,
      }
    }),
  }
}

async function getCurrentSplit(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('splits')
    .select('id, name, days_per_week, category, description, is_system')
    .eq('user_id', userId)
    .eq('is_system', false)
    .order('updated_at', { ascending: false })
    .limit(5)

  if (error) return { error: 'no_data', message: error.message }
  if (!data?.length) {
    return {
      splits: [],
      message: 'No custom splits saved yet. They may be using a recommended program.',
    }
  }

  return {
    splits: data.map((s) => ({
      id: s.id,
      name: s.name,
      days_per_week: s.days_per_week,
      category: s.category,
      description: s.description,
    })),
  }
}

async function proposeSplitTool(userId: string, args: ToolArgs) {
  const slots = await getCustomSplitSlots(userId)
  if (slots.remaining === 0) {
    return {
      error: 'split_limit_reached',
      message: `You already have ${slots.max} custom splits. Delete one from My Splits before adding another.`,
      slots,
    }
  }

  const built = buildSplitProposal({
    kind: 'create_split',
    name: args.name,
    description: args.description,
    daysPerWeek: args.days_per_week,
    days: args.days,
    assumptions: args.assumptions,
    questions: args.questions,
    basedOn: args.based_on,
    homeOnly: asBool(args.home_only),
  })
  if (!built.ok) {
    return { error: 'invalid_proposal', message: built.error }
  }

  const hint = [args.description, args.name].filter(Boolean).join(' ')
  const safe = await applyCoachSplitSafety(built.proposal, userId, {
    userPromptHint: String(hint),
  })

  return {
    status: 'pending_confirmation',
    saved: false,
    proposal: safe.proposal,
    warnings: safe.warnings,
    message:
      'Preview only. Tell the athlete to review the card and tap Save Split. Do not say it is saved.',
  }
}

function parseOps(raw: unknown): SplitMutationOp[] {
  const list = coerceArray(raw)
  const ops: SplitMutationOp[] = []
  for (const row of list) {
    if (!row || typeof row !== 'object') continue
    const op = String((row as { op?: string }).op ?? '')
    const dayIndex = Math.floor(Number((row as { day_index?: number }).day_index))
    if (!Number.isFinite(dayIndex)) continue
    if (op === 'add') {
      ops.push({
        op: 'add',
        day_index: dayIndex,
        exercise_id: String((row as { exercise_id?: string }).exercise_id ?? ''),
        sets: Number((row as { sets?: number }).sets) || undefined,
        reps: (row as { reps?: string }).reps,
        index: (row as { index?: number }).index,
      })
    } else if (op === 'remove') {
      ops.push({
        op: 'remove',
        day_index: dayIndex,
        exercise_id: (row as { exercise_id?: string }).exercise_id,
        index: (row as { index?: number }).index,
      })
    } else if (op === 'replace') {
      ops.push({
        op: 'replace',
        day_index: dayIndex,
        from_exercise_id: String((row as { from_exercise_id?: string }).from_exercise_id ?? ''),
        to_exercise_id: String((row as { to_exercise_id?: string }).to_exercise_id ?? ''),
      })
    } else if (op === 'reorder') {
      ops.push({
        op: 'reorder',
        day_index: dayIndex,
        from_index: Math.floor(Number((row as { from_index?: number }).from_index)),
        to_index: Math.floor(Number((row as { to_index?: number }).to_index)),
      })
    } else if (op === 'set_targets') {
      ops.push({
        op: 'set_targets',
        day_index: dayIndex,
        exercise_id: (row as { exercise_id?: string }).exercise_id,
        index: (row as { index?: number }).index,
        sets: (row as { sets?: number }).sets,
        reps: (row as { reps?: string }).reps,
      })
    } else if (op === 'rename_day') {
      ops.push({
        op: 'rename_day',
        day_index: dayIndex,
        name: String((row as { name?: string }).name ?? ''),
      })
    }
  }
  return ops
}

async function proposeUpdateSplitTool(userId: string, args: ToolArgs) {
  const splitId = String(args.split_id ?? '').trim()
  const current = await ownedSplitToProposal(userId, splitId)
  if (!current.ok) return { error: 'invalid_proposal', message: current.error }
  const ops = parseOps(args.operations)
  if (ops.length === 0) {
    return { error: 'invalid_proposal', message: 'Provide at least one operation.' }
  }
  const next = applySplitOps(current.proposal, ops)
  if (!next.ok) return { error: 'invalid_proposal', message: next.error }
  const named = String(args.name ?? '').trim()
  if (named) next.proposal.name = named

  const safe = await applyCoachSplitSafety(next.proposal, userId, {
    userPromptHint: named || next.proposal.description,
  })

  return {
    status: 'pending_confirmation',
    saved: false,
    proposal: safe.proposal,
    warnings: safe.warnings,
    message:
      'Preview only. The athlete must tap Save changes. Do not say the split was updated yet.',
  }
}

async function proposeSessionTool(userId: string, args: ToolArgs) {
  const action = String(args.action ?? '').trim()
  if (action === 'discard_session') {
    const active = await getActiveSessionForCoach(userId)
    if ('error' in active) return active
    if (!active.active) {
      return { error: 'none', message: 'No in-progress session to discard.' }
    }
    return {
      status: 'pending_confirmation',
      proposal: {
        id: crypto.randomUUID(),
        kind: 'discard_session' as const,
        sessionId: active.active.session_id,
        splitName: active.active.split_name ?? 'Workout',
        warning:
          'This cancels the live session. It will not be added to workout history.',
      },
    }
  }

  if (action === 'resume_session') {
    const active = await getActiveSessionForCoach(userId)
    if ('error' in active) return active
    if (!active.active) {
      return { error: 'none', message: 'No in-progress session to resume.' }
    }
    return {
      status: 'pending_confirmation',
      proposal: {
        id: crypto.randomUUID(),
        kind: 'resume_session' as const,
        sessionId: active.active.session_id,
        splitId: active.active.split_id ?? undefined,
        href: active.active.resume_href,
        splitName: active.active.split_name ?? 'Workout',
        dayName: active.active.day_name ?? undefined,
      },
    }
  }

  const splitId = String(args.split_id ?? '').trim()
  if (!splitId) {
    return { error: 'invalid', message: 'split_id is required for open_split or start_session.' }
  }
  const detail = await getSplitDetail(splitId)
  if (!detail.data) {
    return { error: 'not_found', message: 'That split was not found.' }
  }
  if (
    detail.data.user_id &&
    detail.data.user_id !== userId &&
    !detail.data.is_system &&
    !detail.data.is_shared
  ) {
    return { error: 'forbidden', message: 'You cannot open another athlete\'s private split.' }
  }

  const kind = action === 'start_session' ? 'start_session' : 'open_split'
  return {
    status: 'pending_confirmation',
    proposal: {
      id: crypto.randomUUID(),
      kind,
      splitId: detail.data.id,
      splitName: detail.data.name,
      href:
        kind === 'start_session'
          ? `/dashboard/splits/${detail.data.id}/session`
          : `/dashboard/splits/${detail.data.id}`,
      warning:
        kind === 'start_session'
          ? 'This opens the live workout screen and starts a session for this program.'
          : undefined,
    },
  }
}

async function proposeProfileInterviewTool(
  userId: string,
  args: ToolArgs,
) {
  const { loadAthleteContext } = await import('@/lib/ai/athlete-context')
  const {
    orderProfileInterviewFields,
  } = await import('@/lib/ai/profile-interview')

  const athlete = await loadAthleteContext(userId)
  if (!athlete) {
    return { error: 'no_data', message: 'Could not load your profile.' }
  }
  if (athlete.missingFields.length === 0) {
    return {
      error: 'nothing_missing',
      message:
        'Fitness profile already has the core fields. No interview needed — continue with their request.',
    }
  }

  const resume =
    typeof args.resume_prompt === 'string' ? args.resume_prompt.trim() : ''

  return {
    status: 'pending_confirmation',
    interviewId: crypto.randomUUID(),
    fields: orderProfileInterviewFields(athlete.missingFields),
    preferredUnit: athlete.preferredUnit,
    resumePrompt: resume || null,
    message:
      'Show the interview card. Do not ask these fields as free-text chat questions.',
  }
}
