-- Minimal disposable schema for testing the operational-table access migration.
-- The historical app migrations are not replayed here; this fixture isolates
-- the access-boundary migration from unrelated legacy migration drift.

create role anon;
create role authenticated;
create role service_role;

create table public.bookings (id uuid primary key, tenant_id uuid);
create table public.reviews (id uuid primary key, tenant_id uuid);
create table public.app_settings (id uuid primary key, tenant_id uuid);
create table public.tenant_availability (id uuid primary key, tenant_id uuid);
create table public.blocked_slots (id uuid primary key, tenant_id uuid);

grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public
to anon, authenticated;

create policy "Anyone can submit a booking"
  on public.bookings for insert to anon, authenticated with check (true);
create policy "Members can manage tenant bookings"
  on public.bookings for all to authenticated using (true) with check (true);

create policy "Anyone can submit a review"
  on public.reviews for insert to anon, authenticated with check (true);
create policy "Anyone can view approved reviews"
  on public.reviews for select to anon, authenticated using (true);
create policy "Members can manage tenant reviews"
  on public.reviews for all to authenticated using (true) with check (true);

create policy "Anyone can read app settings"
  on public.app_settings for select to anon, authenticated using (true);
create policy "Members can manage tenant settings"
  on public.app_settings for all to authenticated using (true) with check (true);

create policy "Members can manage tenant availability"
  on public.tenant_availability for all to authenticated using (true) with check (true);
create policy "Members can manage tenant blocks"
  on public.blocked_slots for all to authenticated using (true) with check (true);
