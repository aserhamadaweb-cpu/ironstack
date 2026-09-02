import { GoogleGenAI } from '@google/genai'
import { GEMINI_MODEL } from '@/lib/ai/prompt'
import { fetchStreakStatus } from '@/lib/data/streak'
import { logServerError } from '@/lib/log'
import { createClient } from '@/lib/supabase/server'
import { formatSessionDate, formatVolume } from '@/lib/session-store'

export type AiInsight = {
  id: string
  user_id: string
  headline: string
  detail: string
  source_session_id: string | null
  generated_at: string
  created_at: string
  /** Language the insight was generated in ('en' | 'ar'). */
  language?: string | null
}

export type CoachInsightView = {
  kind: 'insight' | 'empty'
  headline: string
  detail: string
  /** Plain session meta, e.g. "Mar 12 · 18 sets · 12.4k kg" */
  sessionMeta: string | null
  sourceSessionId: string | null
  generatedAt: string | null
}

type InsightLocale = 'en' | 'ar'

const INSIGHT_SYSTEM = `You are IronStack Coach writing a single workout-page insight card.

Task: spot ONE genuine leverage point or notable pattern in the athlete's recent training (a lift trending up, a new PR, a muscle group under-trained relative to others, strong volume on a day, etc.).

Return ONLY valid JSON with exactly these keys:
- "headline": short punchy phrase, under 8 words, naming a specific lift or pattern (e.g. "Bench Press is your leverage point")
- "detail": 1-2 sentences, specific and actionable, referencing real numbers from the data (weight, reps, date). Tone like: "Last push day you hit 100kg x 5. Keep the cue: elbows pinned, pause on chest. Push volume 5-8% this week, then retest a heavy single."

Rules:
- Never invent lifts, weights, or dates that are not in the provided data.
- Do not diagnose injuries or give medical advice.
- Keep exercise names in English (as provided in the data).
- No markdown, no code fences — JSON object only.`

const INSIGHT_SYSTEM_AR = `${INSIGHT_SYSTEM}

Language:
- Write headline and detail entirely in Arabic (Modern Standard Arabic is fine).
- Keep exercise names in English exactly as given (e.g. Bench Press, Squat).
- Use Western numerals (0-9) for weights, reps, dates, and percentages.`

const STALE_MS = 24 * 60 * 60 * 1000

async function resolveInsightLocale(userId: string): Promise<InsightLocale> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('profiles')
      .select('language')
      .eq('id', userId)
      .maybeSingle()
    return data?.language === 'ar' ? 'ar' : 'en'
  } catch {
    return 'en'
  }
}

export async function getLatestInsight(
  userId: string,
  language: InsightLocale = 'en',
): Promise<AiInsight | null> {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('ai_insights')
      .select(
        'id, user_id, headline, detail, source_session_id, generated_at, created_at, language',
      )
      .eq('user_id', userId)
      .eq('language', language)
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      logServerError('[ai_insights]', error.message)
      return null
    }
    return (data as AiInsight | null) ?? null
  } catch (err) {
    logServerError('[ai_insights]', err)
    return null
  }
}

export async function listAiInsights(
  userId: string,
  limit = 40,
): Promise<AiInsight[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ai_insights')
    .select(
      'id, user_id, headline, detail, source_session_id, generated_at, created_at',
    )
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(limit)

  if (error) {
    logServerError('[ai_insights list]', error.message)
    return []
  }
  return (data ?? []) as AiInsight[]
}

function needsRefresh(
  insight: AiInsight | null,
  latestSessionFinishedAt: string | null,
  language: InsightLocale,
): boolean {
  if (!insight) return true
  if ((insight.language ?? 'en') !== language) return true
  const generated = new Date(insight.generated_at).getTime()
  if (Number.isNaN(generated)) return true
  if (Date.now() - generated > STALE_MS) return true
  if (latestSessionFinishedAt) {
    const finished = new Date(latestSessionFinishedAt).getTime()
    if (!Number.isNaN(finished) && generated < finished) return true
  }
  return false
}

async function computeStreakDays(userId: string): Promise<number> {
  const { streakDays } = await fetchStreakStatus(userId)
  return streakDays
}

