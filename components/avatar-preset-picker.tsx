'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { AVATAR_PRESETS } from '@/lib/avatar-presets'

type AvatarPresetPickerProps = {
  value: string | null
  onChange: (path: string | null) => void
  disabled?: boolean
  /** When true, selecting the active preset again clears it. */
  allowClear?: boolean
}

export function AvatarPresetPicker({
  value,
  onChange,
  disabled,
  allowClear = true,
}: AvatarPresetPickerProps) {
  const t = useTranslations('auth')

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">
        {t('choosePresetAvatar')}
      </p>
      <div
        className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-8"
        role="listbox"
        aria-label={t('choosePresetAvatar')}
      >
        {AVATAR_PRESETS.map((preset) => {
          const selected = value === preset.path
          return (
            <button
              key={preset.id}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={disabled}
              title={preset.label}
              onClick={() => {
                if (selected && allowClear) onChange(null)
                else onChange(preset.path)
              }}
              className={`relative aspect-square min-h-11 min-w-11 overflow-hidden rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50 ${
                selected
                  ? 'border-gold shadow-[0_0_0_2px_rgba(232,181,74,0.35)]'
                  : 'border-silver/20 hover:border-gold/40'
              }`}
            >
              <Image
                src={preset.path}
                alt={preset.label}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t('presetAvatarHint')}</p>
    </div>
  )
}
