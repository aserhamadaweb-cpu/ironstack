'use client'

type StreakFlameProps = {
  /** Animated + colored when true; static desaturated gray when false. */
  active?: boolean
  className?: string
}

/**
 * Smooth vector streak flame (Snapchat-style): three layered teardrop paths
 * with a gentle CSS pulse/wobble and soft glow. No canvas, no dependencies.
 */
export function StreakFlame({ active = true, className = '' }: StreakFlameProps) {
  return (
    <span
      className={`streak-flame inline-flex items-center justify-center ${
        active ? 'streak-flame--active' : 'streak-flame--inactive'
      } ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-full w-full">
        {/* Outer flame */}
        <path
          className="streak-flame-outer"
          d="M12 1.8c.9 3-0.4 4.6 1.9 7.4 1.8 2.2 5.1 3.6 5.1 7.3A7 7 0 0 1 5 16.5c0-2.6 1.4-4 2.6-5.3.8-.9 1.5-1.9 1.4-3.4 1.7.6 2.6 1.9 2.7 3.6C13.4 9.6 13 5 12 1.8Z"
          fill={active ? '#FF7A1A' : 'var(--muted-foreground)'}
        />
        {/* Mid flame */}
        <path
          className="streak-flame-mid"
          d="M12.1 9.6c1.5 1.9 4 3.2 4 5.9a4.1 4.1 0 0 1-8.2 0c0-1.6.9-2.6 1.8-3.6.5-.6 1-1.2 1.2-2 .7.5 1.1 1.2 1.2 2.1.4-.8.3-1.6 0-2.4Z"
          fill={active ? '#FFB020' : 'var(--border)'}
        />
        {/* Hot core */}
        <path
          className="streak-flame-core"
          d="M12 14.2c.7.9 1.7 1.6 1.7 2.8a1.9 1.9 0 0 1-3.8 0c0-1.2 1-1.9 1.6-2.8h.5Z"
          fill={active ? '#FFF3C4' : 'var(--muted)'}
        />
      </svg>
    </span>
  )
}
