-- These tables are accessed by server functions with the service_role key.
-- Public clients must use those validated flows instead of writing directly
-- through the Data API (which would bypass booking, moderation and audit logic).
grant select, insert, update, delete on table
  public.bookings,
  public.reviews,
  public.app_settings,
  public.tenant_availability,
  public.blocked_slots
to service_role;

revoke all privileges on table
  public.bookings,
  public.reviews,
  public.app_settings,
  public.tenant_availability,
  public.blocked_slots
from anon, authenticated;

-- Without client table grants these policies are already unreachable. Remove
-- them as defense in depth, so a later accidental grant does not re-enable a
-- direct public/member path around the server-owned lifecycle.
drop policy if exists "Anyone can submit a booking" on public.bookings;
drop policy if exists "Members can manage tenant bookings" on public.bookings;

drop policy if exists "Anyone can submit a review" on public.reviews;
drop policy if exists "Anyone can view approved reviews" on public.reviews;
drop policy if exists "Members can manage tenant reviews" on public.reviews;

drop policy if exists "Anyone can read app settings" on public.app_settings;
drop policy if exists "Members can manage tenant settings" on public.app_settings;

drop policy if exists "Members can manage tenant availability" on public.tenant_availability;
drop policy if exists "Members can manage tenant blocks" on public.blocked_slots;
