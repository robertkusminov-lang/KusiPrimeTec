create extension if not exists pgcrypto;

alter table if exists public.tickets
  add column if not exists customer_id uuid null;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'tickets'
  ) and exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'customers'
  ) and not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'tickets'
      and c.conname = 'tickets_customer_id_fkey'
  ) then
    alter table public.tickets
      add constraint tickets_customer_id_fkey
      foreign key (customer_id)
      references public.customers(id)
      on delete set null;
  end if;
end
$$;

create index if not exists idx_tickets_bucket_created_desc
  on public.tickets(bucket, created_at desc);

create index if not exists idx_tickets_status_updated_desc
  on public.tickets(status, updated_at desc);

create index if not exists idx_tickets_customer_id
  on public.tickets(customer_id);

create unique index if not exists uq_customers_email_norm
  on public.customers((lower(btrim(email))))
  where email is not null and btrim(email) <> '';

create index if not exists idx_customers_phone_norm
  on public.customers((regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g')));

create index if not exists idx_customers_name_norm
  on public.customers((lower(btrim(name))));

create table if not exists public.status_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  old_status text null,
  new_status text not null,
  changed_by text not null default 'system',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_status_history_ticket_created
  on public.status_history(ticket_id, created_at desc);

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  event_type text not null,
  detail text not null,
  actor text not null default 'system',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_timeline_events_ticket_created
  on public.timeline_events(ticket_id, created_at desc);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  document_number text unique null,
  status text not null default 'draft',
  total_amount numeric(12,2) not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  document_number text unique null,
  status text not null default 'draft',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  document_number text unique null,
  status text not null default 'draft',
  total_amount numeric(12,2) not null default 0,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_offers_ticket_created
  on public.offers(ticket_id, created_at desc);

create index if not exists idx_reports_ticket_created
  on public.reports(ticket_id, created_at desc);

create index if not exists idx_invoices_ticket_created
  on public.invoices(ticket_id, created_at desc);

create or replace view public.ticket_admin_view as
select
  t.*,
  coalesce(nullif(btrim(c.name), ''), nullif(btrim(t.contact_person), ''), nullif(btrim(t.ansprechpartner), '')) as customer_name,
  coalesce(nullif(btrim(c.company), ''), nullif(btrim(c.company_name), ''), nullif(btrim(t.company_name), '')) as customer_company,
  coalesce(nullif(btrim(c.email), ''), nullif(btrim(t.email), '')) as customer_email,
  coalesce(nullif(btrim(c.phone), ''), nullif(btrim(t.phone), '')) as customer_phone,
  coalesce(nullif(btrim(c.contact_person), ''), nullif(btrim(t.contact_person), ''), nullif(btrim(t.ansprechpartner), '')) as customer_contact_person,
  coalesce(nullif(btrim(c.customer_type), ''), nullif(btrim(t.customer_type), '')) as customer_type_normalized
from public.tickets t
left join public.customers c on c.id = t.customer_id;
