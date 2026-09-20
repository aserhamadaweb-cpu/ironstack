/**
 * Guided Q&A before AI split generation — choices + optional free text,
 * compiled into one prompt for the existing intent parser.
 */

export const AI_INTERVIEW_STEPS = [
  'days',
  'style',
  'equipment',
  'goal',
  'sessionLength',
  'notes',
] as const

export type AiInterviewStepId = (typeof AI_INTERVIEW_STEPS)[number]

export type AiInterviewStepAnswer = {
  choiceIds: string[]
  custom: string
}

export type AiInterviewAnswers = Record<AiInterviewStepId, AiInterviewStepAnswer>

export type AiInterviewChoiceDef = {
  id: string
  /** English phrase embedded in the compiled prompt for the LLM. */
  promptLabel: string
}

export type AiInterviewStepDef = {
  id: AiInterviewStepId
  multi: boolean
  /** When true, custom text alone can satisfy the step (notes). */
  customOnlyOk: boolean
  choices: AiInterviewChoiceDef[]
}

export const AI_INTERVIEW_STEP_DEFS: AiInterviewStepDef[] = [
  {
    id: 'days',
    multi: false,
    customOnlyOk: true,
    choices: [
      { id: 'days_3', promptLabel: '3 days per week' },
      { id: 'days_4', promptLabel: '4 days per week' },
      { id: 'days_5', promptLabel: '5 days per week' },
      { id: 'days_6', promptLabel: '6 days per week' },
    ],
  },
  {
    id: 'style',
    multi: false,
    customOnlyOk: true,
    choices: [
      { id: 'style_ppl', promptLabel: 'Push / Pull / Legs (PPL) split' },
      { id: 'style_ul', promptLabel: 'Upper / Lower split' },
      { id: 'style_full', promptLabel: 'Full-body sessions' },
      { id: 'style_bro', promptLabel: 'Bro / body-part split' },
      { id: 'style_any', promptLabel: 'no strong preference on split style — pick what fits best' },
    ],
  },
  {
    id: 'equipment',
    multi: true,
    customOnlyOk: true,
    choices: [
      {
        id: 'equip_free',
        promptLabel: 'prefers free weights (barbell, dumbbells, kettlebells)',
      },
      {
        id: 'equip_machines',
        promptLabel: 'gym has lever / plate-loaded machines and wants to use them',
      },
      {
        id: 'equip_cables',
        promptLabel: 'wants cable machines included',
      },
      {
        id: 'equip_mix',
        promptLabel: 'happy with a mix of free weights and machines',
      },
      {
        id: 'equip_bodyweight',
        promptLabel: 'limited to bodyweight / bands / home setup',
      },
    ],
  },
  {
    id: 'goal',
    multi: false,
    customOnlyOk: true,
    choices: [
      { id: 'goal_muscle', promptLabel: 'primary goal: build muscle / hypertrophy' },
      { id: 'goal_strength', promptLabel: 'primary goal: get stronger' },
      { id: 'goal_both', promptLabel: 'primary goal: muscle and strength together' },
      { id: 'goal_recomp', promptLabel: 'primary goal: fat loss / recomp while training hard' },
      { id: 'goal_general', promptLabel: 'primary goal: stay active and consistent' },
    ],
  },
  {
    id: 'sessionLength',
    multi: false,
    customOnlyOk: true,
    choices: [
      { id: 'len_45', promptLabel: 'sessions around 45 minutes or less' },
      { id: 'len_60', promptLabel: 'sessions around 45–60 minutes' },
      { id: 'len_90', promptLabel: 'sessions up to about 90 minutes' },
      { id: 'len_flex', promptLabel: 'flexible on session length' },
    ],
  },
  {
    id: 'notes',
    multi: false,
    customOnlyOk: true,
    choices: [
      {
        id: 'notes_none',
        promptLabel: 'no special limits beyond the preferences above',
      },
    ],
  },
]

export function emptyAiInterviewAnswers(): AiInterviewAnswers {
  return {
    days: { choiceIds: [], custom: '' },
    style: { choiceIds: [], custom: '' },
    equipment: { choiceIds: [], custom: '' },
    goal: { choiceIds: [], custom: '' },
    sessionLength: { choiceIds: [], custom: '' },
    notes: { choiceIds: [], custom: '' },
  }
}

export function getAiInterviewStepDef(id: AiInterviewStepId): AiInterviewStepDef {
  const def = AI_INTERVIEW_STEP_DEFS.find((step) => step.id === id)
  if (!def) throw new Error(`Unknown AI interview step: ${id}`)
  return def
}

export function isAiInterviewStepComplete(
  step: AiInterviewStepDef,
  answer: AiInterviewStepAnswer,
): boolean {
  const custom = answer.custom.trim()
  if (custom.length > 0) return true
  if (answer.choiceIds.length > 0) return true
  return false
}

/** Build a natural-language brief the custom-split intent parser understands. */
export function compileAiSplitInterviewPrompt(answers: AiInterviewAnswers): string {
  const lines: string[] = [
    'Build me a personalized workout split from this interview:',
  ]

  for (const step of AI_INTERVIEW_STEP_DEFS) {
    const answer = answers[step.id]
    const custom = answer.custom.trim()
    const labels = answer.choiceIds
      .map((id) => step.choices.find((c) => c.id === id)?.promptLabel)
      .filter((label): label is string => Boolean(label))

    if (labels.length === 0 && !custom) continue

    const parts: string[] = []
    if (labels.length > 0) parts.push(labels.join('; '))
    if (custom) {
      if (step.id === 'notes') {
        parts.push(`extra notes from the athlete: ${custom}`)
      } else {
        parts.push(`athlete's own words: ${custom}`)
      }
    }

    const heading =
      step.id === 'days'
        ? 'Schedule'
        : step.id === 'style'
          ? 'Split style'
          : step.id === 'equipment'
            ? 'Equipment'
            : step.id === 'goal'
              ? 'Goal'
              : step.id === 'sessionLength'
                ? 'Session length'
                : 'Constraints / must-haves'

    lines.push(`${heading}: ${parts.join('. ')}.`)
  }

  lines.push(
    'Match exercises to a real gym catalog, respect any limits, and prefer the equipment style they described.',
  )

  return lines.join('\n').trim()
}
