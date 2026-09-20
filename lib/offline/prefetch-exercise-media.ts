import { gifUrlFromImageUrl } from '@/lib/exercises/paths'
import type { CachedSplit } from '@/lib/offline/db'
import { offlineLog, offlineWarn } from '@/lib/offline/debug'
import type { SplitDetail } from '@/lib/split-data'

const MAX_PREFETCH = 500
const CONCURRENCY = 4
/** Must match `cacheName` for GIFs / thumbs in next.config.mjs */
const GIF_CACHE = 'exercise-gifs'
const THUMB_CACHE = 'exercise-thumbs'

export type MediaPrefetchProgress = {
  done: number
  total: number
  percent: number
}

export type MediaPrefetchResult = {
  total: number
  warmed: number
  missing: number
  failed: number
  ok: boolean
  quotaExceeded: boolean
  /** Paths that must stay in Cache Storage for a complete offline download. */
  requiredMedia: string[]
}

function isLocalExerciseMedia(url: string): boolean {
  return (
    url.startsWith('/exercises/gifs/') || url.startsWith('/exercises/images/')
  )
}

function cacheNameForUrl(url: string): string {
  return url.startsWith('/exercises/gifs/') ? GIF_CACHE : THUMB_CACHE
}

function isQuotaError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const name = 'name' in err ? String((err as { name?: string }).name) : ''
  const message =
    err instanceof Error ? err.message : String((err as { message?: string }).message ?? '')
  return (
    name === 'QuotaExceededError' ||
    /quota|storage|disk full|not enough space/i.test(message)
  )
}

/** Absolute same-origin URL — Cache/SW matching is reliable with full hrefs. */
export function absoluteMediaUrl(url: string): string {
  if (typeof window === 'undefined') return url
  try {
    return new URL(url, window.location.origin).href
  } catch {
    return url
  }
}

/** Collect local GIF (+ optional still) URLs from cached split details. */
export function collectExerciseMediaUrls(
  splits: Array<Pick<CachedSplit, 'detail'> | { detail: SplitDetail }>,
): string[] {
  const urls = new Set<string>()
  for (const split of splits) {
    for (const day of split.detail.schedule ?? []) {
      for (const exercise of day.exercises ?? []) {
        const gif =
          exercise.gif?.trim() || gifUrlFromImageUrl(exercise.image) || null
        if (gif && isLocalExerciseMedia(gif)) urls.add(gif)
        const image = exercise.image?.trim()
        if (image && isLocalExerciseMedia(image)) urls.add(image)
      }
    }
  }
  return [...urls]
}

async function matchCached(
  cache: Cache,
  requestUrl: string,
  relative: string,
): Promise<Response | undefined> {
  return (
    (await cache.match(requestUrl)) ||
    (await cache.match(relative)) ||
    (await cache.match(new Request(requestUrl))) ||
    undefined
  )
}

export async function isExerciseMediaCached(url: string): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (!isLocalExerciseMedia(url)) return true

  const absolute = absoluteMediaUrl(url)

  // Match warmUrl: when Cache Storage is unavailable, treat HTTP cache hits as ready.
  if (typeof caches === 'undefined') {
    try {
      const res = await fetch(absolute, {
        credentials: 'same-origin',
        cache: 'force-cache',
      })
      return res.ok && res.status !== 404
    } catch {
      return false
    }
  }

  const name = cacheNameForUrl(url)
  try {
    const cache = await caches.open(name)
    const hit = await matchCached(cache, absolute, url)
    return Boolean(hit?.ok)
  } catch {
    return false
  }
}

export async function countCachedExerciseMedia(urls: string[]): Promise<{
  total: number
  cached: number
}> {
  const unique = [...new Set(urls)].filter(isLocalExerciseMedia)
  let cached = 0
  for (const url of unique) {
    if (await isExerciseMediaCached(url)) cached += 1
  }
  return { total: unique.length, cached }
}

async function warmUrl(
  url: string,
): Promise<'ok' | 'missing' | 'error' | 'quota'> {
  const requestUrl = absoluteMediaUrl(url)

  if (typeof caches === 'undefined') {
    try {
      const res = await fetch(requestUrl, {
        credentials: 'same-origin',
        cache: 'force-cache',
      })
      if (res.status === 404) return 'missing'
      return res.ok ? 'ok' : 'error'
    } catch (err) {
      return isQuotaError(err) ? 'quota' : 'error'
    }
  }

  try {
    const name = cacheNameForUrl(url)
    const cache = await caches.open(name)
    const hit = await matchCached(cache, requestUrl, url)
    if (hit?.ok) return 'ok'

    const res = await fetch(requestUrl, { credentials: 'same-origin' })
    if (res.status === 404) return 'missing'
    if (!res.ok) {
      offlineWarn('media-prefetch-http', { url: requestUrl, status: res.status })
      return 'error'
    }
    await cache.put(new Request(requestUrl), res.clone())
    return 'ok'
  } catch (err) {
    offlineWarn('media-prefetch-error', {
      url,
      error: err instanceof Error ? err.message : String(err),
    })
    return isQuotaError(err) ? 'quota' : 'error'
  }
}

