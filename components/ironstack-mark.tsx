/** Static IronStack dumbbell mark — same plate-stack silhouette as HubPreloader. */
export function IronStackMark({
  className = '',
  size = 'md',
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const box =
    size === 'sm'
      ? 'h-6 w-9'
      : size === 'lg'
        ? 'h-10 w-[4.5rem]'
        : 'h-8 w-14'

  const plate = size === 'sm' ? 'gap-px' : 'gap-0.5'
  const bar =
    size === 'sm'
      ? 'mx-px h-1 w-5'
      : size === 'lg'
        ? 'mx-0.5 h-1.5 w-10'
        : 'mx-0.5 h-1 w-8'
  const plates =
    size === 'sm'
      ? [
          'h-2.5 w-0.5',
          'h-3.5 w-0.5',
          'h-5 w-[3px]',
        ]
      : size === 'lg'
        ? ['h-3.5 w-1', 'h-5 w-1.5', 'h-7 w-1.5']
        : ['h-3 w-1', 'h-4 w-1', 'h-6 w-1']

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${box} overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <span className={`inline-flex items-center ${plate}`}>
        <span className={`flex items-center ${plate}`}>
          <span className={`rounded-sm bg-gold/45 ${plates[0]}`} />
          <span className={`rounded-sm bg-gold/70 ${plates[1]}`} />
          <span className={`rounded-sm bg-gold ${plates[2]}`} />
        </span>
        <span
          className={`rounded-full bg-gradient-to-r from-silver-dim via-silver to-silver-dim ${bar}`}
        />
        <span className={`flex items-center ${plate}`}>
          <span className={`rounded-sm bg-gold ${plates[2]}`} />
          <span className={`rounded-sm bg-gold/70 ${plates[1]}`} />
          <span className={`rounded-sm bg-gold/45 ${plates[0]}`} />
        </span>
      </span>
    </span>
  )
}
