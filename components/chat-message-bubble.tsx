'use client'

import { parseSplitShareMessage } from '@/lib/split-share-message'
import { SplitShareMessageCard } from '@/components/split-share-message-card'

type ChatMessageBubbleProps = {
  content: string
  mine?: boolean
  currentUserId?: string
}

export function ChatMessageBubble({
  content,
  mine = false,
  currentUserId,
}: ChatMessageBubbleProps) {
  const payload = parseSplitShareMessage(content)
  if (payload) {
    return (
      <div className="p-1.5">
        <SplitShareMessageCard
          payload={payload}
          mine={mine}
          currentUserId={currentUserId}
        />
      </div>
    )
  }

  return (
    <div className="rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed">
      {content}
    </div>
  )
}

export function chatMessagePreview(content: string, fallback: string): string {
  const payload = parseSplitShareMessage(content)
  if (!payload) return content
  return `Split: ${payload.name}`
}
