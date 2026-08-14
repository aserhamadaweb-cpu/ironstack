-- Fix live AI Coach tables to match the app.
-- Run in Supabase SQL Editor, then retry chat.

-- Conversations
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_conversations add column if not exists title text;
alter table public.ai_conversations add column if not exists updated_at timestamptz not null default now();

-- Messages: ownership is via conversation_id → ai_conversations.user_id
create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool', 'system')),
  content text not null default '',
  tool_name text,
  tool_call_id text,
  created_at timestamptz not null default now()
);

alter table public.ai_messages add column if not exists tool_name text;
alter table public.ai_messages add column if not exists tool_call_id text;
alter table public.ai_messages add column if not exists created_at timestamptz not null default now();

-- Celebrations
create table if not exists public.ai_celebrations (
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

alter table public.ai_celebrations add column if not exists kind text not null default 'pr';
alter table public.ai_celebrations add column if not exists body text;
alter table public.ai_celebrations add column if not exists lift_name text;
alter table public.ai_celebrations add column if not exists weight numeric;
alter table public.ai_celebrations add column if not exists reps integer;
alter table public.ai_celebrations add column if not exists session_id uuid;
alter table public.ai_celebrations add column if not exists banner_shown boolean not null default false;
alter table public.ai_celebrations add column if not exists mentioned_in_chat boolean not null default false;

create index if not exists ai_conversations_user_updated_idx
  on public.ai_conversations (user_id, updated_at desc);

create index if not exists ai_messages_conversation_created_idx
  on public.ai_messages (conversation_id, created_at asc);

create index if not exists ai_celebrations_user_flags_idx
  on public.ai_celebrations (user_id, banner_shown, mentioned_in_chat);

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_celebrations enable row level security;

drop policy if exists "Users manage own ai conversations" on public.ai_conversations;
create policy "Users manage own ai conversations"
  on public.ai_conversations for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Messages: allow if the parent conversation belongs to the user
drop policy if exists "Users manage own ai messages" on public.ai_messages;
create policy "Users manage own ai messages"
  on public.ai_messages for all
  to authenticated
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "Users manage own ai celebrations" on public.ai_celebrations;
create policy "Users manage own ai celebrations"
  on public.ai_celebrations for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
