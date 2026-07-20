create extension if not exists pgcrypto;

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

create index if not exists idx_offers_ticket on public.offers(ticket_id, created_at desc);
create index if not exists idx_reports_ticket on public.reports(ticket_id, created_at desc);
create index if not exists idx_invoices_ticket on public.invoices(ticket_id, created_at desc);

drop trigger if exists trg_offers_touch on public.offers;
create trigger trg_offers_touch
before update on public.offers
for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_reports_touch on public.reports;
create trigger trg_reports_touch
before update on public.reports
for each row execute procedure public.touch_updated_at();

drop trigger if exists trg_invoices_touch on public.invoices;
create trigger trg_invoices_touch
before update on public.invoices
for each row execute procedure public.touch_updated_at();

create table if not exists public.ticket_number_sequences (
  day date primary key,
  next_value integer not null default 1,
  updated_at timestamptz not null default now()
);

create or replace function public.next_ticket_number_v2()
returns text
language plpgsql
as $$
declare
  d date := now()::date;
  v integer;
begin
  insert into public.ticket_number_sequences(day, next_value)
  values (d, 1)
  on conflict (day) do nothing;

  update public.ticket_number_sequences
  set next_value = next_value + 1,
      updated_at = now()
  where day = d
  returning next_value - 1 into v;

  return format('KPT-%s-%s', to_char(d, 'YYYYMMDD'), lpad(v::text, 4, '0'));
end;
$$;

alter table public.tickets add column if not exists ticket_number text;
update public.tickets
set ticket_number = coalesce(nullif(ticket_number, ''), nullif(ticket_nummer, ''))
where coalesce(ticket_number, '') = '';

with missing as (
  select
    id,
    format(
      'KPT-%s-%s',
      to_char(coalesce(created_at, now()), 'YYYYMMDD'),
      lpad(row_number() over (
        partition by to_char(coalesce(created_at, now()), 'YYYYMMDD')
        order by coalesce(created_at, now()), id
      )::text, 4, '0')
    ) as generated_number
  from public.tickets
  where coalesce(ticket_number, '') = ''
)
update public.tickets t
set ticket_number = m.generated_number
from missing m
where t.id = m.id;

create unique index if not exists uq_tickets_ticket_number on public.tickets(ticket_number);
alter table public.tickets alter column ticket_number set default public.next_ticket_number_v2();

do $$
declare
  has_customer_id boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'tickets' and column_name = 'customer_id'
  ) into has_customer_id;

  if not has_customer_id then
    alter table public.tickets add column customer_id uuid null;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'tickets' and column_name = 'kunde_email'
  ) then
    insert into public.customers (name, company, email, phone, customer_type, contact_person, source)
    select
      coalesce(nullif(btrim(kunde_name), ''), 'Unbekannt'),
      nullif(btrim(kunde_firma), ''),
      lower(nullif(btrim(kunde_email), '')),
      nullif(regexp_replace(kunde_telefon, '[^0-9+]', '', 'g'), ''),
      nullif(btrim(customer_type), ''),
      nullif(btrim(ansprechpartner), ''),
      'ticket_migration_email'
    from public.tickets t
    where coalesce(btrim(kunde_email), '') <> ''
      and not exists (
        select 1 from public.customers c
        where lower(coalesce(c.email, '')) = lower(coalesce(t.kunde_email, ''))
      );

    update public.tickets t
    set customer_id = c.id
    from public.customers c
    where t.customer_id is null
      and coalesce(btrim(t.kunde_email), '') <> ''
      and lower(coalesce(c.email, '')) = lower(coalesce(t.kunde_email, ''));
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'tickets' and column_name = 'kunde_name'
  ) then
    insert into public.customers (name, company, email, phone, customer_type, contact_person, source)
    select
      coalesce(nullif(btrim(kunde_name), ''), 'Unbekannt'),
      nullif(btrim(kunde_firma), ''),
      null,
      nullif(regexp_replace(kunde_telefon, '[^0-9+]', '', 'g'), ''),
      nullif(btrim(customer_type), ''),
      nullif(btrim(ansprechpartner), ''),
      'ticket_migration_phone_name'
    from public.tickets t
    where t.customer_id is null
      and coalesce(btrim(kunde_name), '') <> ''
      and coalesce(btrim(kunde_telefon), '') <> ''
      and not exists (
        select 1 from public.customers c
        where lower(coalesce(c.name, '')) = lower(coalesce(t.kunde_name, ''))
          and regexp_replace(coalesce(c.phone, ''), '[^0-9+]', '', 'g') = regexp_replace(coalesce(t.kunde_telefon, ''), '[^0-9+]', '', 'g')
      );

    update public.tickets t
    set customer_id = c.id
    from public.customers c
    where t.customer_id is null
      and coalesce(btrim(t.kunde_name), '') <> ''
      and coalesce(btrim(t.kunde_telefon), '') <> ''
      and lower(coalesce(c.name, '')) = lower(coalesce(t.kunde_name, ''))
      and regexp_replace(coalesce(c.phone, ''), '[^0-9+]', '', 'g') = regexp_replace(coalesce(t.kunde_telefon, ''), '[^0-9+]', '', 'g');
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'tickets' and column_name = 'id'
  ) then
    insert into public.customers (name, email, source)
    select 'Unbekannt', format('ticket+%s@placeholder.local', t.id::text), format('ticket_fallback:%s', t.id::text)
    from public.tickets t
    where t.customer_id is null
      and not exists (
        select 1 from public.customers c where c.source = format('ticket_fallback:%s', t.id::text)
      );

    update public.tickets t
    set customer_id = c.id
    from public.customers c
    where t.customer_id is null
      and c.source = format('ticket_fallback:%s', t.id::text);
  end if;
