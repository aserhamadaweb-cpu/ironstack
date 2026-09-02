-- Allow athletes to demote their own current PRs when a session finishes.
-- finishSessionAction sets is_current_pr = false on the previous row before insert.
-- Safe to re-run.

drop policy if exists personal_records_update on public.personal_records;

create policy personal_records_update on public.personal_records
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
