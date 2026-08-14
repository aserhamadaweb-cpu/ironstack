-- Optional reference for ai_insights (already created live).
create table if not exists public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  headline text not null,
  detail text not null,
  source_session_id uuid,
  language text not null default 'en',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists ai_insights_user_generated_idx
  on public.ai_insights (user_id, generated_at desc);

create index if not exists ai_insights_user_language_generated_idx
  on public.ai_insights (user_id, language, generated_at desc);

alter table public.ai_insights enable row level security;

drop policy if exists "Users manage own ai insights" on public.ai_insights;
create policy "Users manage own ai insights"
  on public.ai_insights for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
