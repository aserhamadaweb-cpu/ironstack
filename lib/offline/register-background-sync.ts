/** One-shot tag. The service worker uploads queued sessions when the network returns. */
export const SESSION_BACKGROUND_SYNC_TAG = 'ironstack-session-sync'

type SyncCapableRegistration = ServiceWorkerRegistration & {
  sync?: { register: (tag: string) => Promise<void> }
}

/**
 * Ask the browser to run the session upload later, even if IronStack is closed.
 * Chromium honors this. Browsers without Background Sync ignore it.
 */
export function registerSessionBackgroundSync(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  void navigator.serviceWorker.ready
    .then((registration) => {
      const sync = (registration as SyncCapableRegistration).sync
      if (!sync) return
      return sync.register(SESSION_BACKGROUND_SYNC_TAG)
    })
    .catch(() => {
      /* Unsupported, or the worker is not ready yet. Opening the app still syncs. */
    })
}
