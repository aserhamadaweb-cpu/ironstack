-- Limit username edits to 2 changes after the initial claim.
alter table public.profiles
  add column if not exists username_change_count integer not null default 0;

alter table public.profiles
  drop constraint if exists profiles_username_change_count_range;

alter table public.profiles
  add constraint profiles_username_change_count_range
  check (username_change_count >= 0 and username_change_count <= 2);

comment on column public.profiles.username_change_count is
  'How many times the username was changed after the initial set. Max 2.';

create or replace function public.enforce_username_change_limit()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  -- Ignore client attempts to rewrite the counter.
  new.username_change_count := coalesce(old.username_change_count, 0);

  if old.username is distinct from new.username then
    -- First claim (null/blank -> value) does not consume a change.
    if old.username is not null and length(btrim(old.username)) > 0 then
      if coalesce(old.username_change_count, 0) >= 2 then
        raise exception 'Username can only be changed 2 times.'
          using errcode = 'P0001';
      end if;
      new.username_change_count := coalesce(old.username_change_count, 0) + 1;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_username_change_limit on public.profiles;

create trigger profiles_username_change_limit
  before update on public.profiles
  for each row
  execute function public.enforce_username_change_limit();
