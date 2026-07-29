import { redirect } from 'next/navigation'

/** Send legacy /dashboard visits to the new HOME landing hub. */
export default function DashboardPage() {
  redirect('/dashboard/home')
}