async function gatherTrainingContext(userId: string) {
  const supabase = await createClient()

  const { data: sessions } = await supabase
    .from('sessions')
    .select(
      'id, started_at, finished_at, duration_seconds, total_volume, total_sets_completed, splits(name), split_days(name)',
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('finished_at', { ascending: false })
    .limit(5)

  const latest = sessions?.[0] ?? null
  if (!latest) {
    return { latest: null, context: null as null }
  }

  const { data: logs } = await supabase
    .from('lift_logs')
    .select('weight, reps, logged_at, is_skipped, lift_types(name, muscle_group)')
    .eq('user_id', userId)
    .eq('session_id', latest.id)
    .or('is_skipped.is.null,is_skipped.eq.false')
    .order('logged_at', { ascending: true })
    .limit(80)

  const { data: prs } = await supabase
    .from('personal_records')
    .select('weight, reps, logged_at, lift_types(name, muscle_group)')
    .eq('user_id', userId)
    .eq('is_current_pr', true)
    .order('weight', { ascending: false })
    .limit(15)

  const streak = await computeStreakDays(userId)

  const split = Array.isArray(latest.splits) ? latest.splits[0] : latest.splits
  const day = Array.isArray(latest.split_days)
    ? latest.split_days[0]
    : latest.split_days

  const context = {
    streak_days: streak,
    latest_session: {
      id: latest.id,
      finished_at: latest.finished_at ?? latest.started_at,
      duration_seconds: latest.duration_seconds,
      volume_kg: Number(latest.total_volume) || 0,
      sets_completed: latest.total_sets_completed,
      split: (split as { name?: string } | null)?.name ?? null,
      day: (day as { name?: string } | null)?.name ?? null,
      sets: (logs ?? []).map((log) => {
        const lift = Array.isArray(log.lift_types)
          ? log.lift_types[0]
          : log.lift_types
        return {
          exercise: (lift as { name?: string } | null)?.name ?? 'Lift',
          muscle_group:
            (lift as { muscle_group?: string } | null)?.muscle_group ?? null,
          weight_kg: Number(log.weight) || 0,
          reps: Number(log.reps) || 0,
        }
      }),
    },
    recent_sessions: (sessions ?? []).slice(0, 5).map((s) => {
      const sSplit = Array.isArray(s.splits) ? s.splits[0] : s.splits
      const sDay = Array.isArray(s.split_days) ? s.split_days[0] : s.split_days
      return {
        date: s.finished_at ?? s.started_at,
        volume_kg: Number(s.total_volume) || 0,
        sets: s.total_sets_completed,
        split: (sSplit as { name?: string } | null)?.name ?? null,
        day: (sDay as { name?: string } | null)?.name ?? null,
      }
    }),
    current_prs: (prs ?? []).map((row) => {
      const lift = Array.isArray(row.lift_types)
        ? row.lift_types[0]
        : row.lift_types
      return {
        exercise: (lift as { name?: string } | null)?.name ?? 'Lift',
        muscle_group:
          (lift as { muscle_group?: string } | null)?.muscle_group ?? null,
        weight_kg: Number(row.weight) || 0,
        reps: Number(row.reps) || 0,
        logged_at: row.logged_at,
      }
    }),
  }

  return { latest, context }
}

function parseInsightJson(raw: string): { headline: string; detail: string } | null {
  const trimmed = raw.trim()
  try {
    const parsed = JSON.parse(trimmed) as {
      headline?: unknown
      detail?: unknown
    }
    const headline = String(parsed.headline ?? '').trim()
    const detail = String(parsed.detail ?? '').trim()
    if (!headline || !detail) return null
    return {
      headline: headline.slice(0, 80),
      detail: detail.slice(0, 600),
    }
  } catch {
    const fence = trimmed.match(/\{[\s\S]*\}/)
    if (!fence) return null
    try {
      const parsed = JSON.parse(fence[0]) as {
        headline?: unknown
        detail?: unknown
      }
      const headline = String(parsed.headline ?? '').trim()
      const detail = String(parsed.detail ?? '').trim()
      if (!headline || !detail) return null
      return { headline: headline.slice(0, 80), detail: detail.slice(0, 600) }
    } catch {
      return null
    }
  }
}

async function generateInsightWithGemini(
  context: NonNullable<Awaited<ReturnType<typeof gatherTrainingContext>>['context']>,
  locale: InsightLocale = 'en',
): Promise<{ headline: string; detail: string } | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[ai_insights] GEMINI_API_KEY missing')
    return null
  }

  const ai = new GoogleGenAI({ apiKey })
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Athlete training data (JSON):\n${JSON.stringify(context)}`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: locale === 'ar' ? INSIGHT_SYSTEM_AR : INSIGHT_SYSTEM,
      temperature: 0.55,
      responseMimeType: 'application/json',
    },
  })

  const text = response.text?.trim()
  if (!text) return null
  return parseInsightJson(text)
}

function sessionMetaFromLatest(latest: {
  finished_at: string | null
  started_at: string
  total_volume: number | string | null
  total_sets_completed: number | null
}): string {
  const finishedAt = latest.finished_at ?? latest.started_at
  const sets = latest.total_sets_completed ?? 0
  const volume = formatVolume(Number(latest.total_volume) || 0)
  return `${formatSessionDate(finishedAt)} · ${sets} sets · ${volume}`
}

async function saveInsight(input: {
  userId: string
  headline: string
  detail: string
  sourceSessionId: string
  language: InsightLocale
}): Promise<AiInsight | null> {
  const supabase = await createClient()
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('ai_insights')
    .insert({
      user_id: input.userId,
      headline: input.headline,
      detail: input.detail,
      source_session_id: input.sourceSessionId,
      generated_at: now,
      language: input.language,
    })
    .select(
      'id, user_id, headline, detail, source_session_id, generated_at, created_at, language',
    )
    .single()

  if (error) {
    console.error('[ai_insights insert]', error.message)
    return null
  }
  return data as AiInsight
}

/**
 * Return a displayable insight for the Workout (and other) cards.
 * Regenerates via Gemini only when missing, >24h old, or newer session exists.
 */
export async function getOrRefreshCoachInsight(
  userId: string,
  options?: { force?: boolean },
): Promise<CoachInsightView> {
  const locale = await resolveInsightLocale(userId)
  const supabase = await createClient()
  const { data: latestSession } = await supabase
    .from('sessions')
    .select(
      'id, started_at, finished_at, total_volume, total_sets_completed',
    )
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const emptyCopy =
    locale === 'ar'
      ? {
          headline: 'سجّل أول جلسة',
          detail:
            'سجّل أول جلسة وسأبدأ برصد الأنماط لك — رفعات محورية، فجوات الحجم، وما يجب دفعه تالياً.',
        }
      : {
          headline: 'Log your first session',
          detail:
            "Log your first session and I'll start spotting patterns for you — leverage lifts, volume gaps, and what to push next.",
        }

  if (!latestSession) {
    return {
      kind: 'empty',
      headline: emptyCopy.headline,
      detail: emptyCopy.detail,
      sessionMeta: null,
      sourceSessionId: null,
      generatedAt: null,
    }
  }

  const finishedAt = latestSession.finished_at ?? latestSession.started_at
  const cached = await getLatestInsight(userId, locale)

  if (
    !options?.force &&
    !needsRefresh(cached, finishedAt, locale) &&
    cached
  ) {
    console.info('[ai_insights] cache hit', cached.id, locale)
    return {
      kind: 'insight',
      headline: cached.headline,
      detail: cached.detail,
      sessionMeta: sessionMetaFromLatest(latestSession),
      sourceSessionId: cached.source_session_id,
      generatedAt: cached.generated_at,
    }
  }

  try {
    console.info('[ai_insights] regenerating via Gemini', locale)
    const { latest, context } = await gatherTrainingContext(userId)
    if (!latest || !context) {
      return {
        kind: 'empty',
        headline: emptyCopy.headline,
        detail:
          locale === 'ar'
            ? 'سجّل أول جلسة وسأبدأ برصد الأنماط لك.'
            : "Log your first session and I'll start spotting patterns for you.",
        sessionMeta: null,
        sourceSessionId: null,
        generatedAt: null,
      }
    }

    const generated = await generateInsightWithGemini(context, locale)
    if (!generated) {
      // Fall back to cache if regenerate failed, else a safe heuristic.
      if (cached) {
        return {
          kind: 'insight',
          headline: cached.headline,
          detail: cached.detail,
          sessionMeta: sessionMetaFromLatest(latestSession),
          sourceSessionId: cached.source_session_id,
          generatedAt: cached.generated_at,
        }
      }
      const top = context.latest_session.sets
        .slice()
        .sort((a, b) => b.weight_kg - a.weight_kg)[0]
      const headline =
        locale === 'ar'
          ? top
            ? `${top.exercise} هو نقطة قوتك`
            : 'واصل تكديس الجلسات'
          : top
            ? `${top.exercise} is your leverage point`
            : 'Keep stacking sessions'
      const detail =
        locale === 'ar'
          ? top
            ? `في آخر جلسة وصلت ${top.weight_kg} كغ × ${top.reps} في ${top.exercise}. حافظ على الانتظام هذا الأسبوع وزد الحجم قليلاً قبل إعادة الاختبار.`
            : 'جلستك التالية ستفتح تلميحاً شخصياً لنقطة القوة.'
          : top
            ? `Last session you hit ${top.weight_kg} kg × ${top.reps} on ${top.exercise}. Stay consistent this week and nudge volume up slightly before retesting.`
            : 'Your next logged session will unlock a personalized leverage-point cue.'
      const saved = await saveInsight({
        userId,
        headline,
        detail,
        sourceSessionId: latest.id,
        language: locale,
      })
      return {
        kind: 'insight',
        headline: saved?.headline ?? headline,
        detail: saved?.detail ?? detail,
        sessionMeta: sessionMetaFromLatest(latestSession),
        sourceSessionId: latest.id,
        generatedAt: saved?.generated_at ?? new Date().toISOString(),
      }
    }

    const saved = await saveInsight({
      userId,
      headline: generated.headline,
      detail: generated.detail,
      sourceSessionId: latest.id,
      language: locale,
    })

    return {
      kind: 'insight',
      headline: saved?.headline ?? generated.headline,
      detail: saved?.detail ?? generated.detail,
      sessionMeta: sessionMetaFromLatest(latestSession),
      sourceSessionId: latest.id,
      generatedAt: saved?.generated_at ?? new Date().toISOString(),
    }
  } catch (err) {
    console.error('[ai_insights refresh]', err)
    if (cached) {
      return {
        kind: 'insight',
        headline: cached.headline,
        detail: cached.detail,
        sessionMeta: sessionMetaFromLatest(latestSession),
        sourceSessionId: cached.source_session_id,
        generatedAt: cached.generated_at,
      }
    }
    return {
      kind: 'empty',
      headline:
        locale === 'ar' ? 'نصيحة المدرب غير متاحة' : 'Coach insight unavailable',
      detail:
        locale === 'ar'
          ? 'تعذّر توليد نصيحة الآن. حدّث الصفحة بعد قليل.'
          : 'Could not generate a tip right now. Refresh in a moment.',
      sessionMeta: sessionMetaFromLatest(latestSession),
      sourceSessionId: latestSession.id,
      generatedAt: null,
    }
  }
}

/**
 * Fast path for page TTFB: return cached insight only — never call Gemini.
 * Use with `after(() => getOrRefreshCoachInsight(userId))` to refresh in background.
 */
export async function getCachedCoachInsight(
  userId: string,
): Promise<CoachInsightView> {
  try {
  const locale = await resolveInsightLocale(userId)
  const supabase = await createClient()
  const [{ data: latestSession }, cached] = await Promise.all([
    supabase
      .from('sessions')
      .select(
        'id, started_at, finished_at, total_volume, total_sets_completed',
      )
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    getLatestInsight(userId, locale),
  ])

  if (!latestSession) {
    return {
      kind: 'empty',
      headline:
        locale === 'ar' ? 'سجّل أول جلسة' : 'Log your first session',
      detail:
        locale === 'ar'
          ? 'سجّل أول جلسة وسأبدأ برصد الأنماط لك — رفعات محورية، فجوات الحجم، وما يجب دفعه تالياً.'
          : "Log your first session and I'll start spotting patterns for you — leverage lifts, volume gaps, and what to push next.",
      sessionMeta: null,
      sourceSessionId: null,
      generatedAt: null,
    }
  }

  if (cached) {
    return {
      kind: 'insight',
      headline: cached.headline,
      detail: cached.detail,
      sessionMeta: sessionMetaFromLatest(latestSession),
      sourceSessionId: cached.source_session_id,
      generatedAt: cached.generated_at,
    }
  }

  return {
    kind: 'empty',
    headline:
      locale === 'ar' ? 'نجهّز أول نصيحة' : 'Building your first tip',
    detail:
      locale === 'ar'
        ? 'أكمل مجموعة أخرى أو حدّث الصفحة بعد لحظات — نصيحة المدرب ستظهر هنا.'
        : 'Finish another set or refresh in a moment — your coach tip will land here.',
    sessionMeta: sessionMetaFromLatest(latestSession),
    sourceSessionId: latestSession.id,
    generatedAt: null,
  }
  } catch (err) {
    logServerError('[ai_insights] cached', err)
    return {
      kind: 'empty',
      headline: 'Log your first session',
      detail: 'Connect to load coach insights. Training still works offline.',
      sessionMeta: null,
      sourceSessionId: null,
      generatedAt: null,
    }
  }
}
