-- Optional reference for ai_user_memory (already created live).
-- Safe to re-run; only creates if missing.

create table if not exists public.ai_user_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fact text not null,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_user_memory_user_active_idx
  on public.ai_user_memory (user_id, is_active, updated_at desc);

alter table public.ai_user_memory enable row level security;

drop policy if exists "Users manage own ai memory" on public.ai_user_memory;
create policy "Users manage own ai memory"
  on public.ai_user_memory for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
