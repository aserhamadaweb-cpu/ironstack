import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

export type AppShortcut = {
  href: string
  label: string
  icon: LucideIcon
  /** Optional tour spotlight anchor on the icon tile only. */
  tourIcon?: string
}

export function AppShortcutGrid({ items }: { items: AppShortcut[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-3">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch={false}
          className="is-row flex min-h-16 items-center gap-3 px-3.5 py-3 text-foreground active:opacity-80"
        >
          <span
            {...(item.tourIcon
              ? {
                  'data-tour': item.tourIcon,
                  'data-tour-spotlight': 'icon',
                }
              : {})}
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-background text-foreground"
          >
            <item.icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 text-sm font-semibold leading-snug break-words [overflow-wrap:anywhere]">
            {item.label}
          </span>
        </Link>
      ))}
    </div>
  )
}
