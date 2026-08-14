'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Check, Loader2, Users } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { UserAvatar } from '@/components/user-avatar'
import { CTA_PRIMARY } from '@/lib/accent'
import { createGroupChatAction } from '@/lib/data/group-chats'

type FriendOption = {
  id: string
  name: string
  username?: string | null
  avatarUrl?: string | null
}

type CreateGroupChatFormProps = {
  friends: FriendOption[]
}

export function CreateGroupChatForm({ friends }: CreateGroupChatFormProps) {
  const t = useTranslations('messages')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [name, setName] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return friends
    return friends.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.username ?? '').toLowerCase().includes(q),
    )
  }, [friends, query])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const result = await createGroupChatAction({
        name,
        memberIds: [...selected],
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(`/dashboard/messages/groups/${result.groupId}`)
      router.refresh()
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
      <header className="flex items-start gap-3">
        <Link
          href="/dashboard/messages"
          className="mt-1 rounded-lg p-2 text-muted-foreground transition hover:bg-card hover:text-foreground"
          aria-label={t('backInbox')}
        >
          <ArrowLeft className="size-4 rtl-flip" aria-hidden="true" />
        </Link>
        <div>
          <p className="section-kicker">{t('newGroupKicker')}</p>
          <h1 className="font-heading mt-1 text-2xl font-bold text-headline">
            {t('newGroupTitle')}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('newGroupBody')}
          </p>
        </div>
      </header>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <label className="block space-y-1.5">
        <span className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
          {t('groupName')}
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('groupNamePlaceholder')}
          className="h-11 w-full rounded-xl border border-border bg-card/90 px-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        />
      </label>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
            {t('pickMembers')}
          </p>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {t('selectedCount', { count: selected.size })}
          </span>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchFriends')}
          className="h-11 w-full rounded-xl border border-border bg-card/90 px-3 text-sm outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
        />

        {friends.length === 0 ? (
          <p className="rounded-xl border border-dashed border-silver/20 px-4 py-8 text-center text-sm text-muted-foreground">
            {t('needFriendsForGroup')}
          </p>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border border-dashed border-silver/20 px-4 py-8 text-center text-sm text-muted-foreground">
            {t('noFriendsMatch')}
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((friend) => {
              const active = selected.has(friend.id)
              return (
                <li key={friend.id}>
                  <button
                    type="button"
                    onClick={() => toggle(friend.id)}
                    className={`is-row flex w-full items-center gap-3 px-3 py-3 text-start ${
                      active ? 'border-gold/40 bg-gold/10' : ''
                    }`}
                  >
                    <UserAvatar
                      name={friend.name}
                      username={friend.username}
                      userId={friend.id}
                      avatarUrl={friend.avatarUrl}
                      size="sm"
                      link={false}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                      {friend.name}
                      {friend.username ? (
                        <span className="ms-2 text-xs font-normal text-muted-foreground">
                          @{friend.username}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={`flex size-6 items-center justify-center rounded-full border ${
                        active
                          ? 'border-gold bg-gold text-background'
                          : 'border-silver/25 text-transparent'
                      }`}
                    >
                      <Check className="size-3.5" aria-hidden="true" />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <button
        type="button"
        disabled={pending || name.trim().length < 2 || selected.size === 0}
        onClick={submit}
        className={`inline-flex w-full items-center justify-center gap-2 px-6 ${CTA_PRIMARY}`}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Users className="size-4" aria-hidden="true" />
        )}
        {t('createGroup')}
      </button>
    </div>
  )
}
