-- Language-aware AI insight cache (en | ar).
-- Matches the live Supabase column: ai_insights.language
alter table public.ai_insights
  add column if not exists language text not null default 'en';

create index if not exists ai_insights_user_language_generated_idx
  on public.ai_insights (user_id, language, generated_at desc);
