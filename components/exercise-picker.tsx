'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type UIEvent,
} from 'react'
import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ExerciseThumb } from '@/components/exercise-thumb'
import {
  EXERCISE_MUSCLE_FILTERS,
  EXERCISE_SORT_OPTIONS,
  collectCategories,
  collectEquipment,
  collectTargets,
  filterAndSortExercises,
  formatCategoryLabel,
  type ExerciseCatalogItem,
  type ExerciseSort,
} from '@/lib/exercise-catalog'
import { isNoEquipment } from '@/lib/exercises/home-workouts'

const SEARCH_DEBOUNCE_MS = 180
const LIST_ROW_HEIGHT = 72
const LIST_ROW_HEIGHT_WITH_ADD = 96
const LIST_OVERSCAN = 8

type ExercisePickerProps = {
  items: ExerciseCatalogItem[]
  /** Currently selected id (single-select / challenges). */
  value?: string | null
  onSelect: (item: ExerciseCatalogItem) => void
  /** When set, shows an Add action that does not open details. */
  onAdd?: (item: ExerciseCatalogItem) => void
  /** When set, the row opens details instead of selecting/adding. */
  onOpenDetails?: (item: ExerciseCatalogItem) => void
  recentlyAddedId?: string | null
  /** list = compact rows; grid = card tiles (split builder). */
  variant?: 'list' | 'grid'
  /** Optional custom row/card renderer. */
  renderItem?: (item: ExerciseCatalogItem, selected: boolean) => ReactNode
  className?: string
  listClassName?: string
  /** Max height for the scrollable list region. */
  maxHeightClassName?: string
  /** Home Workouts: distinguish no-equipment from kit that you need at home. */
  homeMode?: boolean
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

export function ExercisePicker({
  items,
  value = null,
  onSelect,
  onAdd,
  onOpenDetails,
  recentlyAddedId = null,
  variant = 'list',
  renderItem,
  className = '',
  listClassName = '',
  maxHeightClassName = 'max-h-[min(28rem,55svh)]',
  homeMode = false,
}: ExercisePickerProps) {
  const t = useTranslations('exercisePicker')
  const [search, setSearch] = useState('')
  const [muscles, setMuscles] = useState<string[]>([])
  const [category, setCategory] = useState<string | null>(null)
  const [equipment, setEquipment] = useState<string | null>(null)
  const [target, setTarget] = useState<string | null>(null)
  const [sort, setSort] = useState<ExerciseSort>('name-asc')
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)

  const categories = useMemo(() => collectCategories(items), [items])
  const equipmentOptions = useMemo(() => collectEquipment(items), [items])
  const targetOptions = useMemo(() => collectTargets(items), [items])

  const filtered = useMemo(
    () =>
      filterAndSortExercises(items, {
        search: debouncedSearch,
        muscles,
        category,
        equipment,
        target,
        sort,
      }),
    [items, debouncedSearch, muscles, category, equipment, target, sort],
  )

  const toggleMuscle = (muscle: string) => {
    setMuscles((current) =>
      current.includes(muscle)
        ? current.filter((m) => m !== muscle)
        : [...current, muscle],
    )
  }

  const handleRowActivate = (item: ExerciseCatalogItem) => {
    if (onOpenDetails) {
      onOpenDetails(item)
      return
    }
    onSelect(item)
  }

  const rowHeight = onAdd ? LIST_ROW_HEIGHT_WITH_ADD : LIST_ROW_HEIGHT

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="relative shrink-0" data-tour="exercises-search">
        <Search
          className="pointer-events-none absolute top-1/2 start-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchLabel')}
          className="h-11 w-full rounded-xl border border-border bg-card/90 pe-4 ps-10 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-gold focus:ring-2 focus:ring-gold/20"
        />
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
            {t('category')}
          </span>
          <select
            value={category ?? ''}
            onChange={(e) => setCategory(e.target.value || null)}
            className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          >
            <option value="">{t('allCategories')}</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {formatCategoryLabel(cat)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
            {t('sort')}
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ExerciseSort)}
            className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          >
            {EXERCISE_SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(equipmentOptions.length > 0 || targetOptions.length > 0) && (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          {equipmentOptions.length > 0 && (
            <label className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
                {t('equipment')}
              </span>
              <select
                value={equipment ?? ''}
                onChange={(e) => setEquipment(e.target.value || null)}
                className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                <option value="">{t('allEquipment')}</option>
                {equipmentOptions.map((eq) => (
                  <option key={eq} value={eq}>
                    {formatCategoryLabel(eq)}
                  </option>
                ))}
              </select>
            </label>
          )}
          {targetOptions.length > 0 && (
            <label className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0 text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
                {t('target')}
              </span>
              <select
                value={target ?? ''}
                onChange={(e) => setTarget(e.target.value || null)}
                className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
              >
                <option value="">{t('allTargets')}</option>
                {targetOptions.map((value) => (
                  <option key={value} value={value}>
                    {formatCategoryLabel(value)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      <div className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-1">
        {EXERCISE_MUSCLE_FILTERS.map((muscle) => {
          const active = muscles.includes(muscle)
          return (
            <button
              key={muscle}
              type="button"
              onClick={() => toggleMuscle(muscle)}
              aria-pressed={active}
              className={`min-h-9 shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
                active
                  ? 'border-gold/60 bg-gold/15 text-gold'
                  : 'border-silver/15 bg-card/60 text-muted-foreground hover:border-gold/30 hover:text-foreground'
              }`}
            >
              {muscle}
            </button>
          )
        })}
      </div>

      <div className="flex min-h-0 flex-1 flex-col" data-tour="exercises-grid">
      <p className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
        {t('resultCount', { count: filtered.length })}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-silver/20 px-4 py-12 text-center">
          <p className="text-sm font-semibold text-foreground">
            {t('emptyTitle')}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t('emptyBody')}</p>
        </div>
      ) : variant === 'grid' ? (
        <div
          className={`min-h-0 flex-1 overflow-y-auto ${maxHeightClassName} ${listClassName}`}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filtered.map((item) => {
              const selected = item.id === value
              return (
                <div
                  key={item.id}
                  className="[content-visibility:auto] [contain-intrinsic-size:180px]"
                >
                  {renderItem ? (
                    <button
                      type="button"
                      onClick={() => handleRowActivate(item)}
                      className="w-full text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                    >
                      {renderItem(item, selected)}
                    </button>
                  ) : (
                    <DefaultGridCard
                      item={item}
                      selected={selected}
                      recentlyAdded={recentlyAddedId === item.id}
                      homeMode={homeMode}
                      onActivate={() => handleRowActivate(item)}
                      onAdd={onAdd ? () => onAdd(item) : undefined}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <VirtualExerciseList
          items={filtered}
          value={value}
          recentlyAddedId={recentlyAddedId}
          rowHeight={rowHeight}
          onActivate={handleRowActivate}
          onAdd={onAdd}
          renderItem={renderItem}
          homeMode={homeMode}
          className={`min-h-0 flex-1 ${maxHeightClassName} ${listClassName}`}
        />
      )}
      </div>
    </div>
  )
}

function EquipmentBadge({
  equipment,
  homeMode,
}: {
  equipment?: string | null
  homeMode: boolean
}) {
  const t = useTranslations('homeWorkouts')
  if (!equipment) return null
  const none = isNoEquipment(equipment)
  if (homeMode && none) {
    return (
      <span className="rounded-full border border-gold/40 bg-gold/15 px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] text-gold">
        {t('noEquipmentNeeded')}
      </span>
    )
  }
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] ${
        none
          ? 'border-gold/35 bg-gold/10 text-gold'
          : 'border-silver/25 bg-background/70 text-muted-foreground'
      }`}
    >
      {homeMode
        ? t('needsEquipment', { equipment: formatCategoryLabel(equipment) })
        : formatCategoryLabel(equipment)}
    </span>
  )
}

function DefaultGridCard({
  item,
  selected,
  recentlyAdded,
  homeMode,
  onActivate,
  onAdd,
}: {
  item: ExerciseCatalogItem
  selected: boolean
  recentlyAdded: boolean
  homeMode: boolean
  onActivate: () => void
  onAdd?: () => void
}) {
  const t = useTranslations('exercisePicker')
  return (
    <div
      className={`flex h-full flex-col rounded-2xl border p-3 text-start transition ${
        selected || recentlyAdded
          ? 'border-gold/60 bg-gold/10'
          : 'border-silver/10 bg-card/50'
      }`}
    >
      <button
        type="button"
        onClick={onActivate}
        className="flex flex-1 flex-col text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
        aria-label={t('viewDetailsNamed', { name: item.name })}
      >
        <span className="line-clamp-2 text-sm font-semibold text-foreground">
          {item.name}
        </span>
        <span className="mt-2 text-[10px] tracking-[0.1em] text-muted-foreground">
          {item.muscleGroup ?? '—'}
          {item.category ? ` · ${formatCategoryLabel(item.category)}` : ''}
        </span>
        <span className="mt-2">
          <EquipmentBadge equipment={item.equipment} homeMode={homeMode} />
        </span>
      </button>
      {onAdd ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onAdd()
          }}
          className={`mt-3 flex h-11 items-center justify-center rounded-full text-xs font-bold tracking-[0.12em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 ${
            recentlyAdded
              ? 'border border-gold/50 bg-gold/15 text-gold'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {recentlyAdded ? t('added') : t('addToSplit')}
        </button>
      ) : null}
    </div>
  )
}

function VirtualExerciseList({
  items,
  value,
  recentlyAddedId,
  rowHeight,
  onActivate,
  onAdd,
  renderItem,
  homeMode,
  className,
}: {
  items: ExerciseCatalogItem[]
  value: string | null
  recentlyAddedId: string | null
  rowHeight: number
  onActivate: (item: ExerciseCatalogItem) => void
  onAdd?: (item: ExerciseCatalogItem) => void
  renderItem?: (item: ExerciseCatalogItem, selected: boolean) => ReactNode
  homeMode: boolean
  className: string
}) {
  const t = useTranslations('exercisePicker')
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(320)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const update = () => setViewportHeight(el.clientHeight || 320)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const onScroll = useCallback((e: UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }, [])

  const totalHeight = items.length * rowHeight
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / rowHeight) - LIST_OVERSCAN,
  )
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + LIST_OVERSCAN,
  )
  const visible = items.slice(startIndex, endIndex)

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      className={`min-h-[16rem] overflow-y-auto rounded-xl border border-silver/10 bg-card/30 ${className}`}
      role="listbox"
      aria-label={t('searchLabel')}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visible.map((item, i) => {
          const index = startIndex + i
          const selected = item.id === value
          const recentlyAdded = recentlyAddedId === item.id
          return (
            <div
              key={item.id}
              role="option"
              aria-selected={selected}
              style={{
                position: 'absolute',
                top: index * rowHeight,
                insetInlineStart: 0,
                width: '100%',
                height: rowHeight,
              }}
            >
              {renderItem ? (
                <button
                  type="button"
                  onClick={() => onActivate(item)}
                  className="h-full w-full text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                >
                  {renderItem(item, selected)}
                </button>
              ) : (
                <div
                  className={`flex h-full w-full items-center gap-2 border-b border-silver/10 px-2 sm:gap-3 sm:px-3 ${
                    selected || recentlyAdded ? 'bg-gold/10 text-foreground' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onActivate(item)}
                    className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-xl px-1 text-start transition hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                    aria-label={t('viewDetailsNamed', { name: item.name })}
                  >
                    <ExerciseThumb
                      muscle={item.muscleGroup ?? 'Core'}
                      image={item.imageUrl}
                      name={item.name}
                      className="size-11"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {item.name}
                      </span>
                      <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1.5">
                        <EquipmentBadge
                          equipment={item.equipment}
                          homeMode={homeMode}
                        />
                        {item.muscleGroup ? (
                          <span className="truncate text-[11px] text-muted-foreground">
                            {item.muscleGroup}
                            {item.category
                              ? ` · ${formatCategoryLabel(item.category)}`
                              : ''}
                          </span>
                        ) : null}
                      </span>
                      {onAdd ? (
                        <span className="mt-0.5 block text-[10px] font-semibold tracking-[0.1em] text-gold/80">
                          {t('tapForDetails')}
                        </span>
                      ) : null}
                    </span>
                    {selected && !onAdd && (
                      <span className="shrink-0 text-[10px] font-bold tracking-[0.14em] text-gold">
                        {t('selected')}
                      </span>
                    )}
                  </button>
                  {onAdd ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        onAdd(item)
                      }}
                      className={`inline-flex h-11 shrink-0 items-center justify-center rounded-full px-3 text-[11px] font-bold tracking-[0.1em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 sm:px-4 ${
                        recentlyAdded
                          ? 'border border-gold/50 bg-gold/15 text-gold'
                          : 'bg-primary text-primary-foreground hover:bg-primary/90'
                      }`}
                    >
                      {recentlyAdded ? t('added') : t('addToSplit')}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
