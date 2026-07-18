-- ============================================================
-- IRONSTACK PR Tracker — Initial Schema
-- Run this entire file in Supabase SQL Editor (Dashboard → SQL)
-- ============================================================

-- ----------------------------------------------------------
-- Extensions
-- ----------------------------------------------------------
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------
-- 1. PROFILES (1:1 with auth.users)
-- ----------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text unique,
  display_name  text,
  avatar_url    text,
  preferred_unit text not null default 'kg'
    check (preferred_unit in ('kg', 'lb')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint profiles_username_length
    check (username is null or (char_length(username) >= 3 and char_length(username) <= 30)),
  constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_]+$')
);

comment on table public.profiles is 'App profile for each authenticated athlete';
comment on column public.profiles.preferred_unit is 'Default unit for display and new log entries';

-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------
-- 2. LIFT TYPES (reference catalog)
-- ----------------------------------------------------------
create table public.lift_types (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  category    text not null default 'compound'
    check (category in ('compound', 'olympic', 'accessory', 'bodyweight')),
  sort_order  smallint not null default 0,
  is_system   boolean not null default true,
  created_at  timestamptz not null default now()
);

comment on table public.lift_types is 'Canonical list of lifts athletes can log';
comment on column public.lift_types.slug is 'Stable machine key, e.g. bench_press';
comment on column public.lift_types.is_system is 'True for platform lifts; false reserved for future custom lifts';

insert into public.lift_types (slug, name, category, sort_order) values
  ('bench_press',      'Bench Press',       'compound',  1),
  ('squat',            'Squat',             'compound',  2),
  ('deadlift',         'Deadlift',          'compound',  3),
  ('overhead_press',   'Overhead Press',    'compound',  4),
  ('barbell_row',      'Barbell Row',       'compound',  5),
  ('front_squat',      'Front Squat',       'compound',  6),
  ('romanian_deadlift','Romanian Deadlift', 'compound',  7),
  ('pull_up',          'Pull-Up',           'bodyweight', 8),
  ('dip',              'Dip',               'bodyweight', 9);

-- ----------------------------------------------------------
-- 3. LIFT LOGS (PR history over time)
-- ----------------------------------------------------------
create table public.lift_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  lift_type_id  uuid not null references public.lift_types (id) on delete restrict,
  weight        numeric(7, 2) not null check (weight > 0),
  reps          smallint not null default 1 check (reps > 0 and reps <= 100),
  weight_unit   text not null default 'kg'
    check (weight_unit in ('kg', 'lb')),
  logged_at     timestamptz not null default now(),
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint lift_logs_notes_length
    check (notes is null or char_length(notes) <= 500)
);

comment on table public.lift_logs is 'Every logged lift attempt; PRs are derived from this history';
comment on column public.lift_logs.logged_at is 'When the athlete performed the lift (may differ from created_at)';

create index lift_logs_user_logged_at_idx
  on public.lift_logs (user_id, logged_at desc);

create index lift_logs_user_lift_logged_at_idx
  on public.lift_logs (user_id, lift_type_id, logged_at desc);

create trigger lift_logs_set_updated_at
  before update on public.lift_logs
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- ----------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.lift_types enable row level security;
alter table public.lift_logs enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Authenticated users can read lift types"
  on public.lift_types for select
  to authenticated
  using (true);

create policy "Users can view own lift logs"
  on public.lift_logs for select
  using (auth.uid() = user_id);

create policy "Users can insert own lift logs"
  on public.lift_logs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own lift logs"
  on public.lift_logs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own lift logs"
  on public.lift_logs for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------
-- 5. HELPER VIEW — Current PR per lift
-- ----------------------------------------------------------
create or replace view public.current_prs as
select distinct on (ll.user_id, ll.lift_type_id)
  ll.user_id,
  ll.lift_type_id,
  lt.slug   as lift_slug,
  lt.name   as lift_name,
  ll.id     as lift_log_id,
  ll.weight,
  ll.reps,
  ll.weight_unit,
  ll.logged_at
from public.lift_logs ll
join public.lift_types lt on lt.id = ll.lift_type_id
order by
  ll.user_id,
  ll.lift_type_id,
  ll.weight desc,
  ll.reps asc,
  ll.logged_at desc;

comment on view public.current_prs is 'Best weight per user per lift type (v1: raw max weight)';

alter view public.current_prs set (security_invoker = true);
