-- Reference DDL for notifications + push (tables already live in Supabase).
-- Triggers that INSERT into notifications are owned by the database —
-- this file documents the shapes the app reads/writes.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  related_user_id uuid references public.profiles (id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where is_read = false;

create table if not exists public.push_subscriptions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_key text not null,
  primary key (endpoint)
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

-- RLS as it exists live. Documented here because the repo previously carried the
-- table shapes without the policies, which made the tables look unprotected.
-- notifications has no INSERT policy for `authenticated` on purpose: rows are
-- created only by security-definer triggers, never by the client.
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists notifications_update on public.notifications;
create policy notifications_update
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists push_subscriptions_select on public.push_subscriptions;
create policy push_subscriptions_select
  on public.push_subscriptions for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists push_subscriptions_insert on public.push_subscriptions;
create policy push_subscriptions_insert
  on public.push_subscriptions for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_delete
  on public.push_subscriptions for delete
  to authenticated
  using (user_id = (select auth.uid()));
