import {
  GoogleGenAI,
  type Content,
  type FunctionCall,
  type Part,
} from '@google/genai'
import { GEMINI_MODEL, buildCoachSystemPrompt } from '@/lib/ai/prompt'
import { COACH_TOOL_DECLARATIONS, executeCoachTool } from '@/lib/ai/tools'

export class GeminiRateLimitError extends Error {
  constructor(message = 'rate_limited') {
    super(message)
    this.name = 'GeminiRateLimitError'
  }
}

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.')
  }
  return new GoogleGenAI({ apiKey })
}

function isRateLimit(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()
  return (
    lower.includes('429') ||
    lower.includes('rate') ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted')
  )
}

/** Log the full Gemini error body (message often embeds JSON with the real cause). */
function logGeminiError(err: unknown, context: string) {
  const anyErr = err as {
    message?: string
    status?: number
    error?: unknown
    response?: unknown
    cause?: unknown
  }
  console.error(`[ai-coach Gemini] ${context}`, {
    status: anyErr?.status ?? null,
    message: anyErr?.message ?? String(err),
    error: anyErr?.error ?? null,
    response: anyErr?.response ?? null,
    cause: anyErr?.cause ?? null,
    raw: err,
  })
}

export type ChatTurn = {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Run a Gemini generateContent loop with tools. userId is only used for tool
 * execution and never sent to the model as a tool argument.
 */
export async function runCoachTurn(input: {
  userId: string
  history: ChatTurn[]
  userMessage: string
  celebrationContext?: string | null
  /** Pre-fetched active memory block for the system prompt. */
  memoryBlock?: string
  /** UI language — coach replies in Arabic when 'ar'. */
  locale?: 'en' | 'ar'
}): Promise<{ text: string; toolTrace: Array<{ name: string; result: unknown }> }> {
  const ai = getClient()
  const toolTrace: Array<{ name: string; result: unknown }> = []
  const systemInstruction = buildCoachSystemPrompt(
    input.memoryBlock ?? '',
    input.locale ?? 'en',
  )

  const contents: Content[] = []

  for (const turn of input.history.slice(-20)) {
    contents.push({
      role: turn.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: turn.content }],
    })
  }

  let userText = input.userMessage
  if (input.celebrationContext) {
    userText = `${input.userMessage}\n\n[Coach context — recent unmentioned celebrations to acknowledge warmly once: ${input.celebrationContext}]`
  }

  contents.push({
    role: 'user',
    parts: [{ text: userText }],
  })

  try {
    const text = await generateWithTools({
      ai,
      model: GEMINI_MODEL,
      contents,
      userId: input.userId,
      toolTrace,
      systemInstruction,
    })
    return { text, toolTrace }
  } catch (err) {
    logGeminiError(err, 'runCoachTurn failed')
    if (isRateLimit(err)) throw new GeminiRateLimitError()
    throw err instanceof Error
      ? err
      : new Error('Coach could not respond right now.')
  }
}

async function generateWithTools(input: {
  ai: GoogleGenAI
  model: string
  contents: Content[]
  userId: string
  toolTrace: Array<{ name: string; result: unknown }>
  systemInstruction: string
}): Promise<string> {
  const working = [...input.contents]
  const maxRounds = 5

  for (let round = 0; round < maxRounds; round += 1) {
    let response
    try {
      response = await input.ai.models.generateContent({
        model: input.model,
        contents: working,
        config: {
          systemInstruction: input.systemInstruction,
          tools: [{ functionDeclarations: COACH_TOOL_DECLARATIONS }],
          temperature: 0.7,
        },
      })
    } catch (err) {
      logGeminiError(err, `generateContent round=${round} model=${input.model}`)
      throw err
    }

    const functionCalls = response.functionCalls ?? []
    if (functionCalls.length > 0) {
      // Gemini 3 requires thoughtSignature on functionCall parts — push the
      // original model content as-is; never rebuild parts and drop the signature.
      const modelContent = response.candidates?.[0]?.content
      if (!modelContent?.parts?.length) {
        throw new Error('Model requested tools but returned no content parts.')
      }
      working.push(modelContent)

      const responseParts: Part[] = []

      for (const call of functionCalls as FunctionCall[]) {
        const name = call.name ?? ''
        const args = { ...(call.args ?? {}) } as Record<string, unknown>
        // Strip any attempted user_id from the model — never trust it.
        delete args.user_id
        delete args.userId

        const result = await executeCoachTool(input.userId, name, args)
        input.toolTrace.push({ name, result })

        const functionResponse: Part['functionResponse'] = {
          name,
          response: (result ?? { ok: true }) as Record<string, unknown>,
        }
        if (call.id) {
          functionResponse.id = call.id
        }
        responseParts.push({ functionResponse })
      }

      working.push({ role: 'user', parts: responseParts })
      continue
    }

    const text = response.text?.trim()
    if (text) return text

    return "I've got your question — try asking again with a bit more detail."
  }

  return 'I ran into a loop looking up your training data. Try a shorter question.'
}
