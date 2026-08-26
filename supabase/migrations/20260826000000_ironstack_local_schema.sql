-- ============================================================
-- IronStack — Local development schema (Supabase CLI)
-- Reconstructed from lib/database.types.ts + supabase/*.sql so the
-- full app runs against a local Supabase stack. Applied automatically
-- by `supabase start` / `supabase db reset`.
-- ============================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------
-- Shared helper: keep updated_at fresh
-- ----------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ----------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  preferred_unit text not null default 'kg' check (preferred_unit in ('kg','lb')),
  theme_preference text not null default 'dark' check (theme_preference in ('dark','light')),
  language text not null default 'en' check (language in ('en','ar')),
  notification_preferences jsonb not null default '{
    "friend_request": true, "friend_accepted": true, "new_follower": true,
    "new_message": true, "message_request": true, "pr_achievement": true,
    "split_saved": true
  }'::jsonb,
  privacy_follow text not null default 'everyone' check (privacy_follow in ('everyone','nobody')),
  privacy_friend_request text not null default 'everyone' check (privacy_friend_request in ('everyone','nobody')),
  privacy_message text not null default 'everyone' check (privacy_message in ('everyone','friends','nobody')),
  height_cm numeric(5,1),
  gender text check (gender in ('male','female')),
  birth_date date,
  current_weight_kg numeric(6,2),
  is_email_verified boolean not null default false,
  is_guest boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format
    check (username is null or username ~ '^[a-z0-9_]{3,30}$')
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row from auth signup metadata.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  uname text := lower(coalesce(meta->>'username',''));
begin
  insert into public.profiles (
    id, display_name, username, height_cm, gender, birth_date,
    current_weight_kg, language, theme_preference, is_guest, is_email_verified
  )
  values (
    new.id,
    coalesce(meta->>'display_name', split_part(coalesce(new.email,''),'@',1)),
    case when uname ~ '^[a-z0-9_]{3,30}$' then uname else null end,
    nullif(meta->>'height_cm','')::numeric,
    case when meta->>'gender' in ('male','female') then meta->>'gender' else null end,
    nullif(meta->>'birth_date','')::date,
    nullif(meta->>'weight_kg','')::numeric,
    case when meta->>'language' in ('en','ar') then meta->>'language' else 'en' end,
    case when meta->>'theme_preference' in ('dark','light') then meta->>'theme_preference' else 'dark' end,
    coalesce(new.is_anonymous, false),
    (new.email_confirmed_at is not null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------
-- lift_types (reference catalog)
-- ----------------------------------------------------------
create table public.lift_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null default 'compound',
  sort_order smallint not null default 0,
  is_system boolean not null default true,
  image_url text,
  muscle_group text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------
-- body_weight_logs
-- ----------------------------------------------------------
create table public.body_weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  weight_kg numeric(6,2) not null check (weight_kg > 0),
  logged_at timestamptz not null default now()
);
create index body_weight_logs_user_idx on public.body_weight_logs (user_id, logged_at);

-- ----------------------------------------------------------
-- splits / split_days / split_day_exercises
-- ----------------------------------------------------------
create table public.splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  days_per_week smallint not null default 3,
  is_system boolean not null default false,
  is_shared boolean not null default false,
  source_split_id uuid,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint splits_category_check check (category is null or length(trim(category)) > 0)
);
create trigger splits_set_updated_at before update on public.splits
  for each row execute function public.set_updated_at();

create table public.split_days (
  id uuid primary key default gen_random_uuid(),
  split_id uuid not null references public.splits (id) on delete cascade,
  name text not null,
  day_order smallint not null default 0,
  subtitle text,
  created_at timestamptz not null default now()
);

create table public.split_day_exercises (
  id uuid primary key default gen_random_uuid(),
  split_day_id uuid not null references public.split_days (id) on delete cascade,
  lift_type_id uuid not null references public.lift_types (id) on delete restrict,
  target_sets smallint not null default 3,
  target_reps_min smallint,
  target_reps_max smallint,
  exercise_order smallint not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------
-- sessions
-- ----------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  split_id uuid references public.splits (id) on delete set null,
  split_day_id uuid references public.split_days (id) on delete set null,
  status text not null default 'in_progress' check (status in ('in_progress','completed','cancelled')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_seconds integer,
  total_volume numeric,
  total_sets_completed integer,
  total_sets_skipped integer,
  created_at timestamptz not null default now()
);
create index sessions_user_status_idx on public.sessions (user_id, status, finished_at desc);

-- ----------------------------------------------------------
-- lift_logs
-- ----------------------------------------------------------
create table public.lift_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lift_type_id uuid not null references public.lift_types (id) on delete restrict,
  weight numeric(7,2) not null default 0,
  reps smallint not null default 1,
  weight_unit text not null default 'kg' check (weight_unit in ('kg','lb')),
  duration_seconds integer,
  logged_at timestamptz not null default now(),
  notes text,
  session_id uuid references public.sessions (id) on delete cascade,
  set_number smallint,
  is_skipped boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lift_logs_weight_check check (weight > 0 or (duration_seconds is not null and duration_seconds > 0)),
  constraint lift_logs_reps_check check ((reps > 0 and reps <= 100) or (duration_seconds is not null and duration_seconds > 0)),
  constraint lift_logs_notes_length check (notes is null or char_length(notes) <= 500)
);
create index lift_logs_user_logged_idx on public.lift_logs (user_id, logged_at desc);
create index lift_logs_session_idx on public.lift_logs (session_id);
create trigger lift_logs_set_updated_at before update on public.lift_logs
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------
-- personal_records
-- ----------------------------------------------------------
create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  lift_type_id uuid not null references public.lift_types (id) on delete cascade,
  weight numeric(7,2) not null,
  reps smallint not null default 1,
  is_current_pr boolean not null default true,
  logged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index personal_records_user_idx on public.personal_records (user_id, is_current_pr, weight desc);

-- ----------------------------------------------------------
-- social: friendships / followers / dm
-- ----------------------------------------------------------
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','blocked','rejected')),
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);

create table public.followers (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followed_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create table public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  user_a_id uuid not null references public.profiles (id) on delete cascade,
  user_b_id uuid not null references public.profiles (id) on delete cascade,
  initiated_by uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_a_id, user_b_id),
  check (user_a_id < user_b_id),
  check (initiated_by = user_a_id or initiated_by = user_b_id)
);

create table public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------
-- notifications + push
-- ----------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  related_user_id uuid references public.profiles (id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_subscriptions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text primary key,
  p256dh text not null,
  auth_key text not null
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ----------------------------------------------------------
-- AI coach tables
-- ----------------------------------------------------------
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user','assistant','tool','system')),
  content text not null default '',
  tool_name text,
  tool_call_id text,
  created_at timestamptz not null default now()
);

create table public.ai_celebrations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'pr',
  title text not null,
  body text,
  lift_name text,
  weight numeric,
  reps integer,
  session_id uuid,
  banner_shown boolean not null default false,
  mentioned_in_chat boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  headline text not null,
  detail text not null,
  source_session_id uuid,
  language text not null default 'en',
  generated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index ai_insights_user_lang_idx on public.ai_insights (user_id, language, generated_at desc);

create table public.ai_user_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  fact text not null,
  category text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------
-- achievements
-- ----------------------------------------------------------
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  category text not null default 'streak',
  icon text not null default 'trophy',
  sort_order smallint not null default 0
);

create table public.user_achievements (
  user_id uuid not null references public.profiles (id) on delete cascade,
  achievement_id uuid not null references public.achievements (id) on delete cascade,
  earned_at timestamptz not null default now(),
  display_order smallint,
  primary key (user_id, achievement_id)
);

-- ----------------------------------------------------------
-- challenges
-- ----------------------------------------------------------
create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  opponent_id uuid not null references public.profiles (id) on delete cascade,
  lift_type_id uuid not null references public.lift_types (id) on delete cascade,
  target_weight numeric not null,
  target_reps smallint not null default 1,
  status text not null default 'pending',
  winner_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  responded_at timestamptz
);

-- ----------------------------------------------------------
-- group chats
-- ----------------------------------------------------------
create table public.group_chats (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_global boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  avatar_url text
);

create table public.group_chat_members (
  id uuid primary key default gen_random_uuid(),
  group_chat_id uuid not null references public.group_chats (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  unique (group_chat_id, user_id)
);

create table public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_chat_id uuid not null references public.group_chats (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------
-- Streak RPCs (used by lib/data/streak.ts)
-- Consecutive calendar days (UTC) with a completed session, ending today/yesterday.
-- ----------------------------------------------------------
create or replace function public.get_current_streak(p_user_id uuid)
returns integer language plpgsql stable security definer set search_path = public as $$
declare
  d date;
  streak integer := 0;
  cursor_day date := (now() at time zone 'utc')::date;
begin
  if not exists (
    select 1 from public.sessions
    where user_id = p_user_id and status = 'completed'
      and coalesce(finished_at, started_at)::date = cursor_day
  ) then
    cursor_day := cursor_day - 1;
  end if;

  loop
    select max(coalesce(finished_at, started_at)::date) into d
    from public.sessions
    where user_id = p_user_id and status = 'completed'
      and coalesce(finished_at, started_at)::date = cursor_day;
    if d is null then exit; end if;
    streak := streak + 1;
    cursor_day := cursor_day - 1;
  end loop;
  return streak;
end;
$$;

create or replace function public.get_streak_hours_left(p_user_id uuid)
returns integer language plpgsql stable security definer set search_path = public as $$
declare
  last_day date;
begin
  select max(coalesce(finished_at, started_at)::date) into last_day
  from public.sessions
  where user_id = p_user_id and status = 'completed';
  if last_day is null then return null; end if;
  -- Hours until the end of the day after the last training day (UTC).
  return greatest(
    0,
    ceil(extract(epoch from ((last_day + 2)::timestamp - (now() at time zone 'utc'))) / 3600)::integer
  );
end;
$$;

-- ----------------------------------------------------------
-- Views
-- ----------------------------------------------------------
create or replace view public.current_prs
with (security_invoker = true) as
select distinct on (ll.user_id, ll.lift_type_id)
  ll.user_id, ll.lift_type_id, lt.slug as lift_slug, lt.name as lift_name,
  ll.id as lift_log_id, ll.weight, ll.reps, ll.weight_unit, ll.logged_at
from public.lift_logs ll
join public.lift_types lt on lt.id = ll.lift_type_id
order by ll.user_id, ll.lift_type_id, ll.weight desc, ll.reps asc, ll.logged_at desc;

create or replace view public.leaderboard
with (security_invoker = true) as
select
  p.id as user_id,
  p.display_name,
  p.username,
  p.avatar_url,
  public.get_current_streak(p.id) as current_streak,
  best.lift_name as best_lift_name,
  best.weight as best_lift_weight,
  best.reps as best_lift_reps
from public.profiles p
left join lateral (
  select lt.name as lift_name, pr.weight, pr.reps
  from public.personal_records pr
  join public.lift_types lt on lt.id = pr.lift_type_id
  where pr.user_id = p.id and pr.is_current_pr = true
  order by pr.weight desc
  limit 1
) best on true;

-- ----------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.lift_types enable row level security;
alter table public.body_weight_logs enable row level security;
alter table public.splits enable row level security;
alter table public.split_days enable row level security;
alter table public.split_day_exercises enable row level security;
alter table public.sessions enable row level security;
alter table public.lift_logs enable row level security;
alter table public.personal_records enable row level security;
alter table public.friendships enable row level security;
alter table public.followers enable row level security;
alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_celebrations enable row level security;
alter table public.ai_insights enable row level security;
alter table public.ai_user_memory enable row level security;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
alter table public.challenges enable row level security;
alter table public.group_chats enable row level security;
alter table public.group_chat_members enable row level security;
alter table public.group_messages enable row level security;

-- profiles: read all (needed by social/leaderboard), write own
create policy "profiles read all" on public.profiles for select to authenticated using (true);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- reference catalogs: readable by all authenticated
create policy "lift_types read" on public.lift_types for select to authenticated using (true);
create policy "achievements read" on public.achievements for select to authenticated using (true);

-- body weight
create policy "bw own" on public.body_weight_logs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- splits + children
create policy "splits read" on public.splits for select to authenticated using (user_id is null or user_id = auth.uid() or is_system = true);
create policy "splits insert own" on public.splits for insert to authenticated with check (user_id = auth.uid() and coalesce(is_system,false) = false);
create policy "splits update own" on public.splits for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "splits delete own" on public.splits for delete to authenticated using (user_id = auth.uid() and coalesce(is_system,false) = false);

create policy "split_days read" on public.split_days for select to authenticated using (
  exists (select 1 from public.splits s where s.id = split_id and (s.user_id = auth.uid() or s.user_id is null or s.is_system = true)));
create policy "split_days write" on public.split_days for all to authenticated
  using (exists (select 1 from public.splits s where s.id = split_id and (s.user_id = auth.uid() or s.user_id is null or s.is_system = true)))
  with check (exists (select 1 from public.splits s where s.id = split_id and s.user_id = auth.uid()));

create policy "sde read" on public.split_day_exercises for select to authenticated using (
  exists (select 1 from public.split_days d join public.splits s on s.id = d.split_id where d.id = split_day_id and (s.user_id = auth.uid() or s.user_id is null or s.is_system = true)));
create policy "sde write" on public.split_day_exercises for all to authenticated
  using (exists (select 1 from public.split_days d join public.splits s on s.id = d.split_id where d.id = split_day_id and (s.user_id = auth.uid() or s.user_id is null or s.is_system = true)))
  with check (exists (select 1 from public.split_days d join public.splits s on s.id = d.split_id where d.id = split_day_id and s.user_id = auth.uid()));

-- sessions / lift_logs / personal_records: own rows
create policy "sessions own" on public.sessions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "lift_logs own" on public.lift_logs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "prs own" on public.personal_records for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- social
create policy "friendships read" on public.friendships for select to authenticated using (user_id = auth.uid() or friend_id = auth.uid());
create policy "friendships write" on public.friendships for all to authenticated using (user_id = auth.uid() or friend_id = auth.uid()) with check (user_id = auth.uid() or friend_id = auth.uid());
create policy "followers read" on public.followers for select to authenticated using (true);
create policy "followers write" on public.followers for all to authenticated using (follower_id = auth.uid()) with check (follower_id = auth.uid());
create policy "dm_threads own" on public.dm_threads for all to authenticated using (user_a_id = auth.uid() or user_b_id = auth.uid()) with check (initiated_by = auth.uid());
create policy "dm_messages own" on public.dm_messages for all to authenticated
  using (exists (select 1 from public.dm_threads t where t.id = thread_id and (t.user_a_id = auth.uid() or t.user_b_id = auth.uid())))
  with check (sender_id = auth.uid());

-- notifications / push
create policy "notifications own" on public.notifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push own" on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- AI
create policy "ai_conv own" on public.ai_conversations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_msg own" on public.ai_messages for all to authenticated
  using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy "ai_celeb own" on public.ai_celebrations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_insight own" on public.ai_insights for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "ai_mem own" on public.ai_user_memory for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- achievements earned
create policy "ua own read" on public.user_achievements for select to authenticated using (true);
create policy "ua own write" on public.user_achievements for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- challenges
create policy "challenges read" on public.challenges for select to authenticated using (creator_id = auth.uid() or opponent_id = auth.uid());
create policy "challenges write" on public.challenges for all to authenticated using (creator_id = auth.uid() or opponent_id = auth.uid()) with check (creator_id = auth.uid() or opponent_id = auth.uid());

-- group chats
create policy "gc read" on public.group_chats for select to authenticated using (
  is_global = true or exists (select 1 from public.group_chat_members m where m.group_chat_id = id and m.user_id = auth.uid()));
create policy "gc write" on public.group_chats for all to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "gcm read" on public.group_chat_members for select to authenticated using (true);
create policy "gcm write" on public.group_chat_members for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "gm read" on public.group_messages for select to authenticated using (
  exists (select 1 from public.group_chats g where g.id = group_chat_id and (g.is_global = true or exists (select 1 from public.group_chat_members m where m.group_chat_id = g.id and m.user_id = auth.uid()))));
create policy "gm write" on public.group_messages for insert to authenticated with check (sender_id = auth.uid());

-- ----------------------------------------------------------
-- Grants (RLS still gates row access). Mirrors Supabase defaults
-- so the anon/authenticated API roles can reach these objects.
-- ----------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
grant all privileges on all routines in schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;
