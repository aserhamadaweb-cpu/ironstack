import Image from 'next/image'
import Link from 'next/link'
import { Crown, Medal, ShieldCheck } from 'lucide-react'

const perks = [
  {
    icon: Crown,
    title: 'VIP Membership Tiers',
    description: 'Gold-badge status reserved for verified elite performers.',
  },
  {
    icon: Medal,
    title: 'PR Milestone Honors',
    description: 'Gold-marked achievements for every record broken.',
  },
  {
    icon: ShieldCheck,
    title: 'Vetted Membership',
    description: 'Every member verified. No noise. Only signal.',
  },
]

export function IronCircle() {
  return (
    <section id="member-portal" className="mx-auto max-w-6xl px-6 pb-24 md:pb-32">
      <div className="glass-card sheen-border grid overflow-hidden rounded-3xl md:grid-cols-2">
        <div className="relative min-h-72 md:min-h-full">
          <Image
            src="/images/iron-circle.png"
            alt="The Iron Circle private members lounge with gold accent lighting"
            fill
            className="object-cover"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent to-background/70"
            aria-hidden="true"
          />
        </div>

        <div className="flex flex-col gap-8 p-8 md:p-12">
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium tracking-[0.4em] text-gold">
              THE IRON CIRCLE
            </p>
            <h2 className="font-heading text-metallic text-balance text-3xl font-bold md:text-4xl">
              MEMBERSHIP IS EARNED.
            </h2>
          </div>

          <ul className="flex flex-col gap-6">
            {perks.map((perk) => (
              <li key={perk.title} className="flex items-start gap-4">
                <perk.icon
                  className="mt-0.5 size-5 shrink-0 text-gold"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-heading text-sm font-semibold tracking-wide text-foreground">
                    {perk.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {perk.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <Link
            href="#"
            className="cta-pulse w-fit rounded-full bg-primary px-8 py-3.5 text-xs font-bold tracking-[0.25em] text-primary-foreground transition-transform hover:scale-105"
          >
            REQUEST ACCESS
          </Link>
        </div>
      </div>
    </section>
  )
}
