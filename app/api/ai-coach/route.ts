import { NextResponse } from 'next/server'
import {
  getUnmentionedChatCelebrations,
  markCelebrationsMentionedInChat,
} from '@/lib/ai/celebrations'
import { GeminiRateLimitError, runCoachTurn } from '@/lib/ai/coach'
import {
  getConversationForUser,
  getOrCreateLatestConversation,
  hydrateAgentActionStatuses,
  insertAiMessage,
  listConversations,
  mapMessagesWithUsedTools,
  extractCoachActionFromTrace,
  type AiMessageRow,
} from '@/lib/ai/conversations'
import {
  formatMemoriesForPrompt,
  getActiveMemories,
} from '@/lib/ai/memory'
import { isSplitProposal } from '@/lib/ai/action-types'
import { formatProposalForRevision } from '@/lib/ai/proposal-revision'
import { isSplitBuildIntent } from '@/lib/ai/split-intent'
import {
  formatSplitContextForPrompt,
  loadSplitBuildContext,
} from '@/lib/ai/split-context'
import {
  formatSessionContextForPrompt,
  parseSessionCoachContext,
} from '@/lib/ai/session-context'
import {
  formatAthleteContextForPrompt,
  loadAthleteContext,
} from '@/lib/ai/athlete-context'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.is_anonymous) {
    return NextResponse.json(
      { error: 'Create an account to use AI Coach.' },
      { status: 403 },
    )
  }

  try {
    const { searchParams } = new URL(request.url)
    const conversationId = searchParams.get('conversationId')
    const conversations = await listConversations(user.id)

    if (conversationId) {
      const loaded = await getConversationForUser(user.id, conversationId)
      if (!loaded) {
        return NextResponse.json(
          { error: 'Conversation not found.' },
          { status: 404 },
        )
      }
      return NextResponse.json({
        conversationId: loaded.conversation.id,
        title: loaded.conversation.title,
        messages: await hydrateAgentActionStatuses(
          user.id,
          mapMessagesWithUsedTools(loaded.messages),
        ),
        conversations,
      })
    }

    const { conversation, messages } = await getOrCreateLatestConversation(
      user.id,
    )
    return NextResponse.json({
      conversationId: conversation.id,
      title: conversation.title,
      messages: await hydrateAgentActionStatuses(
        user.id,
        mapMessagesWithUsedTools(messages),
      ),
      conversations:
        conversations.length > 0
          ? conversations
          : [conversation],
    })
  } catch (err) {
    console.error('[ai-coach GET]', err)
    return NextResponse.json(
      { error: 'Could not load conversation.' },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.is_anonymous) {
    return NextResponse.json(
      { error: 'Create an account to use AI Coach.' },
      { status: 403 },
    )
  }

  let body: {
    message?: string
    conversationId?: string
    action?: 'new' | 'chat'
    reviseProposal?: unknown
    ephemeral?: boolean
    sessionContext?: unknown
    history?: Array<{ role?: string; content?: string }>
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Open an empty conversation (reuse existing empty, else create).
  if (body.action === 'new') {
    try {
      const { conversation, messages } = await getOrCreateLatestConversation(
        user.id,
      )
      const conversations = await listConversations(user.id)
      return NextResponse.json({
        conversationId: conversation.id,
        title: conversation.title,
        messages: mapMessagesWithUsedTools(messages),
        conversations:
          conversations.length > 0 ? conversations : [conversation],
      })
    } catch (err) {
      console.error('[ai-coach new]', err)
      return NextResponse.json(
        { error: 'Could not start a new chat.' },
        { status: 500 },
      )
    }
  }

  const message = String(body.message ?? '').trim()
  if (!message) {
    return NextResponse.json({ error: 'Message is required.' }, { status: 400 })
  }
  if (message.length > 4000) {
    return NextResponse.json(
      { error: 'Message is too long.' },
      { status: 400 },
    )
  }

  const sessionContext = parseSessionCoachContext(body.sessionContext)
  const ephemeral = Boolean(body.ephemeral && sessionContext)

  if (body.ephemeral && !sessionContext) {
    return NextResponse.json(
      { error: 'Valid sessionContext is required for in-workout chat.' },
      { status: 400 },
    )
  }

  try {
    if (ephemeral && sessionContext) {
      const clientHistory = Array.isArray(body.history)
        ? body.history
            .filter(
              (row) =>
                row &&
                (row.role === 'user' || row.role === 'assistant') &&
                typeof row.content === 'string',
            )
            .slice(-20)
            .map((row) => ({
              role: row.role as 'user' | 'assistant',
              content: String(row.content).slice(0, 4000),
            }))
        : []

      const profileLang = await supabase
        .from('profiles')
        .select('language')
        .eq('id', user.id)
        .maybeSingle()
        .then((r) => (r.data?.language === 'ar' ? 'ar' : 'en') as 'en' | 'ar')

      const [memories, athlete] = await Promise.all([
        getActiveMemories(user.id),
        loadAthleteContext(user.id),
      ])
      const memoryBlock = [
        athlete ? formatAthleteContextForPrompt(athlete) : '',
        formatMemoriesForPrompt(memories),
        formatSessionContextForPrompt(sessionContext),
      ]
        .filter(Boolean)
        .join('\n\n')

      const { text, toolTrace } = await runCoachTurn({
        userId: user.id,
        conversationId: null,
        history: clientHistory,
        userMessage: message,
        memoryBlock,
        locale: athlete?.language === 'ar' ? 'ar' : profileLang,
        liveSessionMode: true,
      })

      return NextResponse.json({
        ephemeral: true,
        assistantMessage: {
          id: `ephemeral-${Date.now()}`,
          role: 'assistant',
          content: text,
          createdAt: new Date().toISOString(),
          usedTools: toolTrace.some((t) => t.name !== 'save_user_note'),
        },
      })
    }

    let conversationId = body.conversationId
    let historyMessages: AiMessageRow[] = []

    if (conversationId) {
      const loaded = await getConversationForUser(user.id, conversationId)
      if (!loaded) {
        return NextResponse.json(
          { error: 'Conversation not found.' },
          { status: 404 },
        )
      }
      historyMessages = loaded.messages
    } else {
      const latest = await getOrCreateLatestConversation(user.id)
      conversationId = latest.conversation.id
      historyMessages = latest.messages
    }

    const history = historyMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    const reviseProposal = isSplitProposal(body.reviseProposal)
      ? body.reviseProposal
      : null

    const splitBuildMode =
      isSplitBuildIntent(message, history) || Boolean(reviseProposal)
    const revisePendingSplit =
      Boolean(reviseProposal) && reviseProposal!.kind === 'create_split'

    const [celebrations, memories, profileLang, splitContext, athlete] =
      await Promise.all([
      getUnmentionedChatCelebrations(user.id),
      getActiveMemories(user.id),
      supabase
        .from('profiles')
        .select('language')
        .eq('id', user.id)
        .maybeSingle()
        .then((r) => (r.data?.language === 'ar' ? 'ar' : 'en') as 'en' | 'ar'),
      splitBuildMode ? loadSplitBuildContext(user.id) : Promise.resolve(null),
      loadAthleteContext(user.id),
    ])

    const locale = athlete?.language === 'ar' ? 'ar' : profileLang
    const wantsProfileHelp =
      /\b(finish|complete|fill|update|set up|setup)\b.*\b(profile|fitness|body|weight|height|goal)\b/i.test(
        message,
      ) ||
      /\b(help me.*(profile|missing)|my fitness profile is incomplete)\b/i.test(
        message,
      ) ||
      /أكمل|ملف اللياقة|الملف الرياضي|وزني|طولي/i.test(message)

    const needsProfileInterview =
      Boolean(athlete?.missingFields.length) &&
      !reviseProposal &&
      (splitBuildMode || wantsProfileHelp)

    if (needsProfileInterview && athlete) {
      const { orderProfileInterviewFields } = await import(
        '@/lib/ai/profile-interview'
      )
      const interviewPayload = {
        status: 'pending_confirmation' as const,
        interviewId: crypto.randomUUID(),
        fields: orderProfileInterviewFields(athlete.missingFields),
        preferredUnit: athlete.preferredUnit,
        resumePrompt: splitBuildMode ? message : null,
      }
      const assistantText =
        locale === 'ar'
          ? 'قبل ما نكمّل، عبّي التفاصيل الناقصة عبر الاختيارات في البطاقة أدناه — نفس أسلوب إنشاء برنامج بالذكاء الاصطناعي. بعد الحفظ أكمّل طلبك.'
          : 'Before we continue, fill in the missing details with the choice cards below — same style as Create Split with AI. After you save, I’ll pick up your request.'

      const userRow = await insertAiMessage({
        conversationId,
        userId: user.id,
        role: 'user',
        content: message,
      })
      await insertAiMessage({
        conversationId,
        userId: user.id,
        role: 'tool',
        toolName: 'propose_profile_interview',
        content: JSON.stringify(interviewPayload),
      })
      const assistantRow = await insertAiMessage({
        conversationId,
        userId: user.id,
        role: 'assistant',
        content: assistantText,
      })
      const conversations = await listConversations(user.id)
      const active = conversations.find((c) => c.id === conversationId)
      return NextResponse.json({
        conversationId,
        title: active?.title ?? null,
        conversations,
        userMessage: {
          id: userRow.id,
          role: 'user',
          content: userRow.content,
          createdAt: userRow.created_at,
        },
        assistantMessage: {
          id: assistantRow.id,
          role: 'assistant',
          content: assistantRow.content,
          createdAt: assistantRow.created_at,
          usedTools: true,
          action: extractCoachActionFromTrace([
            { name: 'propose_profile_interview', result: interviewPayload },
          ]),
        },
        meta: { splitBuildMode, profileInterview: true },
      })
    }

    const celebrationContext =
      celebrations.length > 0
        ? celebrations
            .map((c) => `${c.title}${c.body ? ` (${c.body})` : ''}`)
            .join('; ')
        : null
    const memoryBlock = [
      athlete ? formatAthleteContextForPrompt(athlete) : '',
      formatMemoriesForPrompt(memories),
      splitContext
        ? formatSplitContextForPrompt(
            splitContext.preferences,
            splitContext.slots,
            splitContext.profileInput,
          )
        : '',
      reviseProposal ? formatProposalForRevision(reviseProposal) : '',
    ]
      .filter(Boolean)
      .join('\n\n')

    const { text, toolTrace } = await runCoachTurn({
      userId: user.id,
      conversationId,
      history,
      userMessage: message,
      celebrationContext,
      memoryBlock,
      locale,
      splitBuildMode,
      revisePendingSplit,
    })

    const userRow = await insertAiMessage({
      conversationId,
      userId: user.id,
      role: 'user',
      content: message,
    })

    await Promise.all(
      toolTrace.map((tool) =>
        insertAiMessage({
          conversationId,
          userId: user.id,
          role: 'tool',
          content: JSON.stringify(tool.result),
          toolName: tool.name,
        }),
      ),
    )

    if (celebrations.length > 0) {
      await markCelebrationsMentionedInChat(
        user.id,
        celebrations.map((c) => c.id),
      )
    }

    const assistantRow = await insertAiMessage({
      conversationId,
      userId: user.id,
      role: 'assistant',
      content: text,
    })

    const conversations = await listConversations(user.id)
    const active = conversations.find((c) => c.id === conversationId)

    return NextResponse.json({
      conversationId,
      title: active?.title ?? null,
      conversations,
      userMessage: {
        id: userRow.id,
        role: 'user',
        content: userRow.content,
        createdAt: userRow.created_at,
      },
      assistantMessage: {
        id: assistantRow.id,
        role: 'assistant',
        content: assistantRow.content,
        createdAt: assistantRow.created_at,
        usedTools: toolTrace.some((t) => t.name !== 'save_user_note'),
        action: extractCoachActionFromTrace(toolTrace),
      },
      meta: { splitBuildMode },
    })
  } catch (err) {
    console.error('[ai-coach POST]', err)
    if (err instanceof GeminiRateLimitError) {
      // Re-read language for error copy if the failure happened after profileLang was set.
      let ar = false
      try {
        const { data } = await supabase
          .from('profiles')
          .select('language')
          .eq('id', user.id)
          .maybeSingle()
        ar = data?.language === 'ar'
      } catch {
        /* ignore */
      }
      return NextResponse.json(
        {
          error: ar
            ? 'أتلقى الكثير من الأسئلة الآن — حاول بعد قليل.'
            : "I'm getting a lot of questions right now — try again in a bit.",
          code: 'rate_limited',
        },
        { status: 429 },
      )
    }
    const msg = err instanceof Error ? err.message : 'Coach failed.'
    if (msg.includes('GEMINI_API_KEY')) {
      return NextResponse.json(
        { error: 'AI Coach is not configured yet (missing GEMINI_API_KEY).' },
        { status: 503 },
      )
    }
    if (/column|schema cache|relation|policy|permission/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            'Chat storage is out of date. Check ai_conversations / ai_messages / ai_user_memory in Supabase.',
          detail: msg,
        },
        { status: 500 },
      )
    }
    return NextResponse.json(
      { error: 'Could not reach the coach. Please try again.', detail: msg },
      { status: 500 },
    )
  }
}
