import { redirect } from 'next/navigation'
import { AiCoachChat } from '@/components/ai-coach-chat'
import { GuestBlockedScreen } from '@/components/guest-blocked-screen'
import { GuestPageGate } from '@/components/guest-page-gate'
import { OfflineConnectionGate } from '@/components/offline-connection-gate'
import { PageError } from '@/components/page-states'
import {
  getUnmentionedChatCelebrations,
  markCelebrationsMentionedInChat,
} from '@/lib/ai/celebrations'
import {
  getOrCreateLatestConversation,
  insertAiMessage,
  listConversations,
  mapMessagesWithUsedTools,
} from '@/lib/ai/conversations'
import { getActiveMemories } from '@/lib/ai/memory'
import { countCompletedSessions, getProfile } from '@/lib/data/queries'
import { getIsGuestAction } from '@/lib/data/profile-actions'
import { onboardingDataFromUser } from '@/lib/data/onboarding-read'
import {
  completenessFromOnboarding,
  getMissingProfileFields,
} from '@/lib/profile-completeness'
import { initialsFrom } from '@/lib/dashboard-utils'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'AI Coach — IRONSTACK',
  description: 'Your personal AI training companion powered by live data.',
}

export default async function AiCoachPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (await getIsGuestAction()) {
    const profileResult = await getProfile(user.id)
    const displayName =
      profileResult.data?.display_name ||
      user.email?.split('@')[0] ||
      'Athlete'
    return (
      <>

        <GuestBlockedScreen reason="aiCoach" returnPath="/dashboard/ai-coach/chat" />
      </>
    )
  }

  const profileResult = await getProfile(user.id)
  if (profileResult.error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <PageError message={profileResult.error} />
      </main>
    )
  }

  const displayName =
    profileResult.data?.display_name ||
    (typeof user.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name
      : null) ||
    user.email?.split('@')[0] ||
    'Athlete'

  const locale = profileResult.data?.language === 'ar' ? 'ar' : 'en'

  try {
    const [{ conversation, messages }, conversations, memories, trainedResult] =
      await Promise.all([
        getOrCreateLatestConversation(user.id),
        listConversations(user.id),
        getActiveMemories(user.id),
        countCompletedSessions(user.id),
      ])

    let chatMessages = mapMessagesWithUsedTools(messages)

    const profile = profileResult.data
    const onboarding = onboardingDataFromUser(user, profile ?? undefined)
    const missing = getMissingProfileFields(
      completenessFromOnboarding(onboarding, {
        weightKg:
          profile?.current_weight_kg != null
            ? Number(profile.current_weight_kg)
            : onboarding.weightKg,
        heightCm: profile?.height_cm ?? onboarding.heightCm,
        gender: profile?.gender ?? onboarding.gender,
        birthDate: profile?.birth_date ?? null,
      }),
    )

    const pendingCelebrations = await getUnmentionedChatCelebrations(user.id)
    if (pendingCelebrations.length > 0) {
      const opener =
        locale === 'ar'
          ? pendingCelebrations.length === 1
            ? `إنجاز كبير — ${pendingCelebrations[0].title}${
                pendingCelebrations[0].body
                  ? ` (${pendingCelebrations[0].body})`
                  : ''
              }. تريد أن نحلل ما دفعه، أو نختار الهدف التالي؟`
            : `احتفل بهذا — ${pendingCelebrations
                .map((c) => c.title)
                .join('؛ ')}. تريد توجيهاً لما تطارد تالياً؟`
          : pendingCelebrations.length === 1
            ? `Huge win — ${pendingCelebrations[0].title}${
                pendingCelebrations[0].body
                  ? ` (${pendingCelebrations[0].body})`
                  : ''
              }. Want to dig into what drove it, or pick the next target?`
            : `Celebrate this — ${pendingCelebrations
                .map((c) => c.title)
                .join('; ')}. Want coaching on what to chase next?`

      const row = await insertAiMessage({
        conversationId: conversation.id,
        userId: user.id,
        role: 'assistant',
        content: opener,
      })
      await markCelebrationsMentionedInChat(
        user.id,
        pendingCelebrations.map((c) => c.id),
      )
      chatMessages = [
        ...chatMessages,
        {
          id: row.id,
          role: 'assistant',
          content: row.content,
          createdAt: row.created_at,
          usedTools: false,
        },
      ]
    }

    return (
      <OfflineConnectionGate feature="coach">
      <GuestPageGate reason="aiCoach" returnPath="/dashboard/ai-coach/chat">
      <AiCoachChat
        displayName={displayName}
        initials={initialsFrom(displayName)}
        avatarUrl={profileResult.data?.avatar_url}
        isGuest={profileResult.data?.is_guest === true}
        conversationId={conversation.id}
        initialMessages={chatMessages}
        initialConversations={(
          conversations.length > 0 ? conversations : [conversation]
        ).map((c) => ({
          id: c.id,
          title: c.title,
          updated_at: c.updated_at,
        }))}
        initialMemories={memories.map((m) => ({
          id: m.id,
          fact: m.fact,
          category: m.category,
          updatedAt: m.updated_at,
        }))}
        profileMissingCount={missing.length}
        profileMissingLabels={missing}
        hasTrained={(trainedResult.data ?? 0) > 0}
      />
      </GuestPageGate>
      </OfflineConnectionGate>
    )
  } catch (err) {
    console.error('[ai-coach page]', err)
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <PageError message="Could not load AI Coach. Check ai_conversations / ai_messages / ai_user_memory in Supabase." />
      </main>
    )
  }
}
