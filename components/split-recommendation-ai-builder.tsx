'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Loader2, Send, Sparkles, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { SplitRecommendation } from '@/lib/split-recommendations'
import {
  applySplitRecommendationAction,
  generateCustomSplitFromPromptAction,
} from '@/lib/data/split-recommendation-actions'
import { SplitRecommendationCard } from '@/components/split-recommendation-card'

type SplitRecommendationAiBuilderProps = {
  onSaved?: (splitId: string, programName?: string) => void
  /** When true, composer is expanded on load and cannot collapse to teaser. */
  defaultOpen?: boolean
}

export function SplitRecommendationAiBuilder({
  onSaved,
  defaultOpen = false,
}: SplitRecommendationAiBuilderProps) {
  const t = useTranslations('splitRecommendations')
  const [open, setOpen] = useState(defaultOpen || false)
  const [prompt, setPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<SplitRecommendation | null>(null)
  const [pending, startTransition] = useTransition()

  const isExpanded = defaultOpen || open

  function handleGenerate() {
    const text = prompt.trim()
    if (!text || pending) return
    setError(null)
    startTransition(async () => {
      const result = await generateCustomSplitFromPromptAction(text)
      if (result.error || !result.data) {
        setError(result.error ?? t('aiGenerateFailed'))
        setPreview(null)
        return
      }
      setPreview(result.data)
    })
  }

  function handleSave(rec: SplitRecommendation) {
    setError(null)
    startTransition(async () => {
      const result = await applySplitRecommendationAction(rec)
      if (result.error || !result.data?.splitId) {
        setError(result.error ?? t('saveFailed'))
        return
      }
      onSaved?.(result.data.splitId, rec.name)
      setPreview(null)
      setPrompt('')
      if (!defaultOpen) {
        setOpen(false)
      }
    })
  }

  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="split-recommendation-card flex min-h-11 w-full max-w-full min-w-0 items-start gap-3 rounded-2xl border border-gold/30 bg-gold/5 px-4 py-4 text-start transition hover:border-gold/50 hover:bg-gold/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <p className="rec-copy font-heading text-base font-bold text-headline">
            {t('aiBuilderTitle')}
          </p>
          <p className="rec-copy mt-1 break-words text-sm text-muted-foreground">
            {t('aiBuilderBody')}
          </p>
        </span>
      </button>
    )
  }

  return (
    <section className="split-recommendation-card rounded-2xl border border-gold/30 bg-background/60">
      <div className="flex items-start justify-between gap-3 border-b border-silver/15 px-4 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-base font-bold">{t('aiBuilderTitle')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('aiBuilderHint')}</p>
          </div>
        </div>
        {!defaultOpen ? (
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              setPreview(null)
              setError(null)
            }}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-silver/20 text-muted-foreground transition hover:text-foreground"
            aria-label={t('aiBuilderClose')}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      <div className="space-y-4 px-4 py-4">
        {!preview ? (
          <>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleGenerate()
                }
              }}
              rows={3}
              placeholder={t('aiBuilderPlaceholder')}
              disabled={pending}
              dir="auto"
              autoFocus={defaultOpen}
              className="max-h-40 min-h-11 w-full resize-y rounded-xl border border-border bg-card/90 px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-60"
            />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={pending || !prompt.trim()}
                onClick={handleGenerate}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-gold px-5 text-xs font-bold tracking-[0.12em] text-black transition active:scale-[0.98] disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
                {t('aiBuilderGenerate')}
              </button>
            </div>
          </>
        ) : (
          <SplitRecommendationCard
            rec={preview}
            selected
            expanded
            busy={pending}
            onToggle={() => undefined}
            onSelect={() => handleSave(preview)}
          />
        )}

        {error ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            {/profile|fitness/i.test(error) ? (
              <Link
                href="/onboarding/continue"
                className="inline-flex min-h-11 items-center text-xs font-bold tracking-[0.12em] text-gold"
              >
                {t('completeProfileCta')} →
              </Link>
            ) : null}
          </div>
        ) : null}

        {preview ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setPreview(null)
              setError(null)
            }}
            className="min-h-11 text-sm text-muted-foreground transition hover:text-gold disabled:opacity-50"
          >
            {t('aiBuilderTryAgain')}
          </button>
        ) : null}
      </div>
    </section>
  )
}
