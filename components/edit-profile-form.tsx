'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { AvatarPresetPicker } from '@/components/avatar-preset-picker'
import {
  removeAvatarAction,
  updateProfileAction,
} from '@/lib/data/profile-actions'
import { isAvatarPresetPath } from '@/lib/avatar-presets'
import { compressAvatarImage } from '@/lib/compress-avatar'
import { CTA_PRIMARY } from '@/lib/accent'
import { initialsFrom } from '@/lib/dashboard-utils'
import { createClient } from '@/lib/supabase/client'

type EditProfileFormProps = {
  userId: string
  initial: {
    username: string
    displayName: string
    bio: string
    avatarUrl: string | null
    usernameChangeCount?: number
  }
  onCancel?: () => void
  onSuccess?: (username: string) => void
}

const BIO_MAX = 160
const USERNAME_CHANGE_LIMIT = 2

export function EditProfileForm({
  userId,
  initial,
  onCancel,
  onSuccess,
}: EditProfileFormProps) {
  const router = useRouter()
  const [username, setUsername] = useState(initial.username)
  const [displayName, setDisplayName] = useState(initial.displayName)
  const [bio, setBio] = useState(initial.bio)
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [processing, setProcessing] = useState(false)
  const [pending, startTransition] = useTransition()

  const preview = previewUrl || avatarUrl
  const bioLeft = BIO_MAX - bio.length
  const busy = pending || processing
  const changeCount = initial.usernameChangeCount ?? 0
  const usernameLocked =
    Boolean(initial.username.trim()) && changeCount >= USERNAME_CHANGE_LIMIT
  const changesLeft = Math.max(0, USERNAME_CHANGE_LIMIT - changeCount)

  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setFile(null)
  }

  const onPickFile = async (picked: File | null) => {
    setErrors((e) => {
      const next = { ...e }
      delete next.avatar
      return next
    })

    if (!picked) {
      clearPreview()
      return
    }

    setProcessing(true)
    try {
      const compressed = await compressAvatarImage(picked)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      setFile(compressed.file)
      setPreviewUrl(compressed.previewUrl)
    } catch (err) {
      clearPreview()
      setErrors({
        avatar:
          err instanceof Error ? err.message : 'Could not process that image.',
      })
    } finally {
      setProcessing(false)
    }
  }

  const onPickPreset = (path: string | null) => {
    clearPreview()
    setErrors((e) => {
      const next = { ...e }
      delete next.avatar
      return next
    })
    setAvatarUrl(path)
  }

  const selectedPreset = file
    ? null
    : isAvatarPresetPath(avatarUrl)
      ? avatarUrl
      : null

  const uploadAvatar = async (): Promise<string | null> => {
    if (!file) return null
    const ext = file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${userId}/${Date.now()}.${ext}`
    const supabase = createClient()
    const { error } = await supabase.storage.from('avatars').upload(path, file, {
      upsert: true,
      contentType: file.type,
    })
    if (error) throw new Error(error.message)
    return path
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (processing) return
    setErrors({})
    startTransition(async () => {
      try {
        let newAvatarPath: string | null = null
        if (file) {
          newAvatarPath = await uploadAvatar()
        }
        const result = await updateProfileAction({
          username,
          displayName,
          bio,
          avatarUrl,
          newAvatarPath,
        })
        if (!result.ok) {
          setErrors(result.errors)
          return
        }
        const nextUsername = username.trim().toLowerCase()
        if (onSuccess) {
          onSuccess(nextUsername)
        } else {
          router.push(`/profile/${encodeURIComponent(nextUsername)}`)
          router.refresh()
        }
      } catch (err) {
        setErrors({
          avatar:
            err instanceof Error ? err.message : 'Could not upload avatar.',
        })
      }
    })
  }

  const fieldClass =
    'w-full rounded-xl border border-border bg-card/90 px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20'

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-lg space-y-6">
      <div className="flex flex-col items-center gap-4">
        <div className="relative size-28 overflow-hidden rounded-full border border-silver/20 bg-card">
          {preview ? (
            <Image
              src={preview}
              alt=""
              fill
              className="object-cover"
              sizes="112px"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-2xl font-bold text-gold">
              {initialsFrom(displayName || username || 'A')}
            </div>
          )}
          {processing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[var(--overlay-scrim)] text-center">
              <Loader2 className="size-5 animate-spin text-gold" />
              <span className="text-[10px] font-semibold tracking-[0.14em] text-gold">
                PROCESSING…
              </span>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <label
            className={`inline-flex items-center gap-2 rounded-full border border-gold/35 bg-gold/10 px-4 py-2 text-xs font-semibold text-gold transition hover:bg-gold/15 ${
              busy ? 'pointer-events-none opacity-60' : 'cursor-pointer'
            }`}
          >
            {processing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Camera className="size-3.5" />
            )}
            {processing ? 'Processing…' : 'Change photo'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              disabled={busy}
              onChange={(e) => {
                void onPickFile(e.target.files?.[0] ?? null)
                e.target.value = ''
              }}
            />
          </label>
          {(avatarUrl || previewUrl) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                clearPreview()
                if (avatarUrl) {
                  startTransition(async () => {
                    const result = await removeAvatarAction()
                    if (result.ok) setAvatarUrl(null)
                  })
                }
              }}
              className="inline-flex items-center gap-2 rounded-full border border-silver/20 px-4 py-2 text-xs text-muted-foreground transition hover:text-destructive disabled:opacity-60"
            >
              <Trash2 className="size-3.5" />
              Remove
            </button>
          )}
        </div>
        {file && !processing && (
          <p className="text-[11px] text-muted-foreground">
            Ready to upload · {(file.size / 1024).toFixed(0)} KB · 512×512
          </p>
        )}
        <div className="w-full max-w-md">
          <AvatarPresetPicker
            value={selectedPreset}
            onChange={onPickPreset}
            disabled={busy}
          />
        </div>
        {errors.avatar && (
          <p className="text-sm text-destructive">{errors.avatar}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
          DISPLAY NAME
        </label>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={60}
          className={fieldClass}
          required
        />
        {errors.displayName && (
          <p className="mt-1.5 text-sm text-destructive">{errors.displayName}</p>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
          USERNAME
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">
            @
          </span>
          <input
            value={username}
            onChange={(e) =>
              setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
            }
            maxLength={30}
            className={`${fieldClass} pl-7 ${usernameLocked ? 'opacity-70' : ''}`}
            required
            disabled={busy || usernameLocked}
            readOnly={usernameLocked}
          />
        </div>
        {errors.username ? (
          <p className="mt-1.5 text-sm text-destructive">{errors.username}</p>
        ) : usernameLocked ? (
          <p className="mt-1.5 text-xs text-muted-foreground">
            Username locked — you already used both changes.
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-muted-foreground">
            3–30 chars · lowercase letters, numbers, underscores
            {initial.username.trim()
              ? ` · ${changesLeft} change${changesLeft === 1 ? '' : 's'} left`
              : ''}
          </p>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
            BIO
          </label>
          <span
            className={`text-[10px] tabular-nums ${
              bioLeft < 0 ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {bioLeft}
          </span>
        </div>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
          rows={3}
          maxLength={BIO_MAX}
          placeholder="A short note about how you train…"
          className={`${fieldClass} resize-none`}
        />
        {errors.bio && (
          <p className="mt-1.5 text-sm text-destructive">{errors.bio}</p>
        )}
      </div>

      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {errors.form}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            if (onCancel) onCancel()
            else if (initial.username) {
              router.push(
                `/profile/${encodeURIComponent(initial.username)}`,
              )
            } else {
              router.push('/dashboard/profile')
            }
          }}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-full border border-silver/20 text-xs font-semibold tracking-[0.14em] text-muted-foreground"
        >
          CANCEL
        </button>
        <button
          type="submit"
          disabled={busy}
          className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full text-xs font-bold tracking-[0.14em] disabled:opacity-60 ${CTA_PRIMARY}`}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          SAVE PROFILE
        </button>
      </div>
    </form>
  )
}
