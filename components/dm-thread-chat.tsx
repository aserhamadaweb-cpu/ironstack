'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Send } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { UserAvatar } from '@/components/user-avatar'
import { ChatMessageBubble } from '@/components/chat-message-bubble'
import type { DmMessage } from '@/lib/database.types'
import { sendDmMessageAction } from '@/lib/data/social-actions'
import { profileHref } from '@/lib/profile-path'

type DmThreadChatProps = {
  threadId: string
  currentUserId: string
  threadStatus: 'pending' | 'accepted'
  isFriend: boolean
  other: {
    id: string
    username: string | null
    display_name: string | null
    avatar_url: string | null
  }
  initialMessages: DmMessage[]
}

export function DmThreadChat({
  threadId,
  currentUserId,
  threadStatus,
  isFriend,
  other,
  initialMessages,
}: DmThreadChatProps) {
  const t = useTranslations('messages')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [messages, setMessages] = useState(initialMessages)
  const [status, setStatus] = useState(threadStatus)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const bottomRef = useRef<HTMLDivElement>(null)

  const name = other.display_name || other.username || tCommon('athlete')
  const href = profileHref(other.username, other.id)

  const myPendingOutbound =
    status === 'pending' &&
    !isFriend &&
    messages.some((m) => m.sender_id === currentUserId) &&
    !messages.some((m) => m.sender_id !== currentUserId)

  const waitingForReply = myPendingOutbound
  const composerLocked = waitingForReply

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const onFocus = () => router.refresh()
    window.addEventListener('focus', onFocus)
    const id = window.setInterval(() => router.refresh(), 20000)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(id)
    }
  }, [router])

  useEffect(() => {
    setMessages(initialMessages)
    setStatus(threadStatus)
  }, [initialMessages, threadStatus])

  const send = () => {
    const text = input.trim()
    if (!text || pending || composerLocked) return
    setError(null)
    setInput('')
    const optimistic: DmMessage = {
      id: `local-${Date.now()}`,
      thread_id: threadId,
      sender_id: currentUserId,
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    startTransition(async () => {
      const result = await sendDmMessageAction({ threadId, content: text })
      if (!result.ok) {
        setError(result.error ?? t('couldNotSend'))
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        setInput(text)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="mx-auto flex app-chat-viewport-height max-w-2xl flex-col">
      <header className="flex items-center gap-3 border-b border-silver/10 px-4 py-3">
        <Link
          href="/dashboard/messages"
          className="rounded-lg p-2 text-muted-foreground transition hover:bg-card hover:text-foreground"
          aria-label={t('backInbox')}
        >
          <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
        </Link>
        <UserAvatar
          name={name}
          username={other.username}
          avatarUrl={other.avatar_url}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          {href ? (
            <Link
              href={href}
              className="truncate font-heading text-sm font-semibold text-foreground hover:text-gold"
            >
              {name}
            </Link>
          ) : (
            <p className="truncate font-heading text-sm font-semibold text-foreground">
              {name}
            </p>
          )}
          <p className="text-[10px] tracking-[0.14em] text-muted-foreground">
            {status === 'accepted' || isFriend
              ? t('openChat')
              : waitingForReply
                ? t('waitingReply')
                : t('messageRequest')}
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((msg) => {
          const mine = msg.sender_id === currentUserId
          return (
            <div
              key={msg.id}
              className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl ${
                  mine
                    ? 'rounded-ee-md border border-blue/25 border-e-[3px] border-e-blue bg-card text-foreground'
                    : 'rounded-es-md border border-silver/10 bg-card/80 text-foreground'
                }`}
              >
                <ChatMessageBubble
                  content={msg.content}
                  mine={mine}
                  currentUserId={currentUserId}
                />
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p role="alert" className="px-4 pb-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <form
        className="border-t border-silver/10 bg-background/90 p-3 backdrop-blur-xl"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        {composerLocked ? (
          <p className="rounded-xl border border-blue/25 bg-blue-tint/40 px-3 py-3 text-center text-sm text-blue">
            {t('waitingComposer')}
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              rows={1}
              placeholder={t('writePlaceholder')}
              disabled={pending}
              className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-border bg-card/90 px-3 py-2.5 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/20 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label={t('send')}
              className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gold text-background disabled:opacity-50"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4 rtl-flip" aria-hidden="true" />
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
