import { GoogleGenAI } from '@google/genai'
import { GEMINI_MODEL } from '@/lib/ai/prompt'
import type { DayFocusId } from './day-slot-presets'
import { defaultDayFocusRotation } from './day-slot-presets'
import type { RecommendationInput } from './types'

export type CustomSplitIntent = {
  name: string
  description: string
  daysPerWeek: number
  dayFocuses: DayFocusId[]
  assumptions: string[]
}

const VALID_FOCUS = new Set<DayFocusId>([
  'full_body',
  'upper',
  'lower',
  'push',
  'pull',
  'legs',
  'chest_back',
])

const INTENT_SYSTEM = `You parse natural-language workout split requests into JSON for a fitness app backend.
Return ONLY valid JSON with this shape:
{
  "name": "short program title",
  "description": "one sentence summary",
  "daysPerWeek": number (1-7),
  "dayFocuses": array of length daysPerWeek, each one of: full_body, upper, lower, push, pull, legs, chest_back,
  "assumptions": string[] (optional notes, max 4)
}
Rules:
- dayFocuses.length MUST equal daysPerWeek.
- Map bro split / body-part splits to push, pull, legs, upper, lower, or chest_back — never invent focus ids.
- For "chest and back" or dumbbell chest/back programs, prefer chest_back focus days.
- For PPL, rotate push, pull, legs.
- For upper/lower, alternate upper, lower.
- Keep name under 60 characters.`

function clampDays(n: number, input: RecommendationInput): number {
  const raw = Math.min(7, Math.max(1, Math.floor(n) || input.daysPerWeek))
  return input.seniorMode ? Math.min(raw, 5) : raw
}

function parseDaysFromText(text: string, fallback: number): number {
  const lower = text.toLowerCase()
  const numeric = lower.match(/\b([3-7])\s*-?\s*days?\b/)
  if (numeric) return parseInt(numeric[1]!, 10)
  const words: Record<string, number> = {
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
  }
  for (const [word, n] of Object.entries(words)) {
    if (new RegExp(`\\b${word}\\b`).test(lower) && /\bday/.test(lower)) return n
  }
  return fallback
}

function focusRotationForPrompt(text: string, days: number): DayFocusId[] {
  const lower = text.toLowerCase()
  if (/bro[\s-]?split|arms day|shoulders day|chest day|back day/.test(lower)) {
    return ['push', 'pull', 'legs', 'push', 'pull', 'legs'].slice(0, days) as DayFocusId[]
  }
  if (/push[\s-]?pull[\s-]?legs|\bppl\b/.test(lower)) {
    return ['push', 'pull', 'legs', 'push', 'pull', 'legs'].slice(0, days) as DayFocusId[]
  }
  if (/upper[\s-]?lower|\bul\b/.test(lower)) {
    return ['upper', 'lower', 'upper', 'lower', 'upper', 'lower', 'upper'].slice(
      0,
      days,
    ) as DayFocusId[]
  }
  if (/chest.*back|back.*chest|dumbbell.*(chest|back)/.test(lower)) {
    return Array(days).fill('chest_back') as DayFocusId[]
  }
  if (/full[\s-]?body/.test(lower)) {
    return Array(days).fill('full_body') as DayFocusId[]
  }
  return defaultDayFocusRotation(days)
}

/** Offline-safe intent parser for tests and LLM fallback. */
export function parseCustomSplitIntentHeuristic(
  prompt: string,
  input: RecommendationInput,
): CustomSplitIntent {
  const trimmed = prompt.trim()
  const daysPerWeek = clampDays(parseDaysFromText(trimmed, input.daysPerWeek), input)
  const dayFocuses = focusRotationForPrompt(trimmed, daysPerWeek)

  let name = `${daysPerWeek}-Day Custom Program`
  if (/bro[\s-]?split/i.test(trimmed)) name = `${daysPerWeek}-Day Bro Split`
  else if (/push[\s-]?pull|\bppl\b/i.test(trimmed)) name = `${daysPerWeek}-Day Push Pull Legs`
  else if (/upper[\s-]?lower/i.test(trimmed)) name = `${daysPerWeek}-Day Upper Lower`
  else if (/chest.*back|back.*chest/i.test(trimmed)) name = `${daysPerWeek}-Day Chest & Back`

  return {
    name,
    description: trimmed.slice(0, 240) || 'Custom program from your description.',
    daysPerWeek,
    dayFocuses,
    assumptions: [],
  }
}

function parseIntentJson(
  text: string,
  input: RecommendationInput,
): CustomSplitIntent | null {
  const trimmed = text.trim()
  const fence = trimmed.match(/\{[\s\S]*\}/)
  if (!fence) return null
  try {
    const parsed = JSON.parse(fence[0]) as {
      name?: unknown
      description?: unknown
      daysPerWeek?: unknown
      dayFocuses?: unknown
      assumptions?: unknown
    }
    const daysPerWeek = clampDays(Number(parsed.daysPerWeek), input)
    const rawFocuses = Array.isArray(parsed.dayFocuses)
      ? parsed.dayFocuses.map((f) => String(f).trim() as DayFocusId)
      : []
    const dayFocuses = (
      rawFocuses.length === daysPerWeek
        ? rawFocuses
        : defaultDayFocusRotation(daysPerWeek)
    ).map((f) => (VALID_FOCUS.has(f) ? f : 'full_body'))

    const name = String(parsed.name ?? '').trim().slice(0, 60)
    if (!name) return null

    const assumptions = Array.isArray(parsed.assumptions)
      ? parsed.assumptions.map((a) => String(a).trim()).filter(Boolean).slice(0, 4)
      : []

    return {
      name,
      description:
        String(parsed.description ?? '').trim().slice(0, 240) ||
        'Custom program from your description.',
      daysPerWeek,
      dayFocuses,
      assumptions,
    }
  } catch {
    return null
  }
}

/** LLM intent parse with heuristic fallback when Gemini is unavailable. */
export async function parseCustomSplitIntent(
  prompt: string,
  input: RecommendationInput,
): Promise<CustomSplitIntent> {
  const fallback = parseCustomSplitIntentHeuristic(prompt, input)
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey || !prompt.trim()) return fallback

  try {
    const ai = new GoogleGenAI({ apiKey })
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt.trim() }] }],
      config: {
        systemInstruction: INTENT_SYSTEM,
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    })
    const text = response.text?.trim()
    if (!text) return fallback
    return parseIntentJson(text, input) ?? fallback
  } catch (err) {
    console.error('[custom-split-intent]', err)
    return fallback
  }
}
