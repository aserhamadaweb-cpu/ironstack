-- Friendships are request-based (not mutual-follow).
-- user_id = requester, friend_id = recipient.
-- status: pending → accepted (or deleted on decline/cancel).

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'blocked', 'rejected')),
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

create index if not exists friendships_friend_pending_idx
  on public.friendships (friend_id, created_at desc)
  where status = 'pending';

create index if not exists friendships_accepted_idx
  on public.friendships (user_id, friend_id)
  where status = 'accepted';

-- IMPORTANT: If you previously created friendships via a mutual-follow
-- trigger on public.followers, disable it so follow ≠ friends:
--
--   select tgname, tgrelid::regclass
--   from pg_trigger
--   where not tgisinternal and tgrelid = 'public.followers'::regclass;
--
--   drop trigger if exists <that_trigger_name> on public.followers;
--   drop function if exists <that_function_name>();
