-- IronStack AI agent actions: confirmation queue, audit trail, suggestions.
-- Run in Supabase SQL Editor (Dashboard -> SQL). Safe to re-run.
--
-- Design notes:
--   * ai_pending_actions is the single-use confirmation queue. The coach writes
--     a row when it PROPOSES a change; nothing is applied until the athlete
--     confirms and the row flips pending -> confirmed atomically.
--   * ai_action_audit is append-only by policy (select + insert only). An undo
--     never edits history — it inserts a new row pointing at the original via
--     undo_of, so the full sequence stays reviewable.
--   * All three tables are own-row only. The AI executes with the athlete's own
--     session, so RLS here is the same wall the UI already sits behind.

-- ---------------------------------------------------------------------------
-- Confirmation queue
-- ---------------------------------------------------------------------------
create table if not exists public.ai_pending_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.ai_conversations (id) on delete set null,
  action_name text not null,
  args jsonb not null default '{}'::jsonb,
  preview jsonb not null default '{}'::jsonb,
  -- Verbatim athlete message that produced this proposal (audit requirement).
  request_text text,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 minutes'),
  resolved_at timestamptz
);

create index if not exists ai_pending_actions_user_status_idx
  on public.ai_pending_actions (user_id, status, created_at desc);

create index if not exists ai_pending_actions_conversation_idx
  on public.ai_pending_actions (conversation_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.ai_action_audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id uuid references public.ai_conversations (id) on delete set null,
  pending_action_id uuid references public.ai_pending_actions (id) on delete set null,
  action_name text not null,
  -- Human-readable one-liner rendered in the audit viewer.
  summary text not null default '',
  args jsonb not null default '{}'::jsonb,
  request_text text,
  -- Snapshot before/after so an undo can restore prior values.
  before_state jsonb,
  after_state jsonb,
  status text not null default 'executed'
    check (status in ('executed', 'failed', 'undone')),
  error text,
  -- Set on rows that reverse an earlier action.
  undo_of uuid references public.ai_action_audit (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_action_audit_user_created_idx
  on public.ai_action_audit (user_id, created_at desc);

create index if not exists ai_action_audit_undo_of_idx
  on public.ai_action_audit (undo_of)
  where undo_of is not null;

-- ---------------------------------------------------------------------------
-- Proactive suggestions
-- ---------------------------------------------------------------------------
create table if not exists public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  -- Stable per-user key so regenerating never duplicates a live suggestion.
  dedupe_key text not null,
  title text not null,
  body text not null default '',
  -- Optional prefilled coach prompt the athlete can send with one tap.
  prompt text,
  cta_href text,
  priority smallint not null default 0,
  status text not null default 'new'
    check (status in ('new', 'seen', 'dismissed', 'acted')),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  seen_at timestamptz,
  resolved_at timestamptz,
  constraint ai_suggestions_user_dedupe_key unique (user_id, dedupe_key)
);

create index if not exists ai_suggestions_user_status_idx
  on public.ai_suggestions (user_id, status, priority desc, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.ai_pending_actions enable row level security;
alter table public.ai_action_audit enable row level security;
alter table public.ai_suggestions enable row level security;

drop policy if exists "Users manage own ai pending actions" on public.ai_pending_actions;
create policy "Users manage own ai pending actions"
  on public.ai_pending_actions for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Append-only: no update or delete policy on purpose. An undo inserts a new
-- row rather than rewriting the original, so history cannot be quietly erased.
drop policy if exists "Users read own ai action audit" on public.ai_action_audit;
create policy "Users read own ai action audit"
  on public.ai_action_audit for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Users append own ai action audit" on public.ai_action_audit;
create policy "Users append own ai action audit"
  on public.ai_action_audit for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users manage own ai suggestions" on public.ai_suggestions;
create policy "Users manage own ai suggestions"
  on public.ai_suggestions for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
