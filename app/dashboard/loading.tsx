import { RouteLoadingSignal } from '@/components/route-loading-signal'

/** Content-slot skeleton — layout keeps the tab bar visible during streaming. */
export default function DashboardLoading() {
  return (
    <>
      <RouteLoadingSignal />
      <div
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10"
        aria-busy="true"
        aria-label="Loading"
      >
        <div className="h-8 w-48 animate-pulse rounded-lg bg-silver/15" />
        <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded bg-silver/10" />
        <div className="mt-8 space-y-3">
          <div className="h-28 animate-pulse rounded-2xl bg-silver/10" />
          <div className="h-28 animate-pulse rounded-2xl bg-silver/10" />
          <div className="h-28 animate-pulse rounded-2xl bg-silver/10" />
        </div>
      </div>
    </>
  )
}
