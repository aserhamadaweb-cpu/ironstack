import { markNavigationIntent } from '@/lib/navigation-intent'

/**
 * Next calls this for every client navigation it dispatches: <Link> taps,
 * router.push / router.replace, and back/forward traversal. Routing them all
 * through markNavigationIntent is what lets NavigationProgress cover every
 * trigger without each call site having to opt in.
 */
export function onRouterTransitionStart(
  url: string,
  navigationType: 'push' | 'replace' | 'traverse',
) {
  markNavigationIntent(url, navigationType)
}
