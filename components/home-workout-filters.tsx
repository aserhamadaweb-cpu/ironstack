'use client'

import { useTranslations } from 'next-intl'
import {
  HOME_KITS,
  HOME_PACKS,
  HOME_PACK_QUERY,
  HOME_REGIONS,
  type HomeKit,
  type HomePack,
  type HomeRegion,
  type HomeWorkoutQuery,
} from '@/lib/exercises/home-workouts'

type HomeWorkoutFiltersProps = {
  query: HomeWorkoutQuery
  onChange: (next: HomeWorkoutQuery) => void
  compact?: boolean
}

function Chip({
  active,
  onClick,
  children,
  compact,
}: {
  active: boolean
  onClick: () => void
  children: string
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 rounded-full border px-3 font-semibold tracking-[0.1em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
        compact ? 'min-h-9 py-1.5 text-[10px]' : 'min-h-11 py-2 text-[11px]'
      } ${
        active
          ? 'border-gold/60 bg-gold/15 text-gold'
          : 'border-silver/15 bg-card/60 text-muted-foreground hover:border-gold/30 hover:text-foreground'
      }`}
    >
      {children}
    </button>
  )
}

export function HomeWorkoutFilters({
  query,
  onChange,
  compact = false,
}: HomeWorkoutFiltersProps) {
  const t = useTranslations('homeWorkouts')

  const setKit = (kit: HomeKit) => {
    onChange({
      pack: null,
      region: query.pack ? HOME_PACK_QUERY[query.pack].region : query.region,
      kit: query.kit === kit && !query.pack ? null : kit,
    })
  }

  const setRegion = (region: HomeRegion) => {
    onChange({
      pack: null,
      kit: query.pack ? HOME_PACK_QUERY[query.pack].kit : query.kit,
      region: query.region === region && !query.pack ? null : region,
    })
  }

  const setPack = (pack: HomePack) => {
    onChange(
      query.pack === pack
        ? { kit: null, region: null, pack: null }
        : { pack, ...HOME_PACK_QUERY[pack] },
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
          {t('quickCategories')}
        </p>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {HOME_PACKS.map((pack) => (
            <Chip
              key={pack}
              active={query.pack === pack}
              onClick={() => setPack(pack)}
              compact={compact}
            >
              {t(`pack.${pack}`)}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
          {t('equipmentFilters')}
        </p>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {HOME_KITS.map((kit) => (
            <Chip
              key={kit}
              active={query.kit === kit && (query.pack == null || HOME_PACK_QUERY[query.pack].kit === kit)}
              onClick={() => setKit(kit)}
              compact={compact}
            >
              {t(`kit.${kit}`)}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground">
          {t('bodyFilters')}
        </p>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {HOME_REGIONS.map((region) => (
            <Chip
              key={region}
              active={
                query.region === region &&
                (query.pack == null || HOME_PACK_QUERY[query.pack].region === region)
              }
              onClick={() => setRegion(region)}
              compact={compact}
            >
              {t(`region.${region}`)}
            </Chip>
          ))}
        </div>
      </div>

      {!compact && (query.kit || query.region || query.pack) ? (
        <button
          type="button"
          onClick={() => onChange({ kit: null, region: null, pack: null })}
          className="self-start text-xs font-semibold tracking-[0.12em] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
        >
          {t('clearFilters')}
        </button>
      ) : null}
    </div>
  )
}
