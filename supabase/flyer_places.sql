-- flyerApartments only: Supabase shared source for flyer distribution places.
-- Stores, salad data, KML data, CSV column specs, and existing localStorage backups are out of scope.
--
-- SECURITY NOTICE:
-- This policy is for development verification with an anon key.
-- Before production release, require authentication, design proper RLS policies,
-- and never operate with anonymous users able to read/update all rows.

create table if not exists public.flyer_places (
  id text primary key,
  name text,
  address text,
  latitude double precision,
  longitude double precision,
  status text,
  assignee text,
  distributed_at date,
  quantity integer,
  memo text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.flyer_places enable row level security;

-- Development-only anonymous access. Replace before production.
drop policy if exists "dev anon read flyer_places" on public.flyer_places;
create policy "dev anon read flyer_places"
  on public.flyer_places for select
  to anon
  using (true);

drop policy if exists "dev anon upsert flyer_places" on public.flyer_places;
create policy "dev anon upsert flyer_places"
  on public.flyer_places for insert
  to anon
  with check (true);

drop policy if exists "dev anon update flyer_places" on public.flyer_places;
create policy "dev anon update flyer_places"
  on public.flyer_places for update
  to anon
  using (true)
  with check (true);
