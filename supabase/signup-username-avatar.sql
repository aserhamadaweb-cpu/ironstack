-- ============================================================
-- Signup: claim username from auth metadata on profile create
-- ============================================================
-- Uniqueness: profiles.username is already UNIQUE.
-- NOT NULL: deferred — guests and some legacy rows still have null
-- usernames. Email/password signup enforces username in app code +
-- this trigger copies a valid handle from raw_user_meta_data.
-- Ask product before running: ALTER TABLE profiles ALTER COLUMN
-- username SET NOT NULL; (requires backfill first).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta_username text;
  meta_display text;
  clean_username text;
begin
  meta_username := nullif(lower(trim(coalesce(new.raw_user_meta_data ->> 'username', ''))), '');
  meta_display := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');

  clean_username := null;
  if meta_username is not null
     and meta_username ~ '^[a-z0-9_]{3,30}$' then
    -- Only set if not already taken (race-safe unique index still applies).
    if not exists (
      select 1 from public.profiles p where p.username = meta_username
    ) then
      clean_username := meta_username;
    end if;
  end if;

  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    coalesce(meta_display, split_part(new.email, '@', 1), clean_username, 'Athlete'),
    clean_username
  );
  return new;
end;
$$;

-- Reject empty-string usernames (null still allowed for guests / OAuth pending).
alter table public.profiles drop constraint if exists profiles_username_not_blank;
alter table public.profiles
  add constraint profiles_username_not_blank
  check (username is null or length(btrim(username)) >= 3);

-- Public availability check for signup (bypasses RLS safely — returns boolean only).
create or replace function public.is_username_available(desired text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.profiles
    where username = lower(trim(desired))
  );
$$;

revoke all on function public.is_username_available(text) from public;
grant execute on function public.is_username_available(text) to anon, authenticated;
