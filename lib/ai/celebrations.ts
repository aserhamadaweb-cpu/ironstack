import { createClient } from '@/lib/supabase/server'

export type AiCelebration = {
  id: string
  user_id: string
  kind: string
  title: string
  body: string | null
  lift_name: string | null
  weight: number | null
  reps: number | null
  session_id: string | null
  banner_shown: boolean
  mentioned_in_chat: boolean
  created_at: string
}

export async function createPrCelebrations(input: {
  userId: string
  sessionId: string
  prs: Array<{ liftName: string; weight: number; reps: number }>
}) {
  if (input.prs.length === 0) return null

  const supabase = await createClient()
  const count = input.prs.length
  const title =
    count === 1
      ? `New PR: ${input.prs[0].liftName}`
      : `${count} new PRs this session!`
  const body =
    count === 1
      ? `${input.prs[0].weight} kg × ${input.prs[0].reps}`
      : input.prs
          .map((p) => `${p.liftName} — ${p.weight} kg × ${p.reps}`)
          .join(' · ')

  const { data } = await supabase
    .from('ai_celebrations')
    .insert({
      user_id: input.userId,
      kind: 'pr',
      title,
      body,
      lift_name: count === 1 ? input.prs[0].liftName : null,
      weight: count === 1 ? input.prs[0].weight : null,
      reps: count === 1 ? input.prs[0].reps : null,
      session_id: input.sessionId,
      banner_shown: false,
      mentioned_in_chat: false,
    })
    .select(
      'id, user_id, kind, title, body, lift_name, weight, reps, session_id, banner_shown, mentioned_in_chat, created_at',
    )
    .single()

  return data as AiCelebration | null
}

export async function getUnshownBannerCelebrations(
  userId: string,
): Promise<AiCelebration[]> {
  try {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ai_celebrations')
    .select(
      'id, user_id, kind, title, body, lift_name, weight, reps, session_id, banner_shown, mentioned_in_chat, created_at',
    )
    .eq('user_id', userId)
    .eq('banner_shown', false)
    .order('created_at', { ascending: false })
    .limit(10)

  return (data ?? []) as AiCelebration[]
  } catch {
    return []
  }
}

export async function markCelebrationsBannerShown(
  userId: string,
  ids: string[],
) {
  if (ids.length === 0) return
  const supabase = await createClient()
  await supabase
    .from('ai_celebrations')
    .update({ banner_shown: true })
    .eq('user_id', userId)
    .in('id', ids)
}

export async function getUnmentionedChatCelebrations(
  userId: string,
): Promise<AiCelebration[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('ai_celebrations')
    .select(
      'id, user_id, kind, title, body, lift_name, weight, reps, session_id, banner_shown, mentioned_in_chat, created_at',
    )
    .eq('user_id', userId)
    .eq('mentioned_in_chat', false)
    .order('created_at', { ascending: false })
    .limit(5)

  return (data ?? []) as AiCelebration[]
}

export async function markCelebrationsMentionedInChat(
  userId: string,
  ids: string[],
) {
  if (ids.length === 0) return
  const supabase = await createClient()
  await supabase
    .from('ai_celebrations')
    .update({ mentioned_in_chat: true })
    .eq('user_id', userId)
    .in('id', ids)
}
