'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, Loader2, Search, UserPlus, Users, X } from 'lucide-react'
import { UserAvatar } from '@/components/user-avatar'
import { CTA_PRIMARY } from '@/lib/accent'
import type { FriendshipRelation } from '@/lib/data/social'
import {
  acceptFriendRequestAction,
  cancelFriendRequestAction,
  declineFriendRequestAction,
  listFriendRequestsAction,
  searchPeopleAction,
  sendFriendRequestAction,
  unfriendAction,
  type DiscoverPerson,
} from '@/lib/data/social-actions'
import { profileHref } from '@/lib/profile-path'

type FindPeopleSheetProps = {
  open: boolean
  onClose: () => void
}

type RequestPerson = {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
}

function actionLabel(status: FriendshipRelation) {
  switch (status) {
    case 'friends':
      return 'Friends'
    case 'outgoing':
      return 'Requested'
    case 'incoming':
      return 'Accept'
    default:
      return 'Add friend'
  }
}

export function FindPeopleSheet({ open, onClose }: FindPeopleSheetProps) {
  const reduceMotion = useReducedMotion()
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState<DiscoverPerson[]>([])
  const [requests, setRequests] = useState<RequestPerson[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    void listFriendRequestsAction().then((result) => {
      setRequests(result.people)
      if (result.error) setError(result.error)
    })
  }, [open])

  useEffect(() => {
    if (!open) return
    const q = query.trim()
    if (q.length < 1) {
      setPeople([])
      setLoading(false)
      return
    }

    setLoading(true)
    const handle = window.setTimeout(() => {
      void searchPeopleAction(q).then((result) => {
        setPeople(result.people)
        setError(result.error ?? null)
        setLoading(false)
      })
    }, 250)

    return () => window.clearTimeout(handle)
  }, [query, open])

  const refreshResults = async () => {
    const [search, incoming] = await Promise.all([
      query.trim().length > 0
        ? searchPeopleAction(query.trim())
        : Promise.resolve({ people: [] as DiscoverPerson[] }),
      listFriendRequestsAction(),
    ])
    setPeople(search.people)
    setRequests(incoming.people)
    if (search.error) setError(search.error)
  }

  const runFriendAction = (
    personId: string,
    action: () => Promise<{ ok: boolean; error?: string }>,
  ) => {
    setPendingId(personId)
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setError(result.error ?? 'Could not update friend request.')
        setPendingId(null)
        return
      }
      await refreshResults()
      setPendingId(null)
    })
  }

  const onPrimaryClick = (person: DiscoverPerson) => {
    switch (person.friendshipStatus) {
      case 'none':
        runFriendAction(person.id, () => sendFriendRequestAction(person.id))
        break
      case 'outgoing':
        runFriendAction(person.id, () => cancelFriendRequestAction(person.id))
        break
      case 'incoming':
        runFriendAction(person.id, () => acceptFriendRequestAction(person.id))
        break
      case 'friends':
        runFriendAction(person.id, () => unfriendAction(person.id))
        break
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-[var(--overlay-scrim)] backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="find-people-title"
            className="relative z-10 flex max-h-[85svh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-silver/15 bg-card shadow-2xl sm:rounded-2xl"
            initial={
              reduceMotion ? false : { opacity: 0, y: 40, scale: 0.98 }
            }
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, y: 24, scale: 0.98 }
            }
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <header className="border-b border-silver/10 px-5 py-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.3em] text-gold">
                    TRAINING CIRCLE
                  </p>
                  <h2
                    id="find-people-title"
                    className="font-heading text-lg font-bold text-foreground"
                  >
                    Find friends
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-silver/10 hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="size-4" />
                </button>
              </div>
              <label className="relative block">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search username or name…"
                  autoFocus
                  className="w-full rounded-xl border border-border bg-background/80 py-2.5 pr-3 pl-10 text-sm text-foreground outline-none transition focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
                />
              </label>
            </header>

            <div className="overflow-y-auto px-2 py-2">
              {query.trim().length === 0 && requests.length > 0 && (
                <div className="mb-2 px-3 pt-2">
                  <p className="mb-2 text-[10px] font-semibold tracking-[0.2em] text-blue">
                    FRIEND REQUESTS
                  </p>
                  {requests.map((person) => {
                    const name =
                      person.display_name || person.username || 'Athlete'
                    const href = profileHref(person.username, person.id)
                    const busy = pendingId === person.id
                    return (
                      <div
                        key={person.id}
                        className="flex items-center gap-3 rounded-xl px-1 py-2.5"
                      >
                        <Link
                          href={href}
                          onClick={onClose}
                          className="flex min-w-0 flex-1 items-center gap-3"
                        >
                          <UserAvatar
                            name={name}
                            username={person.username}
                            userId={person.id}
                            avatarUrl={person.avatar_url}
                            size="sm"
                            link={false}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {name}
                            </p>
                            {person.username && (
                              <p className="truncate text-xs text-muted-foreground">
                                @{person.username}
                              </p>
                            )}
                          </div>
                        </Link>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runFriendAction(person.id, () =>
                              declineFriendRequestAction(person.id),
                            )
                          }
                          className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-full border border-silver/25 px-3 text-[10px] font-bold tracking-[0.1em] text-muted-foreground disabled:opacity-60"
                        >
                          {busy ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            'Decline'
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runFriendAction(person.id, () =>
                              acceptFriendRequestAction(person.id),
                            )
                          }
                          className={`inline-flex min-h-8 shrink-0 items-center justify-center rounded-full px-3 text-[10px] font-bold tracking-[0.1em] disabled:opacity-60 ${CTA_PRIMARY}`}
                        >
                          {busy ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            'Accept'
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}

              {loading && (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Searching…
                </div>
              )}
              {!loading && error && (
                <p className="px-3 py-10 text-center text-sm text-destructive">
                  {error}
                </p>
              )}
              {!loading && !error && query.trim().length === 0 && (
                <div className="flex flex-col items-center gap-2 px-3 py-10 text-center text-sm text-muted-foreground">
                  <Users className="size-8 text-muted-foreground" />
                  Search for athletes and send a friend request.
                </div>
              )}
              {!loading &&
                !error &&
                query.trim().length > 0 &&
                people.length === 0 && (
                  <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                    No athletes matched “{query.trim()}”.
                  </p>
                )}
              {!loading &&
                people.map((person) => {
                  const name =
                    person.display_name || person.username || 'Athlete'
                  const href = profileHref(person.username, person.id)
                  const busy = pendingId === person.id
                  const label = actionLabel(person.friendshipStatus)

                  return (
                    <div
                      key={person.id}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                    >
                      <Link
                        href={href}
                        onClick={onClose}
                        className="flex min-w-0 flex-1 items-center gap-3 transition-opacity hover:opacity-90"
                      >
                        <UserAvatar
                          name={name}
                          username={person.username}
                          userId={person.id}
                          avatarUrl={person.avatar_url}
                          size="sm"
                          link={false}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {name}
                          </p>
                          {person.username && (
                            <p className="truncate text-xs text-muted-foreground">
                              @{person.username}
                            </p>
                          )}
                        </div>
                      </Link>

                      {person.friendshipStatus === 'incoming' && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            runFriendAction(person.id, () =>
                              declineFriendRequestAction(person.id),
                            )
                          }
                          className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-full border border-silver/25 px-3 text-[10px] font-bold tracking-[0.1em] text-muted-foreground disabled:opacity-60"
                        >
                          Decline
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onPrimaryClick(person)}
                        className={`inline-flex min-h-8 shrink-0 items-center justify-center gap-1 rounded-full px-3 text-[10px] font-bold tracking-[0.1em] transition disabled:opacity-60 ${
                          person.friendshipStatus === 'friends'
                            ? 'border border-success/35 bg-success/10 text-success'
                            : person.friendshipStatus === 'outgoing'
                              ? 'border border-silver/25 text-muted-foreground'
                              : CTA_PRIMARY
                        }`}
                      >
                        {busy ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : person.friendshipStatus === 'friends' ? (
                          <Check className="size-3" />
                        ) : person.friendshipStatus === 'none' ? (
                          <UserPlus className="size-3" />
                        ) : null}
                        {busy ? null : label}
                      </button>
                    </div>
                  )
                })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
