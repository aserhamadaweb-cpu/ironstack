import type { Achievement, UserAchievement } from '@/lib/database.types'

export type EarnedAchievement = Achievement & {
  earned_at: string
  display_order: number | null
}

/** Ordered tier ladders — index = rank (higher = better). */
export const ACHIEVEMENT_TIER_GROUPS: Record<string, string[]> = {
  streak: ['streak_7', 'streak_30', 'streak_100'],
  squat: ['squat_bronze', 'squat_silver', 'squat_gold'],
  bench: ['bench_bronze', 'bench_silver', 'bench_gold'],
  deadlift: ['deadlift_bronze', 'deadlift_silver', 'deadlift_gold'],
  consistency: [
    'consistency_bronze',
    'consistency_silver',
    'consistency_gold',
  ],
  volume: ['volume_10t', 'volume_50t', 'volume_100t'],
}

export const ACHIEVEMENT_CATEGORIES = [
  'streak',
  'pr',
  'volume',
  'consistency',
  'variety',
  'social',
] as const

export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number]

const slugToTierGroup = new Map<string, string>()
for (const [group, slugs] of Object.entries(ACHIEVEMENT_TIER_GROUPS)) {
  for (const slug of slugs) slugToTierGroup.set(slug, group)
}

export function tierGroupForSlug(slug: string): string | null {
  return slugToTierGroup.get(slug) ?? null
}

export function tierRank(slug: string): number {
  const group = tierGroupForSlug(slug)
  if (!group) return -1
  return ACHIEVEMENT_TIER_GROUPS[group].indexOf(slug)
}

/** Profile display: highest earned tier per ladder + all standalones. */
export function collapseEarnedForProfile(
  earned: EarnedAchievement[],
): EarnedAchievement[] {
  const bestByGroup = new Map<string, EarnedAchievement>()
  const standalones: EarnedAchievement[] = []

  for (const item of earned) {
    const group = tierGroupForSlug(item.slug)
    if (!group) {
      standalones.push(item)
      continue
    }
    const current = bestByGroup.get(group)
    if (!current || tierRank(item.slug) > tierRank(current.slug)) {
      bestByGroup.set(group, item)
    }
  }

  return [...bestByGroup.values(), ...standalones].sort((a, b) => {
    const aOrder = a.display_order
    const bOrder = b.display_order
    if (aOrder != null && bOrder != null && aOrder !== bOrder) {
      return aOrder - bOrder
    }
    if (aOrder != null && bOrder == null) return -1
    if (aOrder == null && bOrder != null) return 1
    return (
      a.sort_order - b.sort_order ||
      new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime()
    )
  })
}

export type TierProgress = {
  groupKey: string
  category: AchievementCategory | string
  tiers: Array<{
    achievement: Achievement
    earned: boolean
    earned_at: string | null
  }>
  highestEarnedIndex: number
  nextTier: Achievement | null
}

export type ChallengesCatalog = {
  tierGroups: TierProgress[]
  standalonesByCategory: Map<string, Array<{
    achievement: Achievement
    earned: boolean
    earned_at: string | null
  }>>
}

export function buildChallengesCatalog(
  catalog: Achievement[],
  earnedRows: UserAchievement[],
): ChallengesCatalog {
  const earnedByAchievementId = new Map(
    earnedRows.map((row) => [row.achievement_id, row]),
  )
  const bySlug = new Map(catalog.map((a) => [a.slug, a]))

  const tierGroups: TierProgress[] = []
  const usedSlugs = new Set<string>()

  for (const [groupKey, slugs] of Object.entries(ACHIEVEMENT_TIER_GROUPS)) {
    const tiers = slugs
      .map((slug) => bySlug.get(slug))
      .filter((a): a is Achievement => Boolean(a))
      .map((achievement) => {
        usedSlugs.add(achievement.slug)
        const earned = earnedByAchievementId.get(achievement.id)
        return {
          achievement,
          earned: Boolean(earned),
          earned_at: earned?.earned_at ?? null,
        }
      })

    if (tiers.length === 0) continue

    let highestEarnedIndex = -1
    for (let i = 0; i < tiers.length; i++) {
      if (tiers[i].earned) highestEarnedIndex = i
    }

    const nextTier = tiers.find((t) => !t.earned)

    tierGroups.push({
      groupKey,
      category: tiers[0].achievement.category,
      tiers,
      highestEarnedIndex,
      nextTier: nextTier?.achievement ?? null,
    })
  }

  const standalonesByCategory = new Map<
    string,
    Array<{
      achievement: Achievement
      earned: boolean
      earned_at: string | null
    }>
  >()

  for (const achievement of catalog) {
    if (usedSlugs.has(achievement.slug)) continue
    const earned = earnedByAchievementId.get(achievement.id)
    const list = standalonesByCategory.get(achievement.category) ?? []
    list.push({
      achievement,
      earned: Boolean(earned),
      earned_at: earned?.earned_at ?? null,
    })
    standalonesByCategory.set(achievement.category, list)
  }

  for (const list of standalonesByCategory.values()) {
    list.sort((a, b) => a.achievement.sort_order - b.achievement.sort_order)
  }

  tierGroups.sort(
    (a, b) =>
      (a.tiers[0]?.achievement.sort_order ?? 0) -
      (b.tiers[0]?.achievement.sort_order ?? 0),
  )

  return { tierGroups, standalonesByCategory }
}

export const TIER_GROUP_LABELS: Record<string, { en: string; ar: string }> = {
  streak: { en: 'Streak Ladder', ar: 'سلم السلسلة' },
  squat: { en: 'Squat Strength', ar: 'قوة القرفصاء' },
  bench: { en: 'Bench Strength', ar: 'قوة ضغط الصدر' },
  deadlift: { en: 'Deadlift Strength', ar: 'قوة الرفعة الميتة' },
  consistency: { en: 'Consistency Ladder', ar: 'سلم الالتزام' },
  volume: { en: 'Volume Ladder', ar: 'سلم الحجم' },
}
