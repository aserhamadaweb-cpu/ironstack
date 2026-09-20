-- Document intentional SECURITY DEFINER semantics for public.public_profiles.
--
-- Postgres treats views without security_invoker=true as security-definer-like
-- (owner privileges on underlying tables). That is required here because
-- profiles RLS only allows SELECT of one's own row (profiles_select_own),
-- while social/leaderboard features must read other athletes' public fields.
--
-- This view projects ONLY public-safe columns; sensitive profile columns are
-- never exposed. SELECT is granted to authenticated only (not anon).
--
-- View definition (keep in sync):
--   SELECT id, username, display_name, avatar_url, bio, is_guest FROM profiles;

COMMENT ON VIEW public.public_profiles IS
  'Public directory projection of profiles (id, username, display_name, avatar_url, bio, is_guest). Intentionally runs without security_invoker so authenticated clients can read other users'' public fields despite profiles_select_own RLS. Does NOT expose height/weight/birth_date/gender/prefs/privacy/theme/language/email flags. Do not widen the column list without a security review.';
