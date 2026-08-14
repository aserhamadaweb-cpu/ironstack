import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

export type AppShortcut = {
  href: string
  label: string
  icon: LucideIcon
}

export function AppShortcutGrid({ items }: { items: AppShortcut[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          prefetch
          className="is-row flex min-h-14 items-center gap-3 px-3.5 py-3 text-sm font-semibold text-foreground active:opacity-80"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold/25 bg-gold/10 text-gold">
            <item.icon className="size-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 truncate">{item.label}</span>
        </Link>
      ))}
    </div>
  )
}
