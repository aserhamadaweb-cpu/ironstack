import type { FunctionDeclaration } from '@google/genai'
import { Type } from '@google/genai'
import { saveUserNote } from '@/lib/ai/memory'
import { createClient } from '@/lib/supabase/server'

/**
 * Gemini tool declarations. None accept user_id — that is injected only from
 * the authenticated server session when tools are executed.
 */
export const COACH_TOOL_DECLARATIONS: FunctionDeclaration[] = [
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
]

type ToolArgs = Record<string, unknown>

/**
 * Execute a coach tool. userId MUST come from auth.getUser() on the server —
 * never from the model.
 */
export async function executeCoachTool(
  userId: string,
  name: string,
  args: ToolArgs,
): Promise<unknown> {
  try {
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
      case 'save_user_note':
        return await saveUserNote(
          userId,
          String(args.fact ?? ''),
          args.category,
        )
      default:
        return { error: `Unknown tool: ${name}` }
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
      name: s.name,
      days_per_week: s.days_per_week,
      category: s.category,
      description: s.description,
    })),
  }
}
