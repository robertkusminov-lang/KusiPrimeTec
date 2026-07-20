alter table public.customers
  add column if not exists auth_user_id uuid null references auth.users(id) on delete set null,
  add column if not exists company_name text null,
  add column if not exists avatar_url text null,
  add column if not exists city text null,
  add column if not exists zip text null;

create unique index if not exists uq_customers_auth_user_id
  on public.customers(auth_user_id)
  where auth_user_id is not null;

update public.customers
set company_name = coalesce(nullif(btrim(company_name), ''), nullif(btrim(company), ''))
where coalesce(btrim(company_name), '') = ''
  and coalesce(btrim(company), '') <> '';

alter table public.tickets
  add column if not exists requester_user_id uuid null references auth.users(id) on delete set null;

create index if not exists idx_tickets_requester_user_id
  on public.tickets(requester_user_id, created_at desc);

alter table public.customers enable row level security;
alter table public.tickets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'customers_self_read'
  ) then
    create policy customers_self_read on public.customers
      for select
      to authenticated
      using (auth.uid() = auth_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'customers_self_update'
  ) then
    create policy customers_self_update on public.customers
      for update
      to authenticated
      using (auth.uid() = auth_user_id)
      with check (auth.uid() = auth_user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'tickets'
      and policyname = 'tickets_customer_read_own'
  ) then
    create policy tickets_customer_read_own on public.tickets
      for select
      to authenticated
      using (
        requester_user_id = auth.uid()
        or exists (
          select 1
          from public.customers c
          where c.id = tickets.customer_id
            and c.auth_user_id = auth.uid()
        )
      );
  end if;
end
$$;

