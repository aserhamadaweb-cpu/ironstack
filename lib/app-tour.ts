/** First-time product tour — progress lives in auth user_metadata only. */

export type AppTourStatus =
  | 'pending'
  | 'active'
  | 'deferred'
  | 'skipped'
  | 'completed'

export type AppTourPhase = 'navigate' | 'train' | 'track' | 'customize'

export type AppTourStepId =
  | 'homeHero'
  | 'homeShortcuts'
  | 'homeTrainCta'
  | 'navTabs'
  | 'navMenu'
  | 'workoutSplits'
  | 'splitRecommendations'
  | 'aiSplitBuilder'
  | 'workoutCreate'
  | 'exercisesSearch'
  | 'exercisesGrid'
  | 'homeWorkouts'
  | 'sessionStart'
  | 'sessionCoach'
  | 'history'
  | 'navCoach'
  | 'coach'
  | 'coachAiActions'
  | 'settingsAppearance'
  | 'settingsTour'
  | 'offlineMode'
  | 'offlineTraining'
  | 'challenges'
  | 'achievements'
  | 'socialLeaderboard'
  | 'socialCircle'
  | 'messages'
  | 'done'

export type AppTourStepDef = {
  id: AppTourStepId
  phase: AppTourPhase
  /** Route to open for this step (null = stay put). */
  href: string | null
  /** CSS selector for spotlight highlight. */
  target?: string
  /** Open the sidebar menu before highlighting (desktop). */
  openSidebar?: boolean
}

export const APP_TOUR_PHASES: AppTourPhase[] = [
  'navigate',
  'train',
  'track',
  'customize',
]

/** Full catalog — dormant steps stay defined for i18n and future reactivation. */
export const APP_TOUR_STEPS_ALL: AppTourStepDef[] = [
  {
    id: 'homeHero',
    phase: 'navigate',
    href: '/dashboard/home',
    target: '[data-tour="home-hero"]',
  },
  {
    id: 'homeShortcuts',
    phase: 'navigate',
    href: '/dashboard/home',
    target: '[data-tour="home-shortcuts"]',
  },
  {
    id: 'homeTrainCta',
    phase: 'train',
    href: '/dashboard/home',
    target: '[data-tour="home-train-cta"]',
  },
  {
    id: 'navTabs',
    phase: 'navigate',
    href: '/dashboard/home',
    target: '[data-tour="nav-tabbar"]',
  },
  {
    id: 'navMenu',
    phase: 'navigate',
    href: '/dashboard/home',
    target:
      '[data-tour="nav-sidebar"], [data-tour="nav-menu-icon"], [data-tour="nav-menu"]',
    openSidebar: true,
  },
  {
    id: 'workoutSplits',
    phase: 'train',
    href: '/dashboard/workout',
    target: '[data-tour="workout-my-splits-link"]',
  },
  {
    id: 'workoutCreate',
    phase: 'train',
    href: '/dashboard/workout',
    target:
      '[data-tour="workout-create-cta"], [data-tour="workout-create"]',
  },
  {
    id: 'splitRecommendations',
    phase: 'train',
    href: '/dashboard/splits/new',
    target:
      '[data-tour="create-split-recommended"], [data-tour="guest-blocked"]',
  },
  {
    id: 'aiSplitBuilder',
    phase: 'train',
    href: '/dashboard/splits/ai-builder',
    target:
      '[data-tour="ai-split-builder"], [data-tour="guest-blocked"]',
  },
  {
    id: 'exercisesSearch',
    phase: 'train',
    href: '/dashboard/exercises',
    target: '[data-tour="exercises-search"]',
  },
  {
    id: 'exercisesGrid',
    phase: 'train',
    href: '/dashboard/exercises',
    target: '[data-tour="exercises-grid"]',
  },
  {
    id: 'homeWorkouts',
    phase: 'train',
    href: '/dashboard/home-workouts',
    target: '[data-tour="home-workouts-list"]',
  },
  {
    id: 'sessionStart',
    phase: 'train',
    href: '/dashboard/workout',
    target:
      '[data-tour="workout-start-cta"], [data-tour="workout-featured-split"], [data-tour="workout-splits"]',
  },
  {
    id: 'sessionCoach',
    phase: 'train',
    href: '/dashboard/workout',
    target:
      '[data-tour="workout-start-cta"], [data-tour="workout-featured-split"], [data-tour="workout-splits"]',
  },
  {
    id: 'history',
    phase: 'track',
    href: '/dashboard/history',
    target: '[data-tour="history-list"]',
  },
  {
    id: 'navCoach',
    phase: 'track',
    href: '/dashboard/home',
    target: '[data-tour="nav-coach"]',
    openSidebar: true,
  },
  {
    id: 'coach',
    phase: 'track',
    href: '/dashboard/ai-coach',
    target:
      '[data-tour="coach-chat"], [data-tour="page-coach"], [data-tour="guest-blocked"]',
  },
  {
    id: 'coachAiActions',
    phase: 'track',
    href: '/dashboard/ai-coach/chat',
    target:
      '[data-tour="coach-chat-composer"], [data-tour="guest-blocked"]',
  },
  {
    id: 'settingsAppearance',
    phase: 'customize',
    href: '/dashboard/settings',
    target:
      '[data-tour="settings-appearance"], [data-tour="page-settings"]',
  },
  {
    id: 'settingsTour',
    phase: 'customize',
    href: '/dashboard/settings',
    target: '[data-tour="settings-restart-tour"]',
  },
  {
    id: 'offlineMode',
    phase: 'customize',
    href: '/dashboard/settings',
    target: '[data-tour="settings-offline"]',
  },
  {
    id: 'offlineTraining',
    phase: 'train',
    href: '/dashboard/workout',
    target:
      '[data-tour="workout-offline-toggle"], [data-tour="workout-splits"], [data-tour="workout-featured-split"]',
  },
  {
    id: 'challenges',
    phase: 'customize',
    href: '/dashboard/challenges',
    target:
      '[data-tour="challenges-create"], [data-tour="guest-blocked"]',
  },
  {
    id: 'achievements',
    phase: 'customize',
    href: '/dashboard/achievements',
    target: '[data-tour="achievements-progress"]',
  },
  {
    id: 'socialLeaderboard',
    phase: 'customize',
    href: '/dashboard/leaderboard',
    target: '[data-tour="page-leaderboard"]',
  },
  {
    id: 'socialCircle',
    phase: 'customize',
    href: '/dashboard/home',
    target:
      '[data-tour="home-social"], [data-tour="home-leaderboard"]',
  },
  {
    id: 'messages',
    phase: 'customize',
    href: '/dashboard/messages',
    target:
      '[data-tour="page-messages"], [data-tour="guest-blocked"]',
  },
  {
    id: 'done',
    phase: 'customize',
    href: null,
    target: undefined,
  },
]

