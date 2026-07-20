create extension if not exists pgcrypto;

create table if not exists public.allowed_admins (
  id uuid default gen_random_uuid(),
  email text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

alter table public.allowed_admins
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists email text,
  add column if not exists is_active boolean default true,
  add column if not exists created_at timestamptz default now();

update public.allowed_admins
set email = lower(btrim(email))
where email is not null;

delete from public.allowed_admins a
using public.allowed_admins b
where a.ctid < b.ctid
  and lower(coalesce(a.email, '')) = lower(coalesce(b.email, ''));

update public.allowed_admins
set id = gen_random_uuid()
where id is null;

update public.allowed_admins
set is_active = true
where is_active is null;

update public.allowed_admins
set created_at = now()
where created_at is null;

alter table public.allowed_admins
  alter column email set not null,
  alter column is_active set default true,
  alter column is_active set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

create unique index if not exists uq_allowed_admins_email on public.allowed_admins (email);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'allowed_admins_pkey'
      and conrelid = 'public.allowed_admins'::regclass
  ) then
    alter table public.allowed_admins add constraint allowed_admins_pkey primary key (id);
  end if;
end
$$;

insert into public.allowed_admins (email, is_active)
select lower(btrim(email)), coalesce(is_active, true)
from public.admin_users
where coalesce(btrim(email), '') <> ''
on conflict (email) do update
set is_active = excluded.is_active;

insert into public.admin_users (email, is_active)
select lower(btrim(email)), coalesce(is_active, true)
from public.allowed_admins
where coalesce(btrim(email), '') <> ''
on conflict (email) do update
set is_active = excluded.is_active;

create or replace function public.is_admin_email()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
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
$$;

revoke all on function public.is_admin_email() from public;
grant execute on function public.is_admin_email() to authenticated;

alter table public.allowed_admins enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'allowed_admins'
      and policyname = 'allowed_admins_self_read'
  ) then
    create policy allowed_admins_self_read on public.allowed_admins
    for select to authenticated
    using (email = lower(coalesce(auth.jwt() ->> 'email', '')));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'allowed_admins'
      and policyname = 'allowed_admins_admin_all'
  ) then
    create policy allowed_admins_admin_all on public.allowed_admins
    for all to authenticated
    using (public.is_admin_email())
    with check (public.is_admin_email());
  end if;
end
$$;
