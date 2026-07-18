import { AuthForm } from '@/components/auth-form'

export const metadata = {
  title: 'Sign In — IRONSTACK',
  description: 'Sign in or create your IRONSTACK account.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const params = await searchParams
  const next = params.next ?? '/dashboard'

  return (
    <div className="flex min-h-svh items-center justify-center px-6 py-24">
      <div className="flex w-full flex-col items-center gap-6">
        {params.error === 'auth_callback_failed' && (
          <p className="max-w-md rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
            Email confirmation failed. Please try signing in again.
          </p>
        )}
        <AuthForm next={next} />
      </div>
    </div>
  )
}
