import { NextResponse } from 'next/server'
import {
  getUnmentionedChatCelebrations,
  markCelebrationsMentionedInChat,
} from '@/lib/ai/celebrations'
import { GeminiRateLimitError, runCoachTurn } from '@/lib/ai/coach'
import {
  getConversationForUser,
  getOrCreateLatestConversation,
  insertAiMessage,
  listConversations,
  mapMessagesWithUsedTools,
  type AiMessageRow,
} from '@/lib/ai/conversations'
import {
  formatMemoriesForPrompt,
  getActiveMemories,
} from '@/lib/ai/memory'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
        messages: mapMessagesWithUsedTools(loaded.messages),
        conversations,
      })
    }

    const { conversation, messages } = await getOrCreateLatestConversation(
      user.id,
    )
    return NextResponse.json({
      conversationId: conversation.id,
      title: conversation.title,
      messages: mapMessagesWithUsedTools(messages),
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

  let body: {
    message?: string
    conversationId?: string
    action?: 'new' | 'chat'
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

  try {
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

    const userRow = await insertAiMessage({
      conversationId,
      userId: user.id,
      role: 'user',
      content: message,
    })

    const [celebrations, memories, profileLang] = await Promise.all([
      getUnmentionedChatCelebrations(user.id),
      getActiveMemories(user.id),
      supabase
        .from('profiles')
        .select('language')
        .eq('id', user.id)
        .maybeSingle()
        .then((r) => (r.data?.language === 'ar' ? 'ar' : 'en') as 'en' | 'ar'),
    ])
    const celebrationContext =
      celebrations.length > 0
        ? celebrations
            .map((c) => `${c.title}${c.body ? ` (${c.body})` : ''}`)
            .join('; ')
        : null
    const memoryBlock = formatMemoriesForPrompt(memories)

    const history = historyMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    const { text, toolTrace } = await runCoachTurn({
      userId: user.id,
      history,
      userMessage: message,
      celebrationContext,
      memoryBlock,
      locale: profileLang,
    })

    for (const tool of toolTrace) {
      await insertAiMessage({
        conversationId,
        userId: user.id,
        role: 'tool',
        content: JSON.stringify(tool.result),
        toolName: tool.name,
      })
    }

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
      },
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
