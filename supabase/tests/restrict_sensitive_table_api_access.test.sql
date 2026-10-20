do $$
declare
  client_grant_count bigint;
  policy_count bigint;
  service_grant_count bigint;
begin
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
  into client_grant_count
  from protected_tables
  cross join client_roles
  cross join client_privileges
  where has_table_privilege(
    client_roles.role_name,
    format('public.%I', protected_tables.table_name),
    client_privileges.privilege_name
  );

  if client_grant_count <> 0 then
    raise exception 'Expected zero client table grants, found %', client_grant_count;
  end if;

  select count(*)::bigint
  into policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'bookings',
      'reviews',
      'app_settings',
      'tenant_availability',
      'blocked_slots'
    );

  if policy_count <> 0 then
    raise exception 'Expected zero operational-table policies, found %', policy_count;
  end if;

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
  into service_grant_count
  from protected_tables
  cross join server_privileges
  where has_table_privilege(
    'service_role',
    format('public.%I', protected_tables.table_name),
    server_privileges.privilege_name
  );

  if service_grant_count <> 20 then
    raise exception 'Expected 20 service-role table grants, found %', service_grant_count;
  end if;

  raise notice 'PASS: client grants revoked, direct policies removed, service-role grants retained';
end;
$$;
