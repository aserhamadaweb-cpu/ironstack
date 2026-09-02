-- Allow auth user / profile deletion when historical social rows remain.
-- App-level deleteAccountAction also clears these before deleteUser; this
-- migration makes cascades / SET NULL the durable schema fix.
--
-- Apply in Supabase SQL editor or via migrate when ready.

ALTER TABLE public.dm_messages
  DROP CONSTRAINT IF EXISTS dm_messages_sender_id_fkey;
ALTER TABLE public.dm_messages
  ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE public.dm_messages
  ADD CONSTRAINT dm_messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.dm_threads
  DROP CONSTRAINT IF EXISTS dm_threads_initiated_by_fkey;
ALTER TABLE public.dm_threads
  ALTER COLUMN initiated_by DROP NOT NULL;
ALTER TABLE public.dm_threads
  ADD CONSTRAINT dm_threads_initiated_by_fkey
  FOREIGN KEY (initiated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.group_messages
  DROP CONSTRAINT IF EXISTS group_messages_sender_id_fkey;
ALTER TABLE public.group_messages
  ALTER COLUMN sender_id DROP NOT NULL;
ALTER TABLE public.group_messages
  ADD CONSTRAINT group_messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.challenges
  DROP CONSTRAINT IF EXISTS challenges_winner_id_fkey;
ALTER TABLE public.challenges
  ADD CONSTRAINT challenges_winner_id_fkey
  FOREIGN KEY (winner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE public.personal_records
  DROP CONSTRAINT IF EXISTS personal_records_user_id_fkey;
ALTER TABLE public.personal_records
  ADD CONSTRAINT personal_records_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
