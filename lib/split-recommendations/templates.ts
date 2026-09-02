import type { SplitTemplateDef } from './types'

const FB_MAIN: SplitTemplateDef['days'][0]['slots'] = [
  { role: 'squat', tier: 'main' },
  { role: 'horizontal_push', tier: 'main' },
  { role: 'horizontal_pull', tier: 'main' },
  { role: 'hinge', tier: 'accessory' },
  { role: 'vertical_push', tier: 'accessory' },
  { role: 'core', tier: 'accessory' },
]

const FB_STRENGTH: SplitTemplateDef['days'][0]['slots'] = [
  { role: 'squat', tier: 'main' },
  { role: 'horizontal_push', tier: 'main' },
  { role: 'horizontal_pull', tier: 'main' },
  { role: 'hinge', tier: 'main' },
  { role: 'core', tier: 'accessory' },
]

const UL_UPPER: SplitTemplateDef['days'][0]['slots'] = [
  { role: 'horizontal_push', tier: 'main' },
  { role: 'horizontal_pull', tier: 'main' },
  { role: 'vertical_push', tier: 'main' },
  { role: 'vertical_pull', tier: 'main' },
  { role: 'bicep_accessory', tier: 'accessory' },
  { role: 'tricep_accessory', tier: 'accessory' },
]

const UL_LOWER: SplitTemplateDef['days'][0]['slots'] = [
  { role: 'squat', tier: 'main' },
  { role: 'hinge', tier: 'main' },
  { role: 'quad_accessory', tier: 'accessory' },
  { role: 'ham_accessory', tier: 'accessory' },
  { role: 'glute_accessory', tier: 'accessory' },
  { role: 'calf', tier: 'accessory' },
]

const PUSH: SplitTemplateDef['days'][0]['slots'] = [
  { role: 'horizontal_push', tier: 'main' },
  { role: 'vertical_push', tier: 'main' },
  { role: 'chest_accessory', tier: 'accessory' },
  { role: 'shoulder_accessory', tier: 'accessory' },
  { role: 'tricep_accessory', tier: 'accessory' },
]

const PULL: SplitTemplateDef['days'][0]['slots'] = [
  { role: 'horizontal_pull', tier: 'main' },
  { role: 'vertical_pull', tier: 'main' },
  { role: 'horizontal_pull', tier: 'accessory' },
  { role: 'bicep_accessory', tier: 'accessory' },
  { role: 'core', tier: 'accessory' },
]

const LEGS: SplitTemplateDef['days'][0]['slots'] = [
  { role: 'squat', tier: 'main' },
  { role: 'hinge', tier: 'main' },
  { role: 'quad_accessory', tier: 'accessory' },
  { role: 'ham_accessory', tier: 'accessory' },
  { role: 'calf', tier: 'accessory' },
]

const HOME_DAY: SplitTemplateDef['days'][0]['slots'] = [
  { role: 'squat', tier: 'main' },
  { role: 'horizontal_push', tier: 'main' },
  { role: 'horizontal_pull', tier: 'main' },
  { role: 'hinge', tier: 'accessory' },
  { role: 'core', tier: 'accessory' },
]

