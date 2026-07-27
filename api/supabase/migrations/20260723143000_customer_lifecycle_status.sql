alter table public.customers
  add column if not exists status text not null default 'active',
  add column if not exists archived_at timestamptz null;

update public.customers
set status = case
  when lower(btrim(status)) in ('archived', 'archiviert') then 'archived'
  when lower(btrim(status)) in ('inactive', 'inaktiv') then 'inactive'
  when lower(btrim(status)) in ('prospect', 'interessent') then 'prospect'
  else 'active'
end
where status is null
   or lower(btrim(status)) not in ('active', 'prospect', 'inactive', 'archived');

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'customers'
      and c.conname = 'customers_status_check'
  ) then
    alter table public.customers
      add constraint customers_status_check
      check (status in ('active', 'prospect', 'inactive', 'archived'));
  end if;
end
$$;

create index if not exists idx_customers_status_updated
  on public.customers(status, updated_at desc);
