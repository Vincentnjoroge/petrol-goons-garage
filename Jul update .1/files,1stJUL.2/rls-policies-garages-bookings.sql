-- ============================================================
-- RLS: garages
-- ============================================================
-- Assumes: garages(id uuid pk, owner_id uuid references profiles(id),
--                   name text, is_verified boolean default false, ...)

alter table public.garages enable row level security;

-- Anyone (anonymous or logged in) can read garages that are verified.
-- This is what fixes the "empty listing" problem for new/logged-out users.
drop policy if exists "Public can read verified garages" on public.garages;
create policy "Public can read verified garages"
  on public.garages for select
  to anon, authenticated
  using (is_verified = true);

-- Owners can always see their own garage, verified or not
-- (otherwise a garage owner can't see their own listing while it's pending review).
drop policy if exists "Owners can read own garage" on public.garages;
create policy "Owners can read own garage"
  on public.garages for select
  to authenticated
  using (owner_id = auth.uid());

-- Owners have full create/update/delete rights, but ONLY on their own rows.
drop policy if exists "Owners manage own garage" on public.garages;
create policy "Owners manage own garage"
  on public.garages for all
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ============================================================
-- RLS: bookings
-- ============================================================
-- Assumes: bookings(id uuid pk, car_owner_id uuid references profiles(id),
--                    garage_id uuid references garages(id),
--                    status text, ...)

alter table public.bookings enable row level security;

-- Car owners can see and manage their own bookings.
drop policy if exists "Car owners manage own bookings" on public.bookings;
create policy "Car owners manage own bookings"
  on public.bookings for all
  to authenticated
  using (car_owner_id = auth.uid())
  with check (car_owner_id = auth.uid());

-- Garage owners can see and manage bookings made against garages they own.
-- (No direct owner_id column on bookings, so this checks via a subquery
--  against garages they own — keep an index on garages.owner_id for this.)
drop policy if exists "Garage owners manage bookings for their garage" on public.bookings;
create policy "Garage owners manage bookings for their garage"
  on public.bookings for all
  to authenticated
  using (
    garage_id in (
      select id from public.garages where owner_id = auth.uid()
    )
  )
  with check (
    garage_id in (
      select id from public.garages where owner_id = auth.uid()
    )
  );

-- Helpful index for the subquery above
create index if not exists idx_garages_owner_id on public.garages (owner_id);
create index if not exists idx_bookings_garage_id on public.bookings (garage_id);
create index if not exists idx_bookings_car_owner_id on public.bookings (car_owner_id);