end
$$;

alter table public.customers alter column email drop not null;
drop index if exists uq_customers_email_norm;
create unique index if not exists uq_customers_email_norm
  on public.customers((lower(btrim(email))))
  where email is not null and btrim(email) <> '';

alter table public.tickets
  alter column customer_id set not null;

do $$
begin
  if not exists (
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
      foreign key (customer_id) references public.customers(id) on delete restrict;
  end if;
end
$$;

insert into public.status_history(ticket_id, old_status, new_status, changed_by, metadata, created_at)
select t.id, null, coalesce(nullif(t.status, ''), 'Neu'), 'migration', '{"source":"ticket_snapshot"}'::jsonb, coalesce(t.created_at, now())
from public.tickets t
where not exists (
  select 1 from public.status_history s where s.ticket_id = t.id
);

insert into public.timeline_events(ticket_id, event_type, detail, actor, metadata, created_at)
select t.id, 'created', 'Ticket angelegt', 'migration', '{"source":"ticket_snapshot"}'::jsonb, coalesce(t.created_at, now())
from public.tickets t
where not exists (
  select 1 from public.timeline_events e where e.ticket_id = t.id
);

insert into public.offers(ticket_id, document_number, status, total_amount, data, created_at, updated_at)
select d.ticket_id, d.dokument_nummer, coalesce(d.status, 'draft'), coalesce((d.data->>'gesamt')::numeric, 0), coalesce(d.data, '{}'::jsonb), d.created_at, coalesce(d.updated_at, d.created_at)
from public.ticket_documents d
where d.dokument_typ = 'angebot'
  and not exists (select 1 from public.offers o where o.ticket_id = d.ticket_id and coalesce(o.document_number, '') = coalesce(d.dokument_nummer, ''));

insert into public.reports(ticket_id, document_number, status, data, created_at, updated_at)
select d.ticket_id, d.dokument_nummer, coalesce(d.status, 'draft'), coalesce(d.data, '{}'::jsonb), d.created_at, coalesce(d.updated_at, d.created_at)
from public.ticket_documents d
where d.dokument_typ = 'rapport'
  and not exists (select 1 from public.reports r where r.ticket_id = d.ticket_id and coalesce(r.document_number, '') = coalesce(d.dokument_nummer, ''));

insert into public.invoices(ticket_id, document_number, status, total_amount, data, created_at, updated_at)
select d.ticket_id, d.dokument_nummer, coalesce(d.status, 'draft'), coalesce((d.data->>'gesamt')::numeric, 0), coalesce(d.data, '{}'::jsonb), d.created_at, coalesce(d.updated_at, d.created_at)
from public.ticket_documents d
where d.dokument_typ = 'rechnung'
  and not exists (select 1 from public.invoices i where i.ticket_id = d.ticket_id and coalesce(i.document_number, '') = coalesce(d.dokument_nummer, ''));

create or replace function public.log_ticket_status_changes()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.status_history(ticket_id, old_status, new_status, changed_by, metadata, created_at)
    values (new.id, null, coalesce(new.status, 'Neu'), 'system', '{"trigger":"ticket_insert"}'::jsonb, now());
    insert into public.timeline_events(ticket_id, event_type, detail, actor, metadata, created_at)
    values (new.id, 'created', 'Ticket angelegt', 'system', '{"trigger":"ticket_insert"}'::jsonb, now());
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if coalesce(new.status, '') <> coalesce(old.status, '') then
      insert into public.status_history(ticket_id, old_status, new_status, changed_by, metadata, created_at)
      values (new.id, old.status, new.status, 'system', '{"trigger":"ticket_update"}'::jsonb, now());
      insert into public.timeline_events(ticket_id, event_type, detail, actor, metadata, created_at)
      values (new.id, 'status_changed', format('Status: %s -> %s', coalesce(old.status, '-'), coalesce(new.status, '-')), 'system', '{"trigger":"ticket_update"}'::jsonb, now());
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_tickets_status_tracking on public.tickets;
create trigger trg_tickets_status_tracking
after insert or update on public.tickets
for each row execute procedure public.log_ticket_status_changes();

alter table public.status_history enable row level security;
alter table public.timeline_events enable row level security;
alter table public.offers enable row level security;
alter table public.reports enable row level security;
alter table public.invoices enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='status_history' and policyname='status_history_admin_all') then
    create policy status_history_admin_all on public.status_history for all to authenticated using (public.is_admin_email()) with check (public.is_admin_email());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='timeline_events' and policyname='timeline_events_admin_all') then
    create policy timeline_events_admin_all on public.timeline_events for all to authenticated using (public.is_admin_email()) with check (public.is_admin_email());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='offers' and policyname='offers_admin_all') then
    create policy offers_admin_all on public.offers for all to authenticated using (public.is_admin_email()) with check (public.is_admin_email());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reports' and policyname='reports_admin_all') then
    create policy reports_admin_all on public.reports for all to authenticated using (public.is_admin_email()) with check (public.is_admin_email());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='invoices' and policyname='invoices_admin_all') then
    create policy invoices_admin_all on public.invoices for all to authenticated using (public.is_admin_email()) with check (public.is_admin_email());
  end if;
end
$$;

alter table public.tickets drop column if exists kunde_name;
alter table public.tickets drop column if exists kunde_firma;
alter table public.tickets drop column if exists kunde_email;
alter table public.tickets drop column if exists kunde_telefon;
alter table public.tickets drop column if exists customer_type;
alter table public.tickets drop column if exists ansprechpartner;
