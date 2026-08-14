'use client'

import { useTransition } from 'react'
import { Brain, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { deactivateMemoryAction } from '@/lib/ai/memory-actions'

export type MemoryItem = {
  id: string
  fact: string
  category: string | null
  updatedAt: string
}

type CoachMemoryPanelProps = {
  memories: MemoryItem[]
  onChanged?: (next: MemoryItem[]) => void
  compact?: boolean
}

export function CoachMemoryPanel({
  memories,
  onChanged,
  compact = false,
}: CoachMemoryPanelProps) {
  const t = useTranslations('coach')
  const [pending, startTransition] = useTransition()

  if (memories.length === 0) {
    return (
      <div
        className={
          compact
            ? 'rounded-xl border border-dashed border-silver/15 px-3 py-4 text-center text-xs text-muted-foreground'
            : 'rounded-2xl border border-dashed border-silver/15 px-4 py-6 text-center text-sm text-muted-foreground'
        }
      >
        {t('noMemories')}
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {memories.map((m) => (
        <li
          key={m.id}
          className="flex items-start gap-2 rounded-xl border border-silver/10 bg-card/60 px-3 py-2.5"
        >
          <Brain
            className="mt-0.5 size-3.5 shrink-0 text-gold"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            {m.category && (
              <p className="text-[9px] font-semibold tracking-[0.16em] text-gold/80 uppercase">
                {m.category}
              </p>
            )}
            <p className="text-sm text-foreground">{m.fact}</p>
          </div>
          <button
            type="button"
            disabled={pending}
            aria-label={t('forgetNote')}
            onClick={() => {
              startTransition(async () => {
                const result = await deactivateMemoryAction(m.id)
                if (result.ok) {
                  onChanged?.(memories.filter((x) => x.id !== m.id))
                }
              })
            }}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
          </button>
        </li>
      ))}
    </ul>
  )
}
