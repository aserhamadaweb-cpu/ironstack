import type { SplitProposal } from '@/lib/ai/action-types'

/** Compact plan block injected when the athlete taps Edit on a preview card. */
export function formatProposalForRevision(proposal: SplitProposal): string {
  const lines = [
    proposal.kind === 'create_split'
      ? 'UNSAVED SPLIT PREVIEW — revise by calling propose_split with the FULL updated plan (same name unless they rename). Do NOT use propose_update_split or get_user_splits.'
      : `SAVED SPLIT PREVIEW (split_id ${proposal.splitId}) — apply changes with propose_update_split operations, or propose_split if rebuilding every day.`,
    `Current preview name: ${proposal.name}`,
    proposal.description ? `Description: ${proposal.description}` : '',
    `Days per week: ${proposal.daysPerWeek}`,
    'Current days and exercises:',
  ].filter(Boolean)

  proposal.days.forEach((day, dayIndex) => {
    lines.push(
      `Day ${dayIndex} — ${day.name}${day.subtitle ? ` (${day.subtitle})` : ''}:`,
    )
    day.exercises.forEach((exercise, exIndex) => {
      lines.push(
        `  [${exIndex}] ${exercise.name} (id ${exercise.exerciseId}) — ${exercise.sets}×${exercise.reps}`,
      )
    })
  })

  lines.push(
    'Apply ONLY the changes the athlete asks for; keep everything else the same unless they ask for a full rebuild.',
  )
  return lines.join('\n')
}
