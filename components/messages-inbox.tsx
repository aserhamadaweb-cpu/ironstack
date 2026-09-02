'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Globe2,
  Loader2,
  MessageSquare,
  MessageSquareDot,
  Plus,
  Users,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/page-states'
import { BackToTrainLink } from '@/components/back-to-train-link'
import { UserAvatar } from '@/components/user-avatar'
import type { GroupChatListItem } from '@/lib/data/group-chats'
import type { DmThreadListItem } from '@/lib/data/social'
import { startDmWithUserAction } from '@/lib/data/social-actions'
import { chatMessagePreview } from '@/components/chat-message-bubble'

type MessagesInboxProps = {
  currentUserId: string
  threads: DmThreadListItem[]
  groups: GroupChatListItem[]
}

type UnifiedItem =
  | {
      kind: 'dm'
      id: string
      sortAt: string
      item: DmThreadListItem
      badge?: string
    }
  | {
      kind: 'group'
      id: string
      sortAt: string
      item: GroupChatListItem
    }

function ThreadRow({
  item,
  badge,
  onOpenFriend,
  opening,
  relativeTime,
  noMessagesYet,
  sayHello,
  athlete,
}: {
  item: DmThreadListItem
  badge?: string
  onOpenFriend?: (otherUserId: string) => void
  opening?: boolean
  relativeTime: (iso: string) => string
  noMessagesYet: string
  sayHello: string
  athlete: string
}) {
  const name = item.other.display_name || item.other.username || athlete
  const preview = item.lastMessage?.content
    ? chatMessagePreview(item.lastMessage.content, noMessagesYet)
    : item.thread
      ? noMessagesYet
      : sayHello

  const inner = (
    <>
      <UserAvatar
        name={name}
        username={item.other.username}
        avatarUrl={item.other.avatar_url}
        size="sm"
        link={false}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-heading text-sm font-semibold text-foreground">
            {name}
          </p>
          {item.lastMessage && (
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {relativeTime(item.lastMessage.created_at)}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {preview}
        </p>
        {badge && (
          <p className="mt-1 text-[10px] font-semibold tracking-[0.14em] text-blue">
            {badge}
          </p>
        )}
      </div>
      {opening && (
        <Loader2 className="size-4 shrink-0 animate-spin text-gold" />
      )}
    </>
  )

  const className =
    'is-row flex min-h-14 w-full items-center gap-3 px-3 py-3 text-start'

  if (item.thread) {
    return (
      <Link href={`/dashboard/messages/${item.thread.id}`} className={className}>
        {inner}
      </Link>
    )
  }

  return (
    <button
      type="button"
      disabled={opening}
      onClick={() => onOpenFriend?.(item.other.id)}
      className={`${className} disabled:opacity-60`}
    >
      {inner}
    </button>
  )
}

function GroupRow({
  item,
  relativeTime,
  noMessagesYet,
  communityBadge,
  groupBadge,
  memberCountLabel,
}: {
  item: GroupChatListItem
  relativeTime: (iso: string) => string
  noMessagesYet: string
  communityBadge: string
  groupBadge: string
  memberCountLabel: string
}) {
  return (
    <Link
      href={`/dashboard/messages/groups/${item.chat.id}`}
      className="is-row flex min-h-14 w-full items-center gap-3 px-3 py-3 text-start"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-gold/10 text-gold">
        {item.chat.is_global ? (
          <Globe2 className="size-4" aria-hidden="true" />
        ) : (
          <Users className="size-4" aria-hidden="true" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-heading text-sm font-semibold text-foreground">
            {item.chat.name}
          </p>
          {item.lastMessage && (
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {relativeTime(item.lastMessage.created_at)}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {item.lastMessage?.content
            ? chatMessagePreview(item.lastMessage.content, noMessagesYet)
            : noMessagesYet}
        </p>
        <p className="mt-1 text-[10px] font-semibold tracking-[0.14em] text-gold">
          {item.chat.is_global ? communityBadge : `${groupBadge} · ${memberCountLabel}`}
        </p>
      </div>
    </Link>
  )
}

export function MessagesInbox({
  currentUserId,
  threads,
  groups,
}: MessagesInboxProps) {
  const t = useTranslations('messages')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.round(diff / 60000)
    if (mins < 1) return t('timeNow')
    if (mins < 60) return t('timeMinutes', { count: mins })
    const hours = Math.round(mins / 60)
    if (hours < 24) return t('timeHours', { count: hours })
    const days = Math.round(hours / 24)
    return t('timeDays', { count: days })
  }

  const withThread = threads.filter((row) => row.thread)
  const friendsWithoutThread = threads.filter((row) => !row.thread)

  const requests = withThread.filter(
    (row) =>
      row.thread!.status === 'pending' &&
      row.lastMessage?.sender_id &&
      row.lastMessage.sender_id !== currentUserId,
  )
  const waiting = withThread.filter(
    (row) =>
      row.thread!.status === 'pending' &&
      (!row.lastMessage || row.lastMessage.sender_id === currentUserId) &&
      !requests.some((r) => r.thread!.id === row.thread!.id),
  )
  const accepted = withThread.filter((row) => row.thread!.status === 'accepted')

  const conversationItems = useMemo(() => {
    const items: UnifiedItem[] = [
      ...groups.map((g) => ({
        kind: 'group' as const,
        id: `group-${g.chat.id}`,
        sortAt: g.lastActivityAt,
        item: g,
      })),
      ...accepted.map((row) => ({
        kind: 'dm' as const,
        id: `dm-${row.thread!.id}`,
        sortAt: row.lastMessage?.created_at ?? row.thread!.updated_at,
        item: row,
      })),
      ...waiting.map((row) => ({
        kind: 'dm' as const,
        id: `wait-${row.thread!.id}`,
        sortAt: row.lastMessage?.created_at ?? row.thread!.updated_at,
        item: row,
        badge: t('waiting'),
      })),
    ]
    items.sort(
      (a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime(),
    )
    return items
  }, [accepted, groups, waiting, t])

  const openFriendChat = (otherUserId: string) => {
    setError(null)
    setOpeningId(otherUserId)
    startTransition(async () => {
      const result = await startDmWithUserAction(otherUserId)
      setOpeningId(null)
      if (!result.ok) {
        setError(result.error ?? t('couldNotStart'))
        return
      }
      router.push(`/dashboard/messages/${result.threadId}`)
    })
  }

  const conversationsEmpty =
    conversationItems.length === 0 && friendsWithoutThread.length === 0

  const rowProps = {
    relativeTime,
    noMessagesYet: t('noMessagesYet'),
    sayHello: t('sayHello'),
    athlete: tCommon('athlete'),
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-6 sm:px-6 sm:py-8" data-tour="page-messages">
      <BackToTrainLink />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="section-kicker">{t('kicker')}</p>
          <h1 className="font-heading mt-1 text-2xl font-bold text-headline sm:text-3xl">
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <Link
          href="/dashboard/messages/groups/new"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-gold/35 bg-gold/10 px-4 text-[10px] font-bold tracking-[0.14em] text-gold transition active:bg-gold/15"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          {t('newGroup')}
        </Link>
      </header>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {requests.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <MessageSquareDot className="size-4 text-blue" />
            <h2 className="text-[10px] font-semibold tracking-[0.22em] text-blue">
              {t('requests')}
            </h2>
          </div>
          <ul className="space-y-2">
            {requests.map((item) => (
              <li key={item.thread!.id}>
                <ThreadRow
                  item={item}
                  badge={t('requestBadge')}
                  {...rowProps}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-[10px] font-semibold tracking-[0.22em] text-muted-foreground">
          {t('conversations')}
        </h2>
        {conversationsEmpty ? (
          <EmptyState
            icon={MessageSquare}
            title={t('noConversations')}
            body={t('noConversationsBody')}
            actionLabel={t('findFriends')}
            actionHref="/dashboard/home"
            tone="silver"
          />
        ) : (
          <ul className="space-y-2">
            {conversationItems.map((entry) =>
              entry.kind === 'group' ? (
                <li key={entry.id}>
                  <GroupRow
                    item={entry.item}
                    relativeTime={relativeTime}
                    noMessagesYet={t('noMessagesYet')}
                    communityBadge={t('communityBadge')}
                    groupBadge={t('groupBadge')}
                    memberCountLabel={t('memberCount', {
                      count: entry.item.memberCount,
                    })}
                  />
                </li>
              ) : (
                <li key={entry.id}>
                  <ThreadRow
                    item={entry.item}
                    badge={entry.badge}
                    {...rowProps}
                  />
                </li>
              ),
            )}
            {friendsWithoutThread.map((item) => (
              <li key={`friend-${item.other.id}`}>
                <ThreadRow
                  item={item}
                  badge={t('friendBadge')}
                  onOpenFriend={openFriendChat}
                  opening={openingId === item.other.id}
                  {...rowProps}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
