-- Nullable FK: user's active / primary training program.
-- Run in Supabase SQL editor after reviewing.

alter table public.profiles
  add column if not exists primary_split_id uuid
    references public.splits (id) on delete set null;

create index if not exists profiles_primary_split_id_idx
  on public.profiles (primary_split_id)
  where primary_split_id is not null;

comment on column public.profiles.primary_split_id is
  'User-selected primary training split (from recommendations or manual pick).';
