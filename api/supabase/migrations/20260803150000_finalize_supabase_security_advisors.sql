begin;

-- Admin membership only needs self-read access. Administrative writes are
-- performed with service_role, so browser sessions never need write policies on
-- the tables that decide who is an administrator.
drop policy if exists admin_users_select_authorized on public.admin_users;
drop policy if exists admin_users_insert_admin on public.admin_users;
drop policy if exists admin_users_update_admin on public.admin_users;
drop policy if exists admin_users_delete_admin on public.admin_users;
create policy admin_users_self_read
  on public.admin_users for select to authenticated
  using (email = lower(coalesce((select auth.jwt()) ->> 'email', '')));

drop policy if exists allowed_admins_select_authorized on public.allowed_admins;
drop policy if exists allowed_admins_insert_admin on public.allowed_admins;
drop policy if exists allowed_admins_update_admin on public.allowed_admins;
drop policy if exists allowed_admins_delete_admin on public.allowed_admins;
create policy allowed_admins_self_read
  on public.allowed_admins for select to authenticated
  using (email = lower(coalesce((select auth.jwt()) ->> 'email', '')));

-- With non-recursive self-read policies in place, the predicate no longer needs
-- owner privileges. It evaluates as the authenticated caller and can only see
-- that caller's own allow-list rows.
create or replace function public.is_admin_email()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select
    exists (
      select 1
      from public.admin_users a
      where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
        and coalesce(a.is_active, true) = true
    )
    or
    exists (
      select 1
      from public.allowed_admins aa
      where aa.email = lower(coalesce(auth.jwt() ->> 'email', ''))
        and coalesce(aa.is_active, true) = true
    );
$function$;

revoke execute on function public.is_admin_email() from public, anon;
grant execute on function public.is_admin_email() to authenticated, service_role;

-- This exact duplicate was the sole remaining RLS init-plan warning.
drop policy if exists customers_self_update on public.customers;

commit;
