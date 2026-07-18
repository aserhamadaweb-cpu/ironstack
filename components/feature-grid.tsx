import { BrainCircuit, Trophy, Users } from 'lucide-react'

const features = [
  {
    id: 'ai-concierge',
    icon: BrainCircuit,
    title: 'AI Tactical Concierge',
    description:
      'A custom coaching intelligence engineered around your physiology. Precision programming, recovery protocols, and real-time tactical adjustments — on demand.',
  },
  {
    id: 'pr-arena',
    icon: Trophy,
    title: 'Elite Performance OS',
    description:
      'Every personal record tracked, verified, and immortalized. A performance operating system built to quantify dominance across every lift.',
    gold: true,
  },
  {
    id: 'iron-circle',
    icon: Users,
    title: 'The VIP Community Circle',
    description:
      'A private social feed for the top percentile. Share milestones, exchange protocols, and train alongside the most disciplined athletes in the world.',
  },
]

export function FeatureGrid() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
      <div className="mb-16 flex flex-col items-center gap-4 text-center">
        <p className="text-xs font-medium tracking-[0.4em] text-primary">
          THE PLATFORM
        </p>
        <h2 className="font-heading text-metallic text-balance text-3xl font-bold md:text-5xl">
          ENGINEERED FOR EXCELLENCE
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {features.map((feature, index) => (
          <article
            key={feature.id}
            id={feature.id}
            className="glass-card sheen-border fade-up flex flex-col gap-5 rounded-2xl p-8"
            style={{ animationDelay: `${0.15 * index}s` }}
          >
            <div
              className={`flex size-12 items-center justify-center rounded-xl border ${
                feature.gold
                  ? 'border-gold/40 text-gold'
                  : 'border-silver/30 text-silver'
              }`}
            >
              <feature.icon className="size-6" aria-hidden="true" />
            </div>
            <h3 className="font-heading text-xl font-semibold text-foreground">
              {feature.title}
            </h3>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}
