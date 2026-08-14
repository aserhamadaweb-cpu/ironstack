-- Allow custom-split saves to create missing lift_types rows.
-- Run once in the Supabase SQL Editor.

-- 1) Authenticated athletes may insert non-system lift types (from the 800+ library).
alter table public.lift_types enable row level security;

drop policy if exists "Authenticated users can read lift types" on public.lift_types;
create policy "Authenticated users can read lift types"
  on public.lift_types for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert lift types" on public.lift_types;
create policy "Authenticated users can insert lift types"
  on public.lift_types for insert
  to authenticated
  with check (coalesce(is_system, false) = false);

-- 2) SECURITY DEFINER helper — works even if INSERT policy is missing.
create or replace function public.ensure_lift_type(
  p_slug text,
  p_name text,
  p_muscle_group text default null,
  p_image_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_slug is null or length(trim(p_slug)) = 0 then
    raise exception 'slug required';
  end if;

  select id into v_id from public.lift_types where slug = p_slug limit 1;
  if v_id is not null then
    return v_id;
  end if;

  select id into v_id
  from public.lift_types
  where lower(name) = lower(p_name)
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.lift_types as lt (
    slug,
    name,
    category,
    muscle_group,
    image_url,
    is_system,
    sort_order
  )
  values (
    p_slug,
    p_name,
    'accessory',
    p_muscle_group,
    p_image_url,
    false,
    1000
  )
  on conflict (slug) do update
    set name = excluded.name
  returning lt.id into v_id;

  return v_id;
exception
  when undefined_column then
    -- Older schemas without muscle_group / image_url
    insert into public.lift_types as lt (slug, name, category, is_system, sort_order)
    values (p_slug, p_name, 'accessory', false, 1000)
    on conflict (slug) do update set name = excluded.name
    returning lt.id into v_id;
    return v_id;
end;
$$;

revoke all on function public.ensure_lift_type(text, text, text, text) from public;
grant execute on function public.ensure_lift_type(text, text, text, text) to authenticated;
grant execute on function public.ensure_lift_type(text, text, text, text) to service_role;
