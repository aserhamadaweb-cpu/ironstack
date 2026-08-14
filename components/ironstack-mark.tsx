/** Static IronStack dumbbell mark — same plate-stack silhouette as HubPreloader. */
export function IronStackMark({
  className = '',
  size = 'md',
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const scale =
    size === 'sm' ? 'scale-[0.55]' : size === 'lg' ? 'scale-100' : 'scale-[0.72]'

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      <span className={`inline-flex items-center ${scale}`}>
        <span className="flex items-center gap-0.5">
          <span className="h-3.5 w-1 rounded-sm bg-gold/45" />
          <span className="h-5 w-1.5 rounded-sm bg-gold/70" />
          <span className="h-7 w-1.5 rounded-sm bg-gold" />
        </span>
        <span className="mx-0.5 h-1 w-10 rounded-full bg-gradient-to-r from-silver-dim via-silver to-silver-dim" />
        <span className="flex items-center gap-0.5">
          <span className="h-7 w-1.5 rounded-sm bg-gold" />
          <span className="h-5 w-1.5 rounded-sm bg-gold/70" />
          <span className="h-3.5 w-1 rounded-sm bg-gold/45" />
        </span>
      </span>
    </span>
  )
}
