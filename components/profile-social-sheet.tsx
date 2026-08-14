'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { UserAvatar } from '@/components/user-avatar'
import type { SocialListPerson } from '@/lib/data/social'
import { getSocialListAction } from '@/lib/data/social-actions'
import { profileHref } from '@/lib/profile-path'

export type SocialListKind = 'followers' | 'following' | 'friends'

const TITLES: Record<SocialListKind, string> = {
  followers: 'Followers',
  following: 'Following',
  friends: 'Friends',
}

/** Shares in-flight list fetches across Strict Mode double-mount. */
const socialListInflight = new Map<
  string,
  Promise<{ people: SocialListPerson[]; error?: string }>
>()

function loadSocialList(profileUserId: string, kind: SocialListKind) {
  const key = `${profileUserId}:${kind}`
  const existing = socialListInflight.get(key)
  if (existing) return existing

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[fetch-trace] getSocialListAction NETWORK kind=${kind} profile=${profileUserId}`,
    )
  }

  const promise = getSocialListAction(profileUserId, kind).finally(() => {
    window.setTimeout(() => {
      if (socialListInflight.get(key) === promise) {
        socialListInflight.delete(key)
      }
    }, 1500)
  })
  socialListInflight.set(key, promise)
  return promise
}

type ProfileSocialSheetProps = {
  open: boolean
  kind: SocialListKind | null
  profileUserId: string
  onClose: () => void
}

export function ProfileSocialSheet({
  open,
  kind,
  profileUserId,
  onClose,
}: ProfileSocialSheetProps) {
  const reduceMotion = useReducedMotion()
  const [people, setPeople] = useState<SocialListPerson[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !kind) return
    let cancelled = false
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[fetch-trace] ProfileSocialSheet effect kind=${kind} (may share in-flight)`,
      )
    }
    setLoading(true)
    setError(null)
    setPeople([])
    void loadSocialList(profileUserId, kind).then((result) => {
      if (cancelled) return
      setPeople(result.people)
      setError(result.error ?? null)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [open, kind, profileUserId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && kind && (
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
            aria-labelledby="social-sheet-title"
            className="relative z-10 flex max-h-[80svh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-silver/15 bg-card shadow-2xl sm:rounded-2xl"
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
            <header className="flex items-center justify-between border-b border-silver/10 px-5 py-4">
              <h2
                id="social-sheet-title"
                className="font-heading text-lg font-bold text-foreground"
              >
                {TITLES[kind]}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex size-10 items-center justify-center rounded-full text-muted-foreground transition hover:bg-silver/10 hover:text-foreground"
                aria-label="Close list"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="overflow-y-auto px-2 py-2">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading…
                </div>
              )}
              {!loading && error && (
                <p className="px-3 py-10 text-center text-sm text-destructive">
                  {error}
                </p>
              )}
              {!loading && !error && people.length === 0 && (
                <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                  Nobody here yet.
                </p>
              )}
              {!loading &&
                people.map((person) => {
                  const name =
                    person.display_name || person.username || 'Athlete'
                  const href = profileHref(person.username, person.id)
                  const row = (
                    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-silver/5">
                      <UserAvatar
                        name={name}
                        username={person.username}
                        userId={person.id}
                        avatarUrl={person.avatar_url}
                        size="sm"
                        link={false}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {name}
                        </p>
                        {person.username && (
                          <p className="truncate text-xs text-muted-foreground">
                            @{person.username}
                          </p>
                        )}
                      </div>
                      <StatusChip
                        isFriend={person.isFriend}
                        isFollowing={person.isFollowing}
                        friendshipStatus={person.friendshipStatus}
                      />
                    </div>
                  )
                  return href ? (
                    <Link
                      key={person.id}
                      href={href}
                      onClick={onClose}
                      className="block"
                      prefetch={false}
                    >
                      {row}
                    </Link>
                  ) : (
                    <div key={person.id}>{row}</div>
                  )
                })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function StatusChip({
  isFriend,
  isFollowing,
  friendshipStatus,
}: {
  isFriend: boolean
  isFollowing: boolean
  friendshipStatus?: 'none' | 'outgoing' | 'incoming' | 'friends'
}) {
  if (isFriend || friendshipStatus === 'friends') {
    return (
      <span className="shrink-0 rounded-full border border-success/35 bg-success/10 px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] text-success">
        FRIENDS
      </span>
    )
  }
  if (friendshipStatus === 'outgoing') {
    return (
      <span className="shrink-0 rounded-full border border-silver/25 px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] text-muted-foreground">
        REQUESTED
      </span>
    )
  }
  if (friendshipStatus === 'incoming') {
    return (
      <span className="shrink-0 rounded-full border border-blue/30 bg-blue-tint/40 px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] text-blue">
        REQUEST
      </span>
    )
  }
  if (isFollowing) {
    return (
      <span className="shrink-0 rounded-full border border-blue/30 bg-blue-tint/40 px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] text-blue">
        FOLLOWING
      </span>
    )
  }
  return (
    <span className="shrink-0 rounded-full border border-silver/20 px-2 py-0.5 text-[9px] font-semibold tracking-[0.12em] text-muted-foreground">
      —
    </span>
  )
}
