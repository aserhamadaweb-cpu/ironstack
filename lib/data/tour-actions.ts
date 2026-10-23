'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import {
  APP_TOUR_STEP_COUNT,
  clampTourStep,
  type AppTourStatus,
} from '@/lib/app-tour'
import { rejectIfGuestOk } from '@/lib/data/guest-guard'
import { getIsGuestAction } from '@/lib/data/profile-actions'
import {
  buildAppTourMetadataPatch,
  readAppTourState,
} from '@/lib/app-tour-storage'

export type TourActionResult =
  | {
      ok: true
      status: AppTourStatus
      step: number
    }
  | { ok: false; error: string }

async function writeTour(
  status: AppTourStatus,
  step: number,
  options?: { revalidate?: boolean },
): Promise<TourActionResult> {
  const blocked = await rejectIfGuestOk()
  if (blocked) return blocked

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  const nextStep = clampTourStep(step)
  const { error } = await supabase.auth.updateUser({
    data: buildAppTourMetadataPatch({ status, step: nextStep }),
  })
  if (error) {
    return { ok: false, error: 'Could not save tour progress. Try again.' }
  }

  // Never revalidate the dashboard layout on every step — that nuked RSC
  // caches and made each Next feel like a cold page load. Only refresh
  // Settings when the tour ends so its restart/status UI stays accurate.
  if (options?.revalidate) {
    revalidatePath('/dashboard/settings')
  }

  return { ok: true, status, step: nextStep }
}

export async function getAppTourStateAction(): Promise<{
  status: AppTourStatus | null
  step: number
  shouldAutoOffer: boolean
  isGuest: boolean
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      status: null,
      step: 0,
      shouldAutoOffer: false,
      isGuest: false,
    }
  }

  if (await getIsGuestAction()) {
    return {
      status: null,
      step: 0,
      shouldAutoOffer: false,
      isGuest: true,
    }
  }

  const state = readAppTourState(user)
  return {
    status: state.status,
    step: state.step,
    shouldAutoOffer: state.shouldAutoOffer,
    isGuest: false,
  }
}

/** Lightweight step save — no layout revalidation (called often during Next). */
export async function saveAppTourProgressAction(
  step: number,
  status: AppTourStatus = 'active',
): Promise<TourActionResult> {
  return writeTour(status, step)
}

export async function skipAppTourAction(): Promise<TourActionResult> {
  return writeTour('skipped', APP_TOUR_STEP_COUNT - 1, { revalidate: true })
}

export async function completeAppTourAction(): Promise<TourActionResult> {
  return writeTour('completed', APP_TOUR_STEP_COUNT - 1, { revalidate: true })
}

export async function deferAppTourAction(step: number): Promise<TourActionResult> {
  return writeTour('deferred', step)
}

export async function restartAppTourAction(): Promise<TourActionResult> {
  return writeTour('active', 0, { revalidate: true })
}
