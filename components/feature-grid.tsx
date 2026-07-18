import { BrainCircuit, Trophy, Users } from 'lucide-react'

const features = [
  {
    id: 'ai-assistant',
    icon: BrainCircuit,
    title: 'AI Assistant',
    description:
      'Your personal training buddy. Get workout plans that fit your life, friendly recovery tips, and helpful advice whenever you need it.',
  },
  {
    id: 'pr-arena',
    icon: Trophy,
    title: 'PR Arena',
    description:
      'Log your lifts, watch your numbers grow, and celebrate every new personal record. Small wins add up to big changes.',
    gold: true,
  },
  {
    id: 'community-circle',
    icon: Users,
    title: 'Community Circle',
    description:
      'A warm and welcoming space to share your journey. Cheer each other on, swap tips, and make friends who love training as much as you do.',
  },
]

export function FeatureGrid() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24 md:py-32">
      <div className="mb-16 flex flex-col items-center gap-4 text-center">
        <p className="fade-up text-xs font-medium tracking-[0.4em] text-primary">
          WHAT YOU GET
        </p>
        <h2
          className="fade-up font-heading text-metallic text-balance text-3xl font-bold md:text-5xl"
          style={{ animationDelay: '0.1s' }}
        >
          EVERYTHING YOU NEED TO GROW
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {features.map((feature, index) => (
          <article
            key={feature.id}
            id={feature.id}
            className="glass-card sheen-border fade-up card-lift group flex flex-col gap-5 rounded-2xl p-8"
            style={{ animationDelay: `${0.15 * index}s` }}
          >
            <div
              className={`icon-bounce flex size-12 items-center justify-center rounded-xl border transition-colors duration-300 ${
                feature.gold
                  ? 'border-gold/40 text-gold group-hover:border-gold/70'
                  : 'border-silver/30 text-silver group-hover:border-silver/60'
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
