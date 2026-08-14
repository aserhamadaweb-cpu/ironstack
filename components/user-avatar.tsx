'use client'

import Image from 'next/image'
import Link from 'next/link'
import { initialsFrom } from '@/lib/dashboard-utils'
import { profileHref } from '@/lib/profile-path'

type UserAvatarProps = {
  name: string
  username?: string | null
  userId?: string | null
  avatarUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** When false, render non-clickable. */
  link?: boolean
}

const SIZE = {
  sm: 'size-11 text-xs',
  md: 'size-12 text-sm',
  lg: 'size-20 text-2xl',
} as const

function usableAvatarUrl(url: string | null | undefined): string | null {
  const raw = url?.trim()
  if (!raw) return null
  if (
    raw.startsWith('https://') ||
    raw.startsWith('http://') ||
    raw.startsWith('/')
  ) {
    // Reject bare junk like "/0.jpg"
    if (/^\/?0\.(jpg|jpeg|png|webp|gif)$/i.test(raw)) return null
    return raw
  }
  return null
}

export function UserAvatar({
  name,
  username,
  userId,
  avatarUrl,
  size = 'md',
  className = '',
  link = true,
}: UserAvatarProps) {
  const href = link ? profileHref(username, userId) : null
  const canLink = Boolean(username?.trim() || userId?.trim())
  const src = usableAvatarUrl(avatarUrl)
  const inner = (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-silver/20 bg-card font-bold text-gold ${SIZE[size]} ${className}`}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          className="object-cover"
          sizes={size === 'lg' ? '80px' : '48px'}
        />
      ) : (
        initialsFrom(name)
      )}
    </span>
  )

  if (!href || !canLink) return inner
  return (
    <Link
      href={href}
      prefetch={false}
      className="inline-flex min-h-11 min-w-11 items-center justify-center transition-opacity active:opacity-80"
      aria-label={`View ${name}'s profile`}
    >
      {inner}
    </Link>
  )
}
