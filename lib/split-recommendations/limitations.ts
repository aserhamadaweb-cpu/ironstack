/** Keyword-based exercise swaps — not medical advice; pattern substitutions only. */

type SwapRule = {
  keywords: RegExp
  /** Substrings in exercise name that trigger replacement preference. */
  avoidName: RegExp
  /** Preferred alternative name fragments (first catalog match wins). */
  preferNames: string[]
}

const RULES: SwapRule[] = [
  {
    keywords: /knee|patella|patellar|acl|meniscus/i,
    avoidName: /squat|lunge|leg press|jump/i,
    preferNames: [
      'Romanian Deadlift',
      'Glute Bridge',
      'Step-up',
      'Leg Curl',
      'Hip Thrust',
    ],
  },
  {
    keywords: /shoulder|rotator|impingement|deltoid pain/i,
    avoidName: /overhead|military press|behind the neck|upright row/i,
    preferNames: [
      'Landmine Press',
      'Incline Dumbbell Press',
      'Face Pull',
      'Lateral Raise',
      'Neutral Grip',
    ],
  },
  {
    keywords: /lower back|lumbar|disc|spine/i,
    avoidName: /deadlift|good morning|back extension/i,
    preferNames: [
      'Trap Bar Deadlift',
      'Romanian Deadlift',
      'Chest-Supported Row',
      'Leg Press',
      'Plank',
    ],
  },
  {
    keywords: /wrist|elbow|tennis elbow|golfer/i,
    avoidName: /skull crusher|barbell curl|push[\s-]?up|dip/i,
    preferNames: [
      'Hammer Curl',
      'Cable Curl',
      'Triceps Pushdown',
      'Close-Grip Bench',
    ],
  },
]

export function limitationText(input: {
  limitations: string
  avoidances: string
}): string {
  return `${input.limitations} ${input.avoidances}`.trim()
}

export function shouldAvoidExercise(
  name: string,
  limitText: string,
  seniorMode: boolean,
): boolean {
  const combined = seniorMode
    ? `${limitText} joint-friendly low-impact`
    : limitText

  for (const rule of RULES) {
    if (!rule.keywords.test(combined)) continue
    if (rule.avoidName.test(name)) return true
  }

  if (seniorMode) {
    if (/jump|plyometric|burpee|box jump|sprint/i.test(name)) return true
    if (/behind the neck|upright row/i.test(name)) return true
    // Explosive / ballistic push-up variants (hyphen or space).
    if (
      /clap push|plyo push|tap push|chest tap push|drop push|depth jump|planche push|handstand push|superman push|hindu push|leg kick push|spider crawl push|scapula push|kick push up|raise single arm push/i.test(
        name,
      )
    ) {
      return true
    }
    // High-tempo / plyometric finishers.
    if (
      /mountain climber|jumping jack|high knee|battle rope|fast feet|star jump|scissor jump|back and forth step|ski step|jack burpee/i.test(
        name,
      )
    ) {
      return true
    }
  }

  return false
}

export function preferredAlternatives(limitText: string, seniorMode: boolean): string[] {
  const combined = seniorMode
    ? `${limitText} joint-friendly`
    : limitText
  const out: string[] = []
  for (const rule of RULES) {
    if (rule.keywords.test(combined)) {
      out.push(...rule.preferNames)
    }
  }
  if (seniorMode) {
    out.push(
      'Leg Press',
      'Chest-Supported Row',
      'Incline Dumbbell Press',
      'Leg Curl',
      'Face Pull',
    )
  }
  return out
}
