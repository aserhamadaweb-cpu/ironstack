import { PageLoading } from '@/components/page-states'

/** Visible while a dashboard segment is streaming — prevents blank flash on slow nets. */
export default function DashboardLoading() {
  return <PageLoading label="Loading…" />
}
