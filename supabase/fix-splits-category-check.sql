-- Fix custom / recommended split saves.
-- Run once in the Supabase SQL Editor (Dashboard → SQL → New query → Run).

-- 1) Drop the category check that blocks user-owned inserts.
alter table public.splits drop constraint if exists splits_category_check;

-- Optional: re-add a permissive check (or leave unconstrained).
alter table public.splits
  add constraint splits_category_check
  check (
    category is null
    or length(trim(category)) > 0
  );

-- 2) RLS so athletes can own splits + child rows.
alter table public.splits enable row level security;
alter table public.split_days enable row level security;
alter table public.split_day_exercises enable row level security;

drop policy if exists "Athletes can read splits" on public.splits;
create policy "Athletes can read splits"
  on public.splits for select
  to authenticated
  using (user_id is null or user_id = auth.uid() or is_system = true);

drop policy if exists "Athletes can insert own splits" on public.splits;
create policy "Athletes can insert own splits"
  on public.splits for insert
  to authenticated
  with check (user_id = auth.uid() and coalesce(is_system, false) = false);

drop policy if exists "Athletes can update own splits" on public.splits;
create policy "Athletes can update own splits"
  on public.splits for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Athletes can delete own splits" on public.splits;
create policy "Athletes can delete own splits"
  on public.splits for delete
  to authenticated
  using (user_id = auth.uid() and coalesce(is_system, false) = false);

drop policy if exists "Athletes manage split_days for own splits" on public.split_days;
create policy "Athletes manage split_days for own splits"
  on public.split_days for all
  to authenticated
  using (
    exists (
      select 1 from public.splits s
      where s.id = split_id
        and (s.user_id = auth.uid() or s.user_id is null or s.is_system = true)
    )
  )
  with check (
    exists (
      select 1 from public.splits s
      where s.id = split_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Athletes manage split_day_exercises for own splits" on public.split_day_exercises;
create policy "Athletes manage split_day_exercises for own splits"
  on public.split_day_exercises for all
  to authenticated
  using (
    exists (
      select 1
      from public.split_days d
      join public.splits s on s.id = d.split_id
      where d.id = split_day_id
        and (s.user_id = auth.uid() or s.user_id is null or s.is_system = true)
    )
  )
  with check (
    exists (
      select 1
      from public.split_days d
      join public.splits s on s.id = d.split_id
      where d.id = split_day_id and s.user_id = auth.uid()
    )
  );
