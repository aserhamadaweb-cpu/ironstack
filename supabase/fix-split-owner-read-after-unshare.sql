-- Fix: private splits vanish from "Your Splits" after unsharing from profile.
-- Cause: SELECT policies that only allow is_shared rows (missing owner clause).
-- Safe to re-run.

alter table public.splits
  add column if not exists is_shared boolean not null default false;

drop policy if exists "Athletes can read splits" on public.splits;
create policy "Athletes can read splits"
  on public.splits for select
  to authenticated
  using (
    user_id is null
    or user_id = auth.uid()
    or coalesce(is_system, false) = true
    or coalesce(is_shared, false) = true
  );

drop policy if exists "Athletes manage split_days for own splits" on public.split_days;
create policy "Athletes manage split_days for own splits"
  on public.split_days for all
  to authenticated
  using (
    exists (
      select 1 from public.splits s
      where s.id = split_id
        and (
          s.user_id = auth.uid()
          or s.user_id is null
          or coalesce(s.is_system, false) = true
          or coalesce(s.is_shared, false) = true
        )
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
        and (
          s.user_id = auth.uid()
          or s.user_id is null
          or coalesce(s.is_system, false) = true
          or coalesce(s.is_shared, false) = true
        )
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
