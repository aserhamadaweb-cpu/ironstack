'use client'

/** Compact CSS flame for streak badges — respects prefers-reduced-motion via globals. */
export function RealisticFire({ className = '' }: { className?: string }) {
  return (
    <span
      className={`streak-fire relative inline-block shrink-0 ${className}`}
      aria-hidden="true"
    >
      <span className="streak-fire-core" />
      <span className="streak-fire-mid" />
      <span className="streak-fire-outer" />
      <span className="streak-fire-glow" />
    </span>
  )
}
