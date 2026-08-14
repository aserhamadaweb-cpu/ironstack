-- Reference DDL for social features (tables already live in Supabase).
-- Safe to re-run for local/docs; live policies may already exist.

alter table public.profiles add column if not exists bio text;

create table if not exists public.followers (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followed_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.profiles (id) on delete cascade,
  user_b_id uuid not null references public.profiles (id) on delete cascade,
  -- Must be the creating user's id (RLS: initiated_by = auth.uid()).
  initiated_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_a_id, user_b_id),
  check (user_a_id < user_b_id),
  check (initiated_by = user_a_id or initiated_by = user_b_id)
);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- Storage bucket "avatars" should allow public read and
-- authenticated write only under {user_id}/*.
