begin;
create extension if not exists pgtap with schema extensions;

select plan(3);

select is(
  (
    with protected_tables(table_name) as (
      values
        ('bookings'),
        ('reviews'),
        ('app_settings'),
        ('tenant_availability'),
        ('blocked_slots')
    ),
    client_roles(role_name) as (
      values ('anon'), ('authenticated')
    ),
    client_privileges(privilege_name) as (
      values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
    )
    select count(*)::bigint
    from protected_tables
    cross join client_roles
    cross join client_privileges
    where has_table_privilege(
      client_roles.role_name,
      format('public.%I', protected_tables.table_name),
      client_privileges.privilege_name
    )
  ),
  0::bigint,
  'anon and authenticated have no direct DML or read grants on operational tables'
);

select is(
  (
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'bookings',
        'reviews',
        'app_settings',
        'tenant_availability',
        'blocked_slots'
      )
  ),
  0::bigint,
  'operational tables have no direct API policies; access stays in server functions'
);

select is(
  (
    with protected_tables(table_name) as (
      values
        ('bookings'),
        ('reviews'),
        ('app_settings'),
        ('tenant_availability'),
        ('blocked_slots')
    ),
    server_privileges(privilege_name) as (
      values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
    )
    select count(*)::bigint
    from protected_tables
    cross join server_privileges
    where has_table_privilege(
      'service_role',
      format('public.%I', protected_tables.table_name),
      server_privileges.privilege_name
    )
  ),
  20::bigint,
  'server_role retains the required table operations'
);

select * from finish();
rollback;
