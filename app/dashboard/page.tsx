import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/app/login/actions'
import { Button } from '@/components/ui/button'

export const metadata = {
  title: 'Dashboard — IRONSTACK',
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/dashboard')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, preferred_unit, created_at')
    .eq('id', user.id)
    .single()

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-8 px-6 py-24">
      <div className="glass-card sheen-border fade-up rounded-2xl p-8">
        <p className="mb-2 text-xs tracking-[0.3em] text-gold">PR ARENA</p>
        <h1 className="font-heading text-metallic text-3xl font-bold">
          Welcome, {profile?.display_name ?? user.email}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          You are signed in. Your profile was created automatically when you
          registered — lift logging comes next.
        </p>

        <dl className="mt-6 grid gap-3 text-sm">
          <div className="flex justify-between border-b border-silver/10 pb-2">
            <dt className="text-muted-foreground">Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div className="flex justify-between border-b border-silver/10 pb-2">
            <dt className="text-muted-foreground">Preferred unit</dt>
            <dd className="uppercase">{profile?.preferred_unit ?? 'kg'}</dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap gap-3">
          <form action={signOut}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
          <Link
            href="/"
            className="inline-flex h-9 items-center justify-center rounded-lg px-2.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  )
}
