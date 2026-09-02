import { OfflineFallback } from '@/components/offline-fallback'

export const metadata = {
  title: 'Offline — IronStack',
  description: 'You are offline. Cached splits and session logging still work.',
}

export default function OfflinePage() {
  return <OfflineFallback />
}
