-- Public / link-based split sharing (separate from profile is_shared visibility).
-- Run once in the Supabase SQL Editor.

alter table public.splits
  add column if not exists share_token text;

create unique index if not exists splits_share_token_uidx
  on public.splits (share_token)
  where share_token is not null;
