import { NextResponse } from 'next/server'
import {
  confirmCreateSplit,
  confirmDiscardSession,
  confirmUpdateSplit,
} from '@/lib/ai/confirm-actions'
import { isSessionProposal, isSplitProposal } from '@/lib/ai/action-types'
import { insertAiMessage } from '@/lib/ai/conversations'
import {
  answersToOnboardingPatch,
  isProfileInterviewStepComplete,
  type ProfileInterviewAnswers,
} from '@/lib/ai/profile-interview'
import { saveOnboardingProgressAction } from '@/lib/data/onboarding-actions'
import { logBodyWeightAction } from '@/lib/data/profile-actions'
import type { ProfileMissingField } from '@/lib/profile-completeness'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 60

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
    action?: string
    conversationId?: string
    proposal?: unknown
    interviewId?: string
    answers?: ProfileInterviewAnswers
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const conversationId = String(body.conversationId ?? '').trim()
  const kind = String(body.action ?? '').trim()

  try {
    if (kind === 'create_split' || kind === 'update_split') {
      if (!isSplitProposal(body.proposal)) {
        return NextResponse.json({ error: 'Invalid split proposal.' }, { status: 400 })
      }
      const proposal = body.proposal
      const result =
        kind === 'create_split'
          ? await confirmCreateSplit(user.id, proposal)
          : await confirmUpdateSplit(user.id, proposal)
      if (!result.ok) {
        const code =
          kind === 'create_split' && result.error.includes('custom splits')
            ? 'split_limit_reached'
            : undefined
        return NextResponse.json(
          { error: result.error, code },
          { status: 400 },
        )
      }
      if (conversationId) {
        try {
          await insertAiMessage({
            conversationId,
            userId: user.id,
            role: 'tool',
            toolName: kind === 'create_split' ? 'confirm_create_split' : 'confirm_update_split',
            content: JSON.stringify({
              applied: true,
              proposalId: proposal.id,
              splitId: result.splitId,
              href: result.href,
            }),
          })
        } catch (err) {
          console.error('[ai-coach actions] transcript', err)
        }
      }
      return NextResponse.json({
        ok: true,
        splitId: result.splitId,
        href: result.href,
      })
    }

    if (kind === 'cancel_proposal') {
      const proposal = body.proposal as { id?: string } | undefined
      const proposalId = String(proposal?.id ?? '').trim()
      if (conversationId && proposalId) {
        try {
          await insertAiMessage({
            conversationId,
            userId: user.id,
            role: 'tool',
            toolName: 'cancel_proposal',
            content: JSON.stringify({ cancelled: true, proposalId }),
          })
        } catch (err) {
          console.error('[ai-coach actions] cancel transcript', err)
        }
      }
      return NextResponse.json({ ok: true })
    }

    if (kind === 'discard_session') {
      if (!isSessionProposal(body.proposal) || body.proposal.kind !== 'discard_session') {
        return NextResponse.json({ error: 'Invalid discard proposal.' }, { status: 400 })
      }
      const sessionId = body.proposal.sessionId
      if (!sessionId) {
        return NextResponse.json({ error: 'Missing session id.' }, { status: 400 })
      }
      const result = await confirmDiscardSession(user.id, sessionId)
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      if (conversationId) {
        try {
          await insertAiMessage({
            conversationId,
            userId: user.id,
            role: 'tool',
            toolName: 'confirm_discard_session',
            content: JSON.stringify({
              discarded: true,
              proposalId: body.proposal.id,
              sessionId,
            }),
          })
        } catch (err) {
          console.error('[ai-coach actions] transcript', err)
        }
      }
      return NextResponse.json({ ok: true })
    }

    if (kind === 'save_profile_interview') {
      const interviewId = String(body.interviewId ?? '').trim()
      const answers = body.answers ?? {}
      if (!interviewId) {
        return NextResponse.json({ error: 'Missing interview id.' }, { status: 400 })
      }

      for (const [field, answer] of Object.entries(answers) as Array<
        [ProfileMissingField, NonNullable<ProfileInterviewAnswers[ProfileMissingField]>]
      >) {
        if (!isProfileInterviewStepComplete(field, answer)) {
          return NextResponse.json(
            { error: 'Finish every step before saving.' },
            { status: 400 },
          )
        }
      }

      const patch = answersToOnboardingPatch(answers)
      if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: 'Nothing to save.' }, { status: 400 })
      }

      const result = await saveOnboardingProgressAction(patch)
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      if (patch.weightKg != null) {
        await logBodyWeightAction(patch.weightKg)
      }

      if (conversationId) {
        try {
          await insertAiMessage({
            conversationId,
            userId: user.id,
            role: 'tool',
            toolName: 'confirm_profile_interview',
            content: JSON.stringify({
              applied: true,
              interviewId,
              fields: Object.keys(answers),
            }),
          })
        } catch (err) {
          console.error('[ai-coach actions] profile interview transcript', err)
        }
      }

      return NextResponse.json({ ok: true })
    }

    if (kind === 'cancel_profile_interview') {
      const interviewId = String(body.interviewId ?? '').trim()
      if (conversationId && interviewId) {
        try {
          await insertAiMessage({
            conversationId,
            userId: user.id,
            role: 'tool',
            toolName: 'cancel_profile_interview',
            content: JSON.stringify({ cancelled: true, interviewId }),
          })
        } catch (err) {
          console.error('[ai-coach actions] cancel profile interview', err)
        }
      }
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    console.error('[ai-coach actions]', err)
    return NextResponse.json(
      { error: 'Could not apply that action. Please try again.' },
      { status: 500 },
    )
  }
}