export const SPLIT_TEMPLATES: SplitTemplateDef[] = [
  {
    id: 'full_body',
    name: 'Full Body',
    typeLabel: 'Full Body 3-day',
    description: 'Hit every major pattern three times per week — great for beginners and busy schedules.',
    daysPerWeek: 3,
    minDays: 3,
    maxDays: 3,
    requiresGym: false,
    minLevel: 'beginner',
    blockedSenior: false,
    days: [
      { name: 'Full Body A', subtitle: 'Squat + push focus', muscleFocus: ['Quads', 'Chest', 'Back'], slots: FB_MAIN },
      { name: 'Full Body B', subtitle: 'Hinge + pull focus', muscleFocus: ['Hamstrings', 'Back', 'Shoulders'], slots: FB_MAIN },
      { name: 'Full Body C', subtitle: 'Balanced volume', muscleFocus: ['Glutes', 'Arms', 'Core'], slots: FB_MAIN },
    ],
  },
  {
    id: 'upper_lower_3',
    name: 'Upper / Lower',
    typeLabel: 'Upper/Lower 3-day',
    description: 'Alternate upper and lower days for solid frequency without daily gym time.',
    daysPerWeek: 3,
    minDays: 3,
    maxDays: 3,
    requiresGym: false,
    minLevel: 'beginner',
    blockedSenior: false,
    days: [
      { name: 'Upper A', subtitle: 'Horizontal emphasis', muscleFocus: ['Chest', 'Back', 'Arms'], slots: UL_UPPER },
      { name: 'Lower A', subtitle: 'Squat + hinge', muscleFocus: ['Quads', 'Hamstrings', 'Glutes'], slots: UL_LOWER },
      { name: 'Upper B', subtitle: 'Vertical emphasis', muscleFocus: ['Shoulders', 'Lats', 'Arms'], slots: UL_UPPER },
    ],
  },
  {
    id: 'strength_fb',
    name: 'Strength Full Body',
    typeLabel: 'Strength Full Body 3-day',
    description: 'Lower reps, heavier compounds — built for strength on three training days.',
    daysPerWeek: 3,
    minDays: 3,
    maxDays: 3,
    requiresGym: false,
    minLevel: 'intermediate',
    blockedSenior: false,
    days: [
      { name: 'Strength A', subtitle: 'Squat day', muscleFocus: ['Quads', 'Chest', 'Back'], slots: FB_STRENGTH },
      { name: 'Strength B', subtitle: 'Hinge day', muscleFocus: ['Hamstrings', 'Shoulders', 'Back'], slots: FB_STRENGTH },
      { name: 'Strength C', subtitle: 'Mixed compounds', muscleFocus: ['Glutes', 'Arms', 'Core'], slots: FB_STRENGTH },
    ],
  },
  {
    id: 'home_minimal',
    name: 'Minimal Home',
    typeLabel: 'Minimal Home 3-day',
    description: 'Bodyweight and bands — no gym required.',
    daysPerWeek: 3,
    minDays: 3,
    maxDays: 4,
    requiresGym: false,
    minLevel: 'beginner',
    blockedSenior: false,
    days: [
      { name: 'Home A', subtitle: 'Push + legs', muscleFocus: ['Chest', 'Quads', 'Core'], slots: HOME_DAY },
      { name: 'Home B', subtitle: 'Pull + hinge', muscleFocus: ['Back', 'Hamstrings', 'Glutes'], slots: HOME_DAY },
      { name: 'Home C', subtitle: 'Full circuit', muscleFocus: ['Shoulders', 'Arms', 'Core'], slots: HOME_DAY },
    ],
  },
  {
    id: 'full_body_4',
    name: 'Full Body',
    typeLabel: 'Full Body 4-day',
    description: 'Four full-body sessions with rotating emphasis.',
    daysPerWeek: 4,
    minDays: 4,
    maxDays: 4,
    requiresGym: false,
    minLevel: 'beginner',
    blockedSenior: false,
    days: [
      { name: 'Full Body A', subtitle: 'Squat emphasis', muscleFocus: ['Quads', 'Chest'], slots: FB_MAIN },
      { name: 'Full Body B', subtitle: 'Hinge emphasis', muscleFocus: ['Hamstrings', 'Back'], slots: FB_MAIN },
      { name: 'Full Body C', subtitle: 'Push emphasis', muscleFocus: ['Shoulders', 'Triceps'], slots: FB_MAIN },
      { name: 'Full Body D', subtitle: 'Pull emphasis', muscleFocus: ['Lats', 'Biceps'], slots: FB_MAIN },
    ],
  },
  {
    id: 'upper_lower',
    name: 'Upper / Lower',
    typeLabel: 'Upper/Lower 4-day',
    description: 'Classic four-day split — two upper, two lower.',
    daysPerWeek: 4,
    minDays: 4,
    maxDays: 5,
    requiresGym: false,
    minLevel: 'beginner',
    blockedSenior: false,
    days: [
      { name: 'Upper A', subtitle: 'Strength focus', muscleFocus: ['Chest', 'Back'], slots: UL_UPPER },
      { name: 'Lower A', subtitle: 'Squat focus', muscleFocus: ['Quads', 'Glutes'], slots: UL_LOWER },
      { name: 'Upper B', subtitle: 'Hypertrophy focus', muscleFocus: ['Shoulders', 'Arms'], slots: UL_UPPER },
      { name: 'Lower B', subtitle: 'Hinge focus', muscleFocus: ['Hamstrings', 'Calves'], slots: UL_LOWER },
    ],
  },
  {
    id: 'ppl_5',
    name: 'Push Pull Legs',
    typeLabel: 'PPL 5-day',
    description: 'Push, pull, legs twice with an extra rotation — high frequency for muscle.',
    daysPerWeek: 5,
    minDays: 5,
    maxDays: 5,
    requiresGym: true,
    minLevel: 'intermediate',
    blockedSenior: false,
    days: [
      { name: 'Push A', subtitle: 'Heavy compounds', muscleFocus: ['Chest', 'Shoulders', 'Triceps'], slots: PUSH },
      { name: 'Pull A', subtitle: 'Rows + pulldowns', muscleFocus: ['Back', 'Biceps'], slots: PULL },
      { name: 'Legs A', subtitle: 'Squat focus', muscleFocus: ['Quads', 'Hamstrings'], slots: LEGS },
      { name: 'Push B', subtitle: 'Volume day', muscleFocus: ['Chest', 'Delts'], slots: PUSH },
      { name: 'Pull B', subtitle: 'Volume day', muscleFocus: ['Lats', 'Rear delts'], slots: PULL },
    ],
  },
  {
    id: 'bro_5',
    name: 'Bro Split',
    typeLabel: 'Bro Split 5-day',
    description: 'One muscle group per day — classic bodybuilding for intermediate lifters.',
    daysPerWeek: 5,
    minDays: 5,
    maxDays: 5,
    requiresGym: true,
    minLevel: 'intermediate',
    blockedSenior: true,
    days: [
      { name: 'Chest', subtitle: 'Pressing focus', muscleFocus: ['Chest', 'Triceps'], slots: PUSH },
      { name: 'Back', subtitle: 'Rows + pulldowns', muscleFocus: ['Lats', 'Traps'], slots: PULL },
      { name: 'Shoulders', subtitle: 'Delts + traps', muscleFocus: ['Shoulders', 'Traps'], slots: [
        { role: 'vertical_push', tier: 'main' },
        { role: 'shoulder_accessory', tier: 'main' },
        { role: 'horizontal_pull', tier: 'accessory' },
        { role: 'tricep_accessory', tier: 'accessory' },
      ] },
      { name: 'Arms', subtitle: 'Biceps + triceps', muscleFocus: ['Biceps', 'Triceps'], slots: [
        { role: 'bicep_accessory', tier: 'main' },
        { role: 'tricep_accessory', tier: 'main' },
        { role: 'bicep_accessory', tier: 'accessory' },
        { role: 'tricep_accessory', tier: 'accessory' },
      ] },
      { name: 'Legs', subtitle: 'Quads + hamstrings', muscleFocus: ['Quads', 'Hamstrings', 'Calves'], slots: LEGS },
    ],
  },
  {
    id: 'ppl_6',
    name: 'Push Pull Legs',
    typeLabel: 'PPL 6-day',
    description: 'Two full PPL rotations — for advanced lifters who recover well.',
    daysPerWeek: 6,
    minDays: 6,
    maxDays: 6,
    requiresGym: true,
    minLevel: 'advanced',
    blockedSenior: true,
    days: [
      { name: 'Push A', subtitle: 'Heavy', muscleFocus: ['Chest', 'Shoulders'], slots: PUSH },
      { name: 'Pull A', subtitle: 'Heavy', muscleFocus: ['Back', 'Biceps'], slots: PULL },
      { name: 'Legs A', subtitle: 'Heavy', muscleFocus: ['Quads', 'Glutes'], slots: LEGS },
      { name: 'Push B', subtitle: 'Volume', muscleFocus: ['Chest', 'Triceps'], slots: PUSH },
      { name: 'Pull B', subtitle: 'Volume', muscleFocus: ['Lats', 'Rear delts'], slots: PULL },
      { name: 'Legs B', subtitle: 'Volume', muscleFocus: ['Hamstrings', 'Calves'], slots: LEGS },
    ],
  },
  {
    id: 'hybrid_metcon',
    name: 'Hybrid Strength + Metcon',
    typeLabel: 'Hybrid 4-day',
    description: 'Strength work plus finishers for fat loss and conditioning.',
    daysPerWeek: 4,
    minDays: 4,
    maxDays: 5,
    requiresGym: false,
    minLevel: 'intermediate',
    blockedSenior: false,
    days: [
      { name: 'Full Body + Finisher', subtitle: 'Strength + circuits', muscleFocus: ['Full body'], slots: [...FB_MAIN, { role: 'cardio_finisher', tier: 'finisher' }] },
      { name: 'Upper + Finisher', subtitle: 'Push/pull + circuits', muscleFocus: ['Upper body'], slots: [...UL_UPPER, { role: 'cardio_finisher', tier: 'finisher' }] },
      { name: 'Lower + Finisher', subtitle: 'Legs + circuits', muscleFocus: ['Lower body'], slots: [...UL_LOWER, { role: 'cardio_finisher', tier: 'finisher' }] },
      { name: 'Full Body + Finisher', subtitle: 'Mixed + circuits', muscleFocus: ['Full body'], slots: [...FB_MAIN, { role: 'cardio_finisher', tier: 'finisher' }] },
    ],
  },
]

/** Templates allowed at exactly 3 training days — no ppl_3. */
export const THREE_DAY_TEMPLATE_IDS = new Set([
  'full_body',
  'upper_lower_3',
  'strength_fb',
  'home_minimal',
])

export function getTemplateById(id: string): SplitTemplateDef | undefined {
  return SPLIT_TEMPLATES.find((t) => t.id === id)
}
