'use client'

import { Users } from 'lucide-react'
import { FeaturePlaceholder } from '@/components/feature-placeholder'

export function CommunityCircleClient() {
  return (
    <FeaturePlaceholder
      eyebrow="COMMUNITY CIRCLE"
      title="Train Together, Grow Together"
      description="Share milestones, swap tips, and cheer on lifters who love training as much as you do. The Circle opens its doors soon."
      icon={Users}
      accent="gold"
    />
  )
}
