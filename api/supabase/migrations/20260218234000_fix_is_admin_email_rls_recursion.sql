create or replace function public.is_admin_email()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users a
    where a.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and a.is_active = true
  );
$$;

revoke all on function public.is_admin_email() from public;
grant execute on function public.is_admin_email() to authenticated;
