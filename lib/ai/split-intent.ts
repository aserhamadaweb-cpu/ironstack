/** Client-safe split-build intent detection (no server imports). */

const SPLIT_ACTION =
  /\b(create|build|make|design|add|save|generate|draft|plan)\b/i
const SPLIT_NOUN =
  /\b(split|splits|ppl|push[\s-]?pull[\s-]?legs?|upper[\s-]?lower|bro[\s-]?split|workout plan|training plan)\b/i
const PROGRAM_WITH_SCHEDULE =
  /\b(\d+\s*-?\s*)?(day|days|days\/week|days per week)\b/i
const SPLIT_CONTEXT =
  /\b(day|days|push|pull|legs|chest|back|split|program|exercise|sets|reps|bench|squat|deadlift|برنامج|يوم|تمرين|صدر|ظهر|رجل|حفظ|برنامج)\b/i

export function isSplitBuildIntent(
  message: string,
  history?: Array<{ role: string; content: string }>,
): boolean {
  const text = message.trim()
  if (!text) return false
  const lower = text.toLowerCase()

  if (SPLIT_ACTION.test(lower) && (SPLIT_NOUN.test(lower) || PROGRAM_WITH_SCHEDULE.test(lower))) {
    return true
  }

  if (SPLIT_NOUN.test(lower) && /\b(for me|to my splits?|add to my|using my)\b/i.test(lower)) {
    return true
  }

  if (
    /انشئ|أنشئ|اعمل|ابن|اضف|أضف|حفظ|سوي|جهز|جهّز/i.test(text) &&
    /برنامج|split|سبليت|بول|push pull/i.test(text)
  ) {
    return true
  }

  if (/برنامج/i.test(text) && /\d+\s*أيام?|أيام/i.test(text) && SPLIT_ACTION.test(text)) {
    return true
  }

  if (/\b(save|add|حفظ|اضف|أضف)\b/i.test(text)) {
    const recent = (history ?? [])
      .slice(-8)
      .map((row) => row.content)
      .join(' ')
    if (SPLIT_CONTEXT.test(recent)) {
      return true
    }
  }

  if (
    /\b(revise|edit|change|swap|replace|remove|update|modify|adjust|fix|tweak)\b/i.test(
      lower,
    ) &&
    /\b(plan|split|day|days|exercise|program|workout|leg|push|pull|chest|back)\b/i.test(
      lower,
    )
  ) {
    return true
  }

  if (
    /عدّل|عدل|غيّر|غير|بدّل|بدل|احذف|اضف|أضف|حدّث|حدث|عدلة|الخطة/i.test(text) &&
    /خطة|برنامج|يوم|تمرين|يوم|صدر|ظهر|رجل|سحب|دفع/i.test(text)
  ) {
    return true
  }

  if (/^(please revise|revise the proposed plan|عدّل الخطة)/i.test(text)) {
    return true
  }

  return false
}
