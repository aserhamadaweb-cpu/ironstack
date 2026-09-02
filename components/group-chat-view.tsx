'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Globe2,
  Loader2,
  LogOut,
  Send,
  Settings2,
  Users,
  X,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { UserAvatar } from '@/components/user-avatar'
import { ChatMessageBubble } from '@/components/chat-message-bubble'
import {
  leaveGroupChatAction,
  removeGroupMemberAction,
  renameGroupChatAction,
  sendGroupMessageAction,
} from '@/lib/data/group-chats'
import type { GroupChatDetail } from '@/lib/data/group-chats'
import { profileHref } from '@/lib/profile-path'

type GroupChatViewProps = {
  currentUserId: string
  detail: GroupChatDetail
}

export function GroupChatView({ currentUserId, detail }: GroupChatViewProps) {
  const t = useTranslations('messages')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [messages, setMessages] = useState(detail.messages)
  const [members, setMembers] = useState(detail.members)
  const [chatName, setChatName] = useState(detail.chat.name)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [panelOpen, setPanelOpen] = useState(false)
  const [renameValue, setRenameValue] = useState(detail.chat.name)
  const bottomRef = useRef<HTMLDivElement>(null)

  const canManage =
    !detail.chat.is_global &&
    (detail.myRole === 'owner' || detail.myRole === 'admin')
  const canLeave = !detail.chat.is_global

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setMessages(detail.messages)
    setMembers(detail.members)
    setChatName(detail.chat.name)
    setRenameValue(detail.chat.name)
  }, [detail])

  useEffect(() => {
    const onFocus = () => router.refresh()
    window.addEventListener('focus', onFocus)
    const id = window.setInterval(() => router.refresh(), 20000)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.clearInterval(id)
    }
  }, [router])

  const send = () => {
    const text = input.trim()
    if (!text || pending) return
    setError(null)
    setInput('')
    const optimistic = {
      id: `local-${Date.now()}`,
      group_chat_id: detail.chat.id,
      sender_id: currentUserId,
      content: text,
      created_at: new Date().toISOString(),
      sender: members.find((m) => m.user_id === currentUserId)?.profile ?? null,
    }
    setMessages((prev) => [...prev, optimistic])

    startTransition(async () => {
      const result = await sendGroupMessageAction({
        groupId: detail.chat.id,
        content: text,
      })
      if (!result.ok) {
        setError(result.error)
        setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
        setInput(text)
        return
      }
      router.refresh()
    })
  }

  const leave = () => {
    setError(null)
    startTransition(async () => {
      const result = await leaveGroupChatAction(detail.chat.id)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/dashboard/messages')
      router.refresh()
    })
  }

  const removeMember = (memberUserId: string) => {
    setError(null)
    startTransition(async () => {
      const result = await removeGroupMemberAction({
        groupId: detail.chat.id,
        memberUserId,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setMembers((prev) => prev.filter((m) => m.user_id !== memberUserId))
      router.refresh()
    })
  }

  const rename = () => {
    setError(null)
    startTransition(async () => {
      const result = await renameGroupChatAction({
        groupId: detail.chat.id,
        name: renameValue,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setChatName(renameValue.trim())
      router.refresh()
    })
  }

  return (
    <div className="relative mx-auto flex app-chat-viewport-height max-w-2xl flex-col">
      <header className="flex items-center gap-3 border-b border-silver/10 px-4 py-3">
        <Link
          href="/dashboard/messages"
          className="rounded-lg p-2 text-muted-foreground transition hover:bg-card hover:text-foreground"
          aria-label={t('backInbox')}
        >
          <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
        </Link>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-gold/10 text-gold">
          {detail.chat.is_global ? (
            <Globe2 className="size-4" aria-hidden="true" />
          ) : (
            <Users className="size-4" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-semibold text-foreground">
            {chatName}
          </p>
          <p className="text-[10px] tracking-[0.14em] text-muted-foreground">
            {detail.chat.is_global
              ? t('communityBadge')
              : t('memberCount', { count: members.length })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="rounded-lg p-2 text-muted-foreground transition hover:bg-card hover:text-foreground"
          aria-label={t('groupDetails')}
        >
          <Settings2 className="size-4" aria-hidden="true" />
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((msg) => {
          const mine = msg.sender_id === currentUserId
          const senderName =
            msg.sender?.display_name ||
            msg.sender?.username ||
            tCommon('athlete')
          return (
            <div
              key={msg.id}
              className={`flex gap-2 ${mine ? 'justify-end' : 'justify-start'}`}
            >
              {!mine && (
                <UserAvatar
                  name={senderName}
                  username={msg.sender?.username}
                  userId={msg.sender?.id}
                  avatarUrl={msg.sender?.avatar_url}
                  size="sm"
                  className="!size-8 !text-[10px]"
                />
              )}
              <div className={`max-w-[78%] ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                {!mine && (
                  <p className="mb-1 px-1 text-[10px] font-semibold tracking-[0.08em] text-muted-foreground">
                    {senderName}
                  </p>
                )}
                <div
                  className={`${
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
      </form>

      {panelOpen && (
        <div className="absolute inset-0 z-20 flex flex-col bg-background/95 backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-silver/10 px-4 py-3">
            <h2 className="font-heading text-base font-bold text-foreground">
              {t('groupDetails')}
            </h2>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-card hover:text-foreground"
              aria-label={tCommon('cancel')}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
            {canManage && (
              <section className="space-y-3">
                <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                  {t('renameGroup')}
                </p>
                <div className="flex gap-2">
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    className="h-11 flex-1 rounded-xl border border-border bg-card/90 px-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
                  />
                  <button
                    type="button"
                    disabled={pending || renameValue.trim() === chatName}
                    onClick={rename}
                    className="btn-pill btn-pill-ghost px-4"
                  >
                    {tCommon('save')}
                  </button>
                </div>
              </section>
            )}

            <section className="space-y-3">
              <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
                {t('members')}
              </p>
              <ul className="space-y-2">
                {members.map((member) => {
                  const name =
                    member.profile?.display_name ||
                    member.profile?.username ||
                    tCommon('athlete')
                  const href = profileHref(
                    member.profile?.username,
                    member.user_id,
                  )
                  return (
                    <li
                      key={member.id}
                      className="flex items-center gap-3 rounded-xl border border-silver/10 bg-card/40 px-3 py-2.5"
                    >
                      <UserAvatar
                        name={name}
                        username={member.profile?.username}
                        userId={member.user_id}
                        avatarUrl={member.profile?.avatar_url}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <Link
                          href={href}
                          className="truncate text-sm font-semibold text-foreground hover:text-gold"
                        >
                          {name}
                          {member.user_id === currentUserId ? ` (${t('you')})` : ''}
                        </Link>
                        <p className="text-[10px] tracking-[0.12em] text-muted-foreground">
                          {member.role === 'owner' ||
                          member.role === 'admin' ||
                          member.role === 'member'
                            ? t(`role.${member.role}`)
                            : member.role}
                        </p>
                      </div>
                      {canManage &&
                        member.user_id !== currentUserId &&
                        member.role !== 'owner' && (
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => removeMember(member.user_id)}
                            className="text-[10px] font-semibold tracking-[0.12em] text-heat hover:opacity-80"
                          >
                            {t('removeMember')}
                          </button>
                        )}
                    </li>
                  )
                })}
              </ul>
            </section>

            {canLeave && (
              <button
                type="button"
                disabled={pending}
                onClick={leave}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-heat/30 bg-heat/10 px-4 py-3 text-sm font-semibold text-heat"
              >
                <LogOut className="size-4" aria-hidden="true" />
                {t('leaveGroup')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
