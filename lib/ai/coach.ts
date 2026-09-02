import {
  GoogleGenAI,
  type Content,
  type FunctionCall,
  type Part,
} from '@google/genai'
import {
  isSessionProposal,
  isSplitProposal,
  type SessionProposal,
  type SplitProposal,
} from '@/lib/ai/action-types'
import type { AgentToolContext } from '@/lib/ai/agent/tool-bridge'
import type { AgentPreview } from '@/lib/ai/agent/types'
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
  /** Conversation the turn belongs to — recorded on queued agent actions. */
  conversationId?: string | null
  history: ChatTurn[]
  userMessage: string
  celebrationContext?: string | null
  /** Pre-fetched active memory block for the system prompt. */
  memoryBlock?: string
  /** UI language — coach replies in Arabic when 'ar'. */
  locale?: 'en' | 'ar'
  /** Pre-fetched split programming context (skips redundant read tools). */
  splitBuildMode?: boolean
  /** Pending unsaved split preview the athlete is revising. */
  revisePendingSplit?: boolean
  /** In-workout session chat on the live set-logging screen. */
  liveSessionMode?: boolean
}): Promise<{ text: string; toolTrace: Array<{ name: string; result: unknown }> }> {
  const ai = getClient()
  const toolTrace: Array<{ name: string; result: unknown }> = []
  const systemInstruction = buildCoachSystemPrompt(
    input.memoryBlock ?? '',
    input.locale ?? 'en',
    {
      splitBuildMode: input.splitBuildMode,
      revisePendingSplit: input.revisePendingSplit,
      liveSessionMode: input.liveSessionMode,
    },
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
      toolContext: {
        userId: input.userId,
        conversationId: input.conversationId ?? null,
        requestText: input.userMessage,
      },
      toolTrace,
      systemInstruction,
      locale: input.locale ?? 'en',
      splitBuildMode: input.splitBuildMode,
      revisePendingSplit: input.revisePendingSplit,
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

type PendingProposal =
  | { kind: 'split'; proposal: SplitProposal }
  | { kind: 'session'; proposal: SessionProposal }
  | { kind: 'agent'; preview: AgentPreview }

function findPendingProposal(
  toolTrace: Array<{ name: string; result: unknown }>,
): PendingProposal | null {
  for (let i = toolTrace.length - 1; i >= 0; i -= 1) {
    const result = toolTrace[i].result
    if (!result || typeof result !== 'object') continue
    const row = result as {
      status?: string
      proposal?: unknown
      pendingActionId?: string
      preview?: AgentPreview
    }
    if (row.status !== 'pending_confirmation') continue
    if (isSplitProposal(row.proposal)) {
      return { kind: 'split', proposal: row.proposal }
    }
    if (isSessionProposal(row.proposal)) {
      return { kind: 'session', proposal: row.proposal }
    }
    if (row.pendingActionId && row.preview) {
      return { kind: 'agent', preview: row.preview }
    }
  }
  return null
}

function proposalReadyText(pending: PendingProposal, locale: 'en' | 'ar'): string {
  if (pending.kind === 'agent') {
    const title = pending.preview.title
    return locale === 'ar'
      ? `جهّزت هذا التغيير: ${title}. راجع البطاقة أدناه واضغط تأكيد — لم يُطبَّق شيء بعد.`
      : `Here's what I'll do: ${title}. Review the card below and tap Confirm — nothing has changed yet.`
  }

  if (pending.kind === 'split') {
    const { name, days, kind } = pending.proposal
    if (locale === 'ar') {
      const action =
        kind === 'update_split' ? 'تحديث البرنامج' : 'حفظ البرنامج'
      return `جهّزت لك "${name}" (${days.length} أيام). راجع البطاقة الذهبية أدناه واضغط ${action} لإضافته إلى برامجك — لم يُحفظ بعد.`
    }
    const action = kind === 'update_split' ? 'Save changes' : 'Save split'
    return `I've built "${name}" (${days.length} days). Review the gold card below and tap ${action} to add it to your programs — it is not saved yet.`
  }

  const { kind, splitName } = pending.proposal
  if (locale === 'ar') {
    if (kind === 'discard_session') {
      return 'راجع تأكيد إلغاء الجلسة في البطاقة أدناه قبل المتابعة.'
    }
    if (kind === 'start_session' || kind === 'resume_session') {
      return `اضغط فتح في البطاقة أدناه لبدء أو متابعة ${splitName ? `"${splitName}"` : 'البرنامج'}.`
    }
    return `اضغط فتح في البطاقة أدناه لفتح ${splitName ? `"${splitName}"` : 'البرنامج'}.`
  }
  if (kind === 'discard_session') {
    return 'Review the discard confirmation in the card below before continuing.'
  }
  if (kind === 'start_session' || kind === 'resume_session') {
    return `Tap Open on the card below to start or resume${splitName ? ` "${splitName}"` : ' the workout'}.`
  }
  return `Tap Open on the card below to open${splitName ? ` "${splitName}"` : ' the program'}.`
}

function loopLimitText(locale: 'en' | 'ar'): string {
  return locale === 'ar'
    ? 'استغرق البحث في بياناتك وقتاً أطول من المعتاد. جرّب سؤالاً أقصر، أو اطلب برنامجاً بـ3 أيام فقط.'
    : 'Looking up your training data took longer than usual. Try a shorter ask, or request a 3-day split first.'
}

async function generateWithTools(input: {
  ai: GoogleGenAI
  model: string
  contents: Content[]
  toolContext: AgentToolContext
  toolTrace: Array<{ name: string; result: unknown }>
  systemInstruction: string
  locale: 'en' | 'ar'
  splitBuildMode?: boolean
  revisePendingSplit?: boolean
}): Promise<string> {
  const working = [...input.contents]
  const fastPath = input.splitBuildMode || input.revisePendingSplit
  const maxRounds = fastPath ? 8 : 14

  for (let round = 0; round < maxRounds; round += 1) {
    let response
    try {
      response = await input.ai.models.generateContent({
        model: input.model,
        contents: working,
        config: {
          systemInstruction: input.systemInstruction,
          tools: [{ functionDeclarations: COACH_TOOL_DECLARATIONS }],
          temperature: fastPath ? 0.35 : 0.7,
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

      const toolResults = await Promise.all(
        (functionCalls as FunctionCall[]).map(async (call) => {
          const name = call.name ?? ''
          const args = { ...(call.args ?? {}) } as Record<string, unknown>
          delete args.user_id
          delete args.userId
          const result = await executeCoachTool(input.toolContext, name, args)
          return { call, name, result }
        }),
      )

      for (const { call, name, result } of toolResults) {
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

      const pending = findPendingProposal(input.toolTrace)
      if (pending) {
        return proposalReadyText(pending, input.locale)
      }

      continue
    }

    const text = response.text?.trim()
    if (text) return text

    const pending = findPendingProposal(input.toolTrace)
    if (pending) {
      return proposalReadyText(pending, input.locale)
    }

    return input.locale === 'ar'
      ? 'فهمت سؤالك — جرّب إعادة صياغته بمزيد من التفاصيل.'
      : "I've got your question — try asking again with a bit more detail."
  }

  const pending = findPendingProposal(input.toolTrace)
  if (pending) {
    return proposalReadyText(pending, input.locale)
  }

  return loopLimitText(input.locale)
}
