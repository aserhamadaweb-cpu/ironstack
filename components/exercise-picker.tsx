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
import {
  EXERCISE_MUSCLE_FILTERS,
  EXERCISE_SORT_OPTIONS,
  collectCategories,
  filterAndSortExercises,
  formatCategoryLabel,
  type ExerciseCatalogItem,
  type ExerciseSort,
} from '@/lib/exercise-catalog'

const SEARCH_DEBOUNCE_MS = 180
const LIST_ROW_HEIGHT = 56
const LIST_OVERSCAN = 8

type ExercisePickerProps = {
  items: ExerciseCatalogItem[]
  /** Currently selected id (single-select / challenges). */
  value?: string | null
  onSelect: (item: ExerciseCatalogItem) => void
  /** list = compact rows; grid = card tiles (split builder). */
  variant?: 'list' | 'grid'
  /** Optional custom row/card renderer. */
  renderItem?: (item: ExerciseCatalogItem, selected: boolean) => ReactNode
  className?: string
  listClassName?: string
  /** Max height for the scrollable list region. */
  maxHeightClassName?: string
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
  variant = 'list',
  renderItem,
  className = '',
  listClassName = '',
  maxHeightClassName = 'max-h-[min(28rem,55svh)]',
}: ExercisePickerProps) {
  const t = useTranslations('exercisePicker')
  const [search, setSearch] = useState('')
  const [muscles, setMuscles] = useState<string[]>([])
  const [category, setCategory] = useState<string | null>(null)
  const [sort, setSort] = useState<ExerciseSort>('name-asc')
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS)

  const categories = useMemo(() => collectCategories(items), [items])

  const filtered = useMemo(
    () =>
      filterAndSortExercises(items, {
        search: debouncedSearch,
        muscles,
        category,
        sort,
      }),
    [items, debouncedSearch, muscles, category, sort],
  )

  const toggleMuscle = (muscle: string) => {
    setMuscles((current) =>
      current.includes(muscle)
        ? current.filter((m) => m !== muscle)
        : [...current, muscle],
    )
  }

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="relative shrink-0">
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
            className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
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
            className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background/70 px-3 text-sm text-foreground outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
          >
            {EXERCISE_SORT_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="-mx-1 flex shrink-0 gap-1.5 overflow-x-auto px-1 pb-1">
        {EXERCISE_MUSCLE_FILTERS.map((muscle) => {
          const active = muscles.includes(muscle)
          return (
            <button
              key={muscle}
              type="button"
              onClick={() => toggleMuscle(muscle)}
              aria-pressed={active}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-[0.12em] transition-all ${
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
                      onClick={() => onSelect(item)}
                      className="w-full text-start"
                    >
                      {renderItem(item, selected)}
                    </button>
                  ) : (
                    <DefaultGridCard
                      item={item}
                      selected={selected}
                      onSelect={() => onSelect(item)}
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
          onSelect={onSelect}
          renderItem={renderItem}
          className={`min-h-0 flex-1 ${maxHeightClassName} ${listClassName}`}
        />
      )}
    </div>
  )
}

function DefaultGridCard({
  item,
  selected,
  onSelect,
}: {
  item: ExerciseCatalogItem
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full flex-col rounded-2xl border p-3 text-start transition ${
        selected
          ? 'border-gold/60 bg-gold/10'
          : 'border-silver/10 bg-card/50 hover:border-gold/35'
      }`}
    >
      <span className="line-clamp-2 text-sm font-semibold text-foreground">
        {item.name}
      </span>
      <span className="mt-2 text-[10px] tracking-[0.1em] text-muted-foreground">
        {item.muscleGroup ?? '—'}
        {item.category ? ` · ${formatCategoryLabel(item.category)}` : ''}
      </span>
    </button>
  )
}

function VirtualExerciseList({
  items,
  value,
  onSelect,
  renderItem,
  className,
}: {
  items: ExerciseCatalogItem[]
  value: string | null
  onSelect: (item: ExerciseCatalogItem) => void
  renderItem?: (item: ExerciseCatalogItem, selected: boolean) => ReactNode
  className: string
}) {
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

  const totalHeight = items.length * LIST_ROW_HEIGHT
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / LIST_ROW_HEIGHT) - LIST_OVERSCAN,
  )
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + viewportHeight) / LIST_ROW_HEIGHT) + LIST_OVERSCAN,
  )
  const visible = items.slice(startIndex, endIndex)

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      className={`overflow-y-auto rounded-xl border border-silver/10 bg-card/30 ${className}`}
      role="listbox"
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visible.map((item, i) => {
          const index = startIndex + i
          const selected = item.id === value
          return (
            <div
              key={item.id}
              role="option"
              aria-selected={selected}
              style={{
                position: 'absolute',
                top: index * LIST_ROW_HEIGHT,
                left: 0,
                right: 0,
                height: LIST_ROW_HEIGHT,
              }}
            >
              {renderItem ? (
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className="h-full w-full text-start"
                >
                  {renderItem(item, selected)}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className={`flex h-full w-full items-center justify-between gap-3 border-b border-silver/10 px-3 text-start transition ${
                    selected
                      ? 'bg-gold/10 text-foreground'
                      : 'hover:bg-foreground/[0.03]'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {item.name}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {[item.muscleGroup, item.category && formatCategoryLabel(item.category)]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </span>
                  </span>
                  {selected && (
                    <span className="shrink-0 text-[10px] font-bold tracking-[0.14em] text-gold">
                      ✓
                    </span>
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
