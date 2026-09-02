-- Fix: social INSERT policies read target privacy on profiles, but
-- profiles SELECT is own-row-only. That made EXISTS(privacy_*) always fail.
-- Security definer helpers evaluate privacy without exposing private rows.

create or replace function public.is_non_guest(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not coalesce((select is_guest from profiles where id = uid), false);
$$;

create or replace function public.profile_allows_follow(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select privacy_follow = 'everyone' from profiles where id = target_id),
    false
  );
$$;

create or replace function public.profile_allows_friend_request(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select privacy_friend_request = 'everyone' from profiles where id = target_id),
    false
  );
$$;

create or replace function public.profile_allows_message(viewer_id uuid, target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        case p.privacy_message
          when 'everyone' then true
          when 'nobody' then false
          when 'friends' then exists (
            select 1 from friendships f
            where f.status = 'accepted'
              and (
                (f.user_id = viewer_id and f.friend_id = target_id)
                or (f.user_id = target_id and f.friend_id = viewer_id)
              )
          )
          else false
        end
      from profiles p
      where p.id = target_id
    ),
    false
  );
$$;

revoke all on function public.is_non_guest(uuid) from public;
revoke all on function public.profile_allows_follow(uuid) from public;
revoke all on function public.profile_allows_friend_request(uuid) from public;
revoke all on function public.profile_allows_message(uuid, uuid) from public;

grant execute on function public.is_non_guest(uuid) to authenticated;
grant execute on function public.profile_allows_follow(uuid) to authenticated;
grant execute on function public.profile_allows_friend_request(uuid) to authenticated;
grant execute on function public.profile_allows_message(uuid, uuid) to authenticated;

drop policy if exists followers_insert on public.followers;
create policy followers_insert on public.followers
  for insert to authenticated
  with check (
    (select auth.uid()) = follower_id
    and public.is_non_guest((select auth.uid()))
    and public.profile_allows_follow(followed_id)
  );

drop policy if exists friendships_insert on public.friendships;
create policy friendships_insert on public.friendships
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.is_non_guest((select auth.uid()))
    and public.profile_allows_friend_request(friend_id)
  );

drop policy if exists dm_threads_insert on public.dm_threads;
create policy dm_threads_insert on public.dm_threads
  for insert to authenticated
  with check (
    ((select auth.uid()) = user_a_id or (select auth.uid()) = user_b_id)
    and initiated_by = (select auth.uid())
    and public.is_non_guest((select auth.uid()))
    and public.profile_allows_message(
      (select auth.uid()),
      case
        when user_a_id = (select auth.uid()) then user_b_id
        else user_a_id
      end
    )
  );
