-- Shared state for the Salad Map: stores, attached photos, KML layers, and layer visibility.
-- Photos are retained as the existing JSON metadata/data URL format for compatibility.
-- SECURITY NOTICE: These anon policies are for development verification only.
-- Before production, require authentication and restrict each workspace's records with RLS.

create table if not exists public.salad_map_state (
  id text primary key,
  stores jsonb not null default '[]'::jsonb,
  layers jsonb not null default '[]'::jsonb,
  layer_visibility jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.salad_map_state enable row level security;

drop policy if exists "dev anon read salad_map_state" on public.salad_map_state;
create policy "dev anon read salad_map_state"
  on public.salad_map_state for select
  to anon
  using (true);

drop policy if exists "dev anon insert salad_map_state" on public.salad_map_state;
create policy "dev anon insert salad_map_state"
  on public.salad_map_state for insert
  to anon
  with check (true);

drop policy if exists "dev anon update salad_map_state" on public.salad_map_state;
create policy "dev anon update salad_map_state"
  on public.salad_map_state for update
  to anon
  using (true)
  with check (true);
