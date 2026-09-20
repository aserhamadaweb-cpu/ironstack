'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Image from 'next/image'
import { Camera, ImageIcon, Loader2, Trash2, X } from 'lucide-react'
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

type ChooserView = 'closed' | 'menu' | 'presets'

export function ProfileAvatarPicker({
  displayName,
  username,
  initialAvatarUrl = null,
  disabled = false,
  onChange,
  onError,
}: ProfileAvatarPickerProps) {
  const t = useTranslations('auth')
  const fileInputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const [storedUrl, setStoredUrl] = useState(initialAvatarUrl)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [chooser, setChooser] = useState<ChooserView>('closed')

  const busy = disabled || processing
  const preview = previewUrl || storedUrl
  const selectedPreset =
    file || previewUrl ? null : isAvatarPresetPath(storedUrl) ? storedUrl : null

  const emit = (next: ProfileAvatarPickerValue) => {
    onChange(next)
  }

  useEffect(() => {
    if (chooser === 'closed') return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setChooser('closed')
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setChooser('closed')
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [chooser])

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
    setChooser('closed')
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
    if (path) setChooser('closed')
  }

  const clearAll = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setFile(null)
    setStoredUrl(null)
    setChooser('closed')
    emit({ file: null, presetPath: null, previewUrl: null })
  }

  const openChooser = () => {
    if (busy) return
    setChooser((current) => (current === 'closed' ? 'menu' : 'closed'))
  }

  return (
    <div ref={rootRef} className="flex flex-col items-center gap-4">
      <div>
        <p className="mb-2 text-center text-sm font-medium text-muted-foreground">
          {t('profilePhoto')}{' '}
          <span className="text-xs font-normal">({t('profilePhotoOptional')})</span>
        </p>
        <div className="relative mx-auto">
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
            {processing ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[var(--overlay-scrim)] text-center">
                <Loader2 className="size-5 animate-spin text-gold" />
              </div>
            ) : null}
          </div>
          <button
            type="button"
            disabled={busy}
            aria-expanded={chooser !== 'closed'}
            aria-controls={chooser !== 'closed' ? 'avatar-source-panel' : undefined}
            onClick={openChooser}
            className="absolute -bottom-1 -end-1 inline-flex size-11 items-center justify-center rounded-full border border-gold/40 bg-gold text-black shadow-md transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-60"
          >
            <Camera className="size-4" aria-hidden="true" />
            <span className="sr-only">{t('choosePhoto')}</span>
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        disabled={busy}
        tabIndex={-1}
        onChange={(e) => {
          void onPickFile(e.target.files?.[0] ?? null)
          e.target.value = ''
        }}
      />

      {chooser !== 'closed' ? (
        <div
          id="avatar-source-panel"
          role="dialog"
          aria-label={t('avatarSourceTitle')}
          className="w-full max-w-sm rounded-2xl border border-gold/25 bg-card/95 p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              {chooser === 'presets'
                ? t('avatarChoosePreset')
                : t('avatarSourceTitle')}
            </p>
            <button
              type="button"
              onClick={() => setChooser('closed')}
              className="inline-flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:bg-silver/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              aria-label={t('avatarSourceClose')}
            >
              <X className="size-4" />
            </button>
          </div>

          {chooser === 'menu' ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-11 items-center gap-3 rounded-xl border border-silver/20 px-3 text-start text-sm font-semibold text-foreground transition hover:border-gold/35 hover:bg-gold/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-60"
              >
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <ImageIcon className="size-4" aria-hidden="true" />
                </span>
                {t('avatarUploadFromGallery')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setChooser('presets')}
                className="inline-flex min-h-11 items-center gap-3 rounded-xl border border-silver/20 px-3 text-start text-sm font-semibold text-foreground transition hover:border-gold/35 hover:bg-gold/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-60"
              >
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <Camera className="size-4" aria-hidden="true" />
                </span>
                {t('avatarChoosePreset')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setChooser('menu')}
                className="text-xs font-semibold tracking-[0.08em] text-muted-foreground transition hover:text-foreground"
              >
                ← {t('avatarSourceBack')}
              </button>
              <AvatarPresetPicker
                value={selectedPreset}
                onChange={onPickPreset}
                disabled={busy}
                heading={false}
              />
            </div>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
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
      ) : chooser === 'closed' ? (
        <p className="text-center text-xs text-muted-foreground">
          {t('profilePhotoHint')}
        </p>
      ) : null}
    </div>
  )
}
