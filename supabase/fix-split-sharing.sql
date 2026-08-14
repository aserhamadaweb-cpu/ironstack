-- Split sharing: columns + RLS so shared splits are readable by other athletes.
-- Run once in the Supabase SQL Editor.

alter table public.splits
  add column if not exists is_shared boolean not null default false;

alter table public.splits
  add column if not exists source_split_id uuid references public.splits (id) on delete set null;

create index if not exists splits_shared_user_idx
  on public.splits (user_id)
  where is_shared = true;

create index if not exists splits_source_split_idx
  on public.splits (user_id, source_split_id)
  where source_split_id is not null;

-- Readable: own, system, or shared on a profile.
drop policy if exists "Athletes can read splits" on public.splits;
create policy "Athletes can read splits"
  on public.splits for select
  to authenticated
  using (
    user_id is null
    or user_id = auth.uid()
    or is_system = true
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
          or s.is_system = true
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
          or s.is_system = true
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