/**
 * Active first-time tour — get to a real session fast, plus AI + offline.
 * Broader feature steps stay in APP_TOUR_STEPS_ALL as dormant for Settings later.
 */
export const APP_TOUR_ACTIVE_IDS: AppTourStepId[] = [
  'homeHero',
  'homeTrainCta',
  'workoutCreate',
  'navCoach',
  'coach',
  'offlineMode',
  'sessionStart',
  'navTabs',
  'done',
]

/** Per-step overrides applied only in the active tour. */
const APP_TOUR_ACTIVE_OVERRIDES: Partial<
  Record<AppTourStepId, Partial<AppTourStepDef>>
> = {}

function tourStepById(id: AppTourStepId): AppTourStepDef {
  const base = APP_TOUR_STEPS_ALL.find((step) => step.id === id)
  if (!base) {
    throw new Error(`Unknown app tour step: ${id}`)
  }
  return { ...base, ...APP_TOUR_ACTIVE_OVERRIDES[id] }
}

/** Steps shown in the live product tour — derived from APP_TOUR_ACTIVE_IDS. */
export const APP_TOUR_STEPS: AppTourStepDef[] =
  APP_TOUR_ACTIVE_IDS.map(tourStepById)

export const APP_TOUR_STEP_COUNT = APP_TOUR_STEPS.length

export const APP_TOUR_DORMANT_IDS: AppTourStepId[] = APP_TOUR_STEPS_ALL.map(
  (step) => step.id,
).filter((id) => !APP_TOUR_ACTIVE_IDS.includes(id))

export function clampTourStep(step: unknown): number {
  const n = typeof step === 'number' ? step : Number(step)
  if (!Number.isFinite(n)) return 0
  return Math.min(APP_TOUR_STEP_COUNT - 1, Math.max(0, Math.round(n)))
}

export function isAppTourStatus(value: unknown): value is AppTourStatus {
  return (
    value === 'pending' ||
    value === 'active' ||
    value === 'deferred' ||
    value === 'skipped' ||
    value === 'completed'
  )
}

export type AppTourState = {
  status: AppTourStatus | null
  step: number
  /** Auto-start only for first-time `pending` — never deferred/active/skipped/completed/null. */
  shouldAutoOffer: boolean
}

/** Custom event — DashboardNav opens the sidebar when the tour needs it. */
export const APP_TOUR_OPEN_SIDEBAR_EVENT = 'ironstack:tour-open-sidebar'

/** Custom event — close the sidebar when the tour leaves a menu step. */
export const APP_TOUR_CLOSE_SIDEBAR_EVENT = 'ironstack:tour-close-sidebar'

/** Custom event — close sidebar + drop any tour scroll locks when the tour ends. */
export const APP_TOUR_END_EVENT = 'ironstack:tour-end'