/**
 * Warm Cache Storage for exercise media while online.
 * Strict: any network/storage failure fails the batch (404s are OK — nothing to store).
 */
export async function prefetchExerciseMedia(
  urls: string[],
  options?: {
    onProgress?: (progress: MediaPrefetchProgress) => void
    /** When true, fail the batch if any URL errors (not 404). Default true. */
    strict?: boolean
  },
): Promise<MediaPrefetchResult> {
  const strict = options?.strict !== false
  const empty: MediaPrefetchResult = {
    total: 0,
    warmed: 0,
    missing: 0,
    failed: 0,
    ok: true,
    quotaExceeded: false,
    requiredMedia: [],
  }

  if (typeof window === 'undefined') return empty
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ...empty, ok: false, failed: 1 }
  }

  const allLocal = [...new Set(urls)].filter(isLocalExerciseMedia)
  if (allLocal.length > MAX_PREFETCH) {
    offlineWarn('media-prefetch-too-large', {
      total: allLocal.length,
      max: MAX_PREFETCH,
    })
    return {
      ...empty,
      total: allLocal.length,
      failed: allLocal.length - MAX_PREFETCH,
      ok: false,
      requiredMedia: [],
    }
  }
  const unique = allLocal

  if (unique.length === 0) {
    offlineWarn('media-prefetch-empty', {
      reason: 'no-local-gif-or-image-urls-on-split',
    })
    options?.onProgress?.({ done: 1, total: 1, percent: 100 })
    return empty
  }

  try {
    await navigator.serviceWorker?.ready
  } catch {
    /* optional */
  }

  let warmed = 0
  let missing = 0
  let failed = 0
  let quotaExceeded = false
  const requiredMedia: string[] = []
  let index = 0
  let finished = 0

  const report = () => {
    options?.onProgress?.({
      done: finished,
      total: unique.length,
      percent: Math.round((finished / unique.length) * 100),
    })
  }
  report()

  async function worker() {
    while (index < unique.length) {
      const url = unique[index]
      index += 1
      const result = await warmUrl(url)
      if (result === 'ok') {
        warmed += 1
        requiredMedia.push(url)
      } else if (result === 'missing') missing += 1
      else if (result === 'quota') {
        quotaExceeded = true
        failed += 1
      } else failed += 1
      finished += 1
      report()
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, unique.length) }, () =>
      worker(),
    ),
  )

  const ok = !quotaExceeded && (!strict || failed === 0)
  offlineLog('media-prefetch-done', {
    requested: unique.length,
    warmed,
    missing,
    failed,
    ok,
    quotaExceeded,
  })

  return {
    total: unique.length,
    warmed,
    missing,
    failed,
    ok,
    quotaExceeded,
    requiredMedia: ok ? requiredMedia : [],
  }
}

export async function prefetchMediaForSplits(
  splits: Array<Pick<CachedSplit, 'detail'> | { detail: SplitDetail }>,
  options?: {
    onProgress?: (progress: MediaPrefetchProgress) => void
    strict?: boolean
  },
): Promise<MediaPrefetchResult> {
  return prefetchExerciseMedia(collectExerciseMediaUrls(splits), options)
}

/**
 * Resolve a same-origin exercise media URL from Cache Storage as a blob URL.
 * Used when the service worker isn't controlling the page (or CacheFirst miss)
 * but Save-for-Offline already warmed `exercise-gifs` / `exercise-thumbs`.
 */
export async function resolveExerciseMediaFromCache(
  url: string,
): Promise<string | null> {
  if (typeof window === 'undefined' || typeof caches === 'undefined') return null
  if (!url.trim()) return null

  const absolute = absoluteMediaUrl(url)
  const names = url.includes('/gifs/')
    ? [GIF_CACHE, THUMB_CACHE]
    : [THUMB_CACHE, GIF_CACHE]

  for (const name of names) {
    try {
      const cache = await caches.open(name)
      const hit = await matchCached(cache, absolute, url)
      if (!hit?.ok) continue
      const blob = await hit.blob()
      if (!blob.size) continue
      return URL.createObjectURL(blob)
    } catch {
      /* try next cache */
    }
  }
  return null
}
