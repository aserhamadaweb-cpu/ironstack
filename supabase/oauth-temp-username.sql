-- Temp usernames for OAuth/Google so profiles_non_guest_requires_username stays valid.
-- Also marks anonymous users as is_guest so they may keep a null username.
-- Run in Supabase SQL editor if MCP apply_migration is not approved.

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
  candidate text;
  n int := 0;
  guest_flag boolean;
begin
  meta_username := nullif(lower(trim(coalesce(new.raw_user_meta_data ->> 'username', ''))), '');
  meta_display := nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '');
  guest_flag := coalesce((new.raw_user_meta_data ->> 'is_guest')::boolean, new.is_anonymous, false);

  clean_username := null;
  if meta_username is not null and meta_username ~ '^[a-z0-9_]{3,30}$' then
    if not exists (select 1 from public.profiles p where p.username = meta_username) then
      clean_username := meta_username;
    end if;
  end if;

  if clean_username is null and guest_flag is not true then
    candidate := 'tmp_' || substr(replace(new.id::text, '-', ''), 1, 12);
    while exists (select 1 from public.profiles p where p.username = candidate) loop
      n := n + 1;
      candidate := 'tmp_' || substr(replace(new.id::text, '-', ''), 1, 10) || n::text;
      exit when length(candidate) > 30;
    end loop;
    clean_username := candidate;
  end if;

  insert into public.profiles (id, display_name, username, is_guest)
  values (
    new.id,
    coalesce(meta_display, split_part(new.email, '@', 1), clean_username, 'Athlete'),
    clean_username,
    guest_flag
  );
  return new;
end;
$$;
