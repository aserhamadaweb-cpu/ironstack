import { redirect } from 'next/navigation'
import { DashboardNav } from '@/components/dashboard-nav'
import { EditProfileForm } from '@/components/edit-profile-form'
import { PageError } from '@/components/page-states'
import { getProfile } from '@/lib/data/queries'
import { initialsFrom } from '@/lib/dashboard-utils'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'Edit Profile — IRONSTACK',
}

export default async function EditProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profileResult = await getProfile(user.id)
  if (profileResult.error) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <PageError message={profileResult.error} />
      </main>
    )
  }

  const profile = profileResult.data
  const displayName =
    profile?.display_name ||
    user.email?.split('@')[0] ||
    'Athlete'

  return (
    <div className="min-h-svh pb-20 md:pb-0">
      <DashboardNav
        userName={displayName}
        initials={initialsFrom(displayName)}
        avatarUrl={profile?.avatar_url}
      />
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-8">
          <p className="text-[10px] font-semibold tracking-[0.35em] text-gold">
            PROFILE
          </p>
          <h1 className="font-heading mt-1 text-2xl font-bold text-foreground sm:text-3xl">
            Edit profile
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Photo, name, username, and a short bio.
          </p>
        </header>
        <EditProfileForm
          userId={user.id}
          initial={{
            username: profile?.username ?? '',
            displayName: profile?.display_name ?? displayName,
            bio: profile?.bio ?? '',
            avatarUrl: profile?.avatar_url ?? null,
          }}
        />
      </main>
    </div>
  )
}
