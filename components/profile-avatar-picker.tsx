'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { AvatarPresetPicker } from '@/components/avatar-preset-picker'
import { isAvatarPresetPath } from '@/lib/avatar-presets'
import { compressAvatarImage } from '@/lib/compress-avatar'
import { initialsFrom } from '@/lib/dashboard-utils'

export type ProfileAvatarPickerValue = {
  file: File | null
  presetPath: string | null
  previewUrl: string | null
}

type ProfileAvatarPickerProps = {
  displayName: string
  username: string
  initialAvatarUrl?: string | null
  disabled?: boolean
  onChange: (value: ProfileAvatarPickerValue) => void
  onError?: (message: string) => void
}

export function ProfileAvatarPicker({
  displayName,
  username,
  initialAvatarUrl = null,
  disabled = false,
  onChange,
  onError,
}: ProfileAvatarPickerProps) {
  const t = useTranslations('auth')
  const [storedUrl, setStoredUrl] = useState(initialAvatarUrl)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)

  const busy = disabled || processing
  const preview = previewUrl || storedUrl
  const selectedPreset =
    file || previewUrl ? null : isAvatarPresetPath(storedUrl) ? storedUrl : null

  const emit = (next: ProfileAvatarPickerValue) => {
    onChange(next)
  }

  const clearPreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setFile(null)
    emit({ file: null, presetPath: selectedPreset, previewUrl: null })
  }

  const onPickFile = async (picked: File | null) => {
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
      setStoredUrl(null)
      emit({
        file: compressed.file,
        presetPath: null,
        previewUrl: compressed.previewUrl,
      })
    } catch (err) {
      clearPreview()
      onError?.(
        err instanceof Error ? err.message : t('avatarProcessFailed'),
      )
    } finally {
      setProcessing(false)
    }
  }

  const onPickPreset = (path: string | null) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setFile(null)
    setStoredUrl(path)
    emit({ file: null, presetPath: path, previewUrl: null })
  }

  const clearAll = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setFile(null)
    setStoredUrl(null)
    emit({ file: null, presetPath: null, previewUrl: null })
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div>
        <p className="mb-2 text-center text-sm font-medium text-muted-foreground">
          {t('profilePhoto')}{' '}
          <span className="text-xs font-normal">({t('profilePhotoOptional')})</span>
        </p>
        <div className="relative mx-auto size-28 overflow-hidden rounded-full border border-silver/20 bg-card">
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
          {processing ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[var(--overlay-scrim)] text-center">
              <Loader2 className="size-5 animate-spin text-gold" />
            </div>
          ) : null}
        </div>
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
          {processing ? t('pleaseWait') : t('choosePhoto')}
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
        {(preview || file) && (
          <button
            type="button"
            disabled={busy}
            onClick={clearAll}
            className="inline-flex items-center gap-2 rounded-full border border-silver/20 px-4 py-2 text-xs text-muted-foreground transition hover:text-destructive disabled:opacity-60"
          >
            <Trash2 className="size-3.5" />
            {t('removePhoto')}
          </button>
        )}
      </div>

      {file && !processing ? (
        <p className="text-[11px] text-muted-foreground">
          {(file.size / 1024).toFixed(0)} KB · 512×512
        </p>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          {t('profilePhotoHint')}
        </p>
      )}

      <div className="w-full">
        <AvatarPresetPicker
          value={selectedPreset}
          onChange={onPickPreset}
          disabled={busy}
        />
      </div>
    </div>
  )
}
