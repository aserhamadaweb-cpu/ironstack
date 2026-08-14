-- Cardio logging on lift_logs (duration_seconds + relaxed weight/reps for duration rows).
-- Run once in the Supabase SQL Editor.

alter table public.lift_logs
  add column if not exists duration_seconds integer;

comment on column public.lift_logs.duration_seconds is
  'Cardio duration in seconds; null for strength sets.';

-- Allow strength OR cardio rows: either weight×reps, or duration_seconds.
alter table public.lift_logs drop constraint if exists lift_logs_weight_check;
alter table public.lift_logs
  add constraint lift_logs_weight_check
  check (weight > 0 or (duration_seconds is not null and duration_seconds > 0));

alter table public.lift_logs drop constraint if exists lift_logs_reps_check;
alter table public.lift_logs
  add constraint lift_logs_reps_check
  check (
    (reps > 0 and reps <= 100)
    or (duration_seconds is not null and duration_seconds > 0)
  );
