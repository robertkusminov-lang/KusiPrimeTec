alter table public.customers
  add column if not exists invoice_recipient_name text null,
  add column if not exists company_name text null,
  add column if not exists billing_address_street text null,
  add column if not exists billing_address_zip text null,
  add column if not exists billing_address_city text null,
  add column if not exists notes text null;

-- Alte customer_type-Checks zuerst entfernen, damit die Daten frei normalisiert werden koennen.
do $$
begin
  if exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'customers'
      and c.conname = 'customers_customer_type_check'
  ) then
    alter table public.customers drop constraint customers_customer_type_check;
  end if;
end
$$;

update public.customers
set customer_type = 'firma'
where lower(btrim(coalesce(customer_type, ''))) in (
  'gewerblich', 'gewerbe', 'unternehmen', 'company', 'business', 'b2b'
);

update public.tickets
set customer_type = 'firma'
where lower(btrim(coalesce(customer_type, ''))) in (
  'gewerblich', 'gewerbe', 'unternehmen', 'company', 'business', 'b2b'
);

update public.customers
set
  company_name = coalesce(nullif(btrim(company_name), ''), nullif(btrim(company), '')),
  name = coalesce(nullif(btrim(name), ''), nullif(btrim(invoice_recipient_name), ''), nullif(btrim(company_name), ''), 'Kunde');

update public.customers
set invoice_recipient_name = coalesce(
  nullif(btrim(invoice_recipient_name), ''),
  case
    when customer_type = 'firma' then coalesce(nullif(btrim(company_name), ''), nullif(btrim(company), ''))
    else nullif(btrim(name), '')
  end,
  nullif(btrim(name), ''),
  nullif(btrim(company_name), ''),
  nullif(btrim(company), ''),
  'Kunde'
);

update public.customers
set
  name = left(regexp_replace(regexp_replace(coalesce(name, ''), '<[^>]*>', ' ', 'g'), '[[:cntrl:]]', ' ', 'g'), 140),
  company_name = left(regexp_replace(regexp_replace(coalesce(company_name, ''), '<[^>]*>', ' ', 'g'), '[[:cntrl:]]', ' ', 'g'), 140),
  invoice_recipient_name = left(regexp_replace(regexp_replace(coalesce(invoice_recipient_name, ''), '<[^>]*>', ' ', 'g'), '[[:cntrl:]]', ' ', 'g'), 140),
  contact_person = nullif(left(regexp_replace(regexp_replace(coalesce(contact_person, ''), '<[^>]*>', ' ', 'g'), '[[:cntrl:]]', ' ', 'g'), 140), ''),
  email = nullif(lower(btrim(email)), ''),
  phone = nullif(regexp_replace(coalesce(phone, ''), '[^0-9+]', '', 'g'), '');

update public.customers
set company_name = nullif(btrim(company_name), ''),
    invoice_recipient_name = nullif(btrim(invoice_recipient_name), ''),
    name = nullif(btrim(name), ''),
    contact_person = nullif(btrim(contact_person), ''),
    billing_address_street = nullif(btrim(billing_address_street), ''),
    billing_address_zip = nullif(btrim(billing_address_zip), ''),
    billing_address_city = nullif(btrim(billing_address_city), '');

update public.customers
set name = coalesce(name, invoice_recipient_name, company_name, 'Kunde');

update public.customers
set invoice_recipient_name = coalesce(invoice_recipient_name, name, company_name, 'Kunde');

update public.customers
set company_name = coalesce(company_name, company)
where customer_type = 'firma'
  and coalesce(nullif(btrim(company_name), ''), nullif(btrim(company), '')) is not null;

-- Vor dem Constraint alle Restwerte auf das erlaubte Modell normalisieren.
update public.customers
set customer_type = case
  when lower(btrim(coalesce(customer_type, ''))) in (
    'firma', 'gewerblich', 'gewerbe', 'unternehmen', 'company', 'business', 'b2b'
  ) then 'firma'
  when lower(btrim(coalesce(customer_type, ''))) in ('privat', 'private', 'privatkunde', 'kunde') then 'privat'
  when coalesce(btrim(customer_type), '') = '' then null
  else null
end
where customer_type is distinct from case
  when lower(btrim(coalesce(customer_type, ''))) in (
    'firma', 'gewerblich', 'gewerbe', 'unternehmen', 'company', 'business', 'b2b'
  ) then 'firma'
  when lower(btrim(coalesce(customer_type, ''))) in ('privat', 'private', 'privatkunde', 'kunde') then 'privat'
  when coalesce(btrim(customer_type), '') = '' then null
  else null
end;

-- Doppelte Telefonnummern neutralisieren, damit ein eindeutiger Index gesetzt werden kann.
with ranked as (
  select
    id,
    regexp_replace(phone, '[^0-9+]', '', 'g') as phone_norm,
    row_number() over (
      partition by regexp_replace(phone, '[^0-9+]', '', 'g')
      order by created_at asc, id asc
    ) as rn
  from public.customers
  where phone is not null
    and btrim(phone) <> ''
)
update public.customers c
set phone = null
from ranked r
where c.id = r.id
  and r.phone_norm <> ''
  and r.rn > 1;

do $$
begin
  if exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'customers'
      and c.conname = 'customers_customer_type_check'
  ) then
    alter table public.customers drop constraint customers_customer_type_check;
  end if;

  alter table public.customers
    add constraint customers_customer_type_check
    check (customer_type is null or customer_type in ('privat', 'firma'));
end
$$;

alter table public.customers
  alter column name set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'customers'
      and c.conname = 'customers_company_required_for_firma'
  ) then
    alter table public.customers
      add constraint customers_company_required_for_firma
      check (customer_type <> 'firma' or coalesce(btrim(company_name), '') <> '');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'customers'
      and c.conname = 'customers_invoice_recipient_required'
  ) then
    alter table public.customers
      add constraint customers_invoice_recipient_required
      check (coalesce(btrim(invoice_recipient_name), '') <> '');
  end if;
end
$$;

drop index if exists public.uq_customers_phone_name_norm;

create unique index if not exists uq_customers_phone_norm
  on public.customers ((regexp_replace(phone, '[^0-9+]', '', 'g')))
  where phone is not null and btrim(phone) <> '';

create index if not exists idx_customers_company_name on public.customers(company_name);
create index if not exists idx_customers_invoice_recipient_name on public.customers(invoice_recipient_name);

alter table public.tickets
  add column if not exists invoice_recipient_name text null,
  add column if not exists customer_display_name text null;

update public.tickets t
set
  invoice_recipient_name = coalesce(
    nullif(btrim(t.invoice_recipient_name), ''),
    nullif(btrim(c.invoice_recipient_name), ''),
    case
      when coalesce(t.customer_type, c.customer_type) = 'firma'
        then coalesce(nullif(btrim(t.kunde_firma), ''), nullif(btrim(c.company_name), ''), nullif(btrim(c.company), ''))
      else coalesce(nullif(btrim(t.kunde_name), ''), nullif(btrim(c.name), ''))
    end
  ),
  customer_display_name = coalesce(
    nullif(btrim(t.customer_display_name), ''),
    case
      when coalesce(t.customer_type, c.customer_type) = 'firma'
        then coalesce(nullif(btrim(t.kunde_firma), ''), nullif(btrim(c.company_name), ''), nullif(btrim(c.company), ''), nullif(btrim(c.name), ''))
      else coalesce(
        nullif(btrim(t.invoice_recipient_name), ''),
        nullif(btrim(c.invoice_recipient_name), ''),
        nullif(btrim(t.kunde_name), ''),
        nullif(btrim(c.name), ''),
        nullif(btrim(t.kunde_firma), ''),
        nullif(btrim(c.company_name), '')
      )
    end
  )
from public.customers c
where t.customer_id = c.id;

update public.tickets
set
  invoice_recipient_name = coalesce(
    nullif(btrim(invoice_recipient_name), ''),
    case
      when customer_type = 'firma' then nullif(btrim(kunde_firma), '')
      else nullif(btrim(kunde_name), '')
    end
  ),
  customer_display_name = coalesce(
    nullif(btrim(customer_display_name), ''),
    case
      when customer_type = 'firma' then coalesce(nullif(btrim(kunde_firma), ''), nullif(btrim(kunde_name), ''))
      else coalesce(nullif(btrim(invoice_recipient_name), ''), nullif(btrim(kunde_name), ''), nullif(btrim(kunde_firma), ''))
    end
  )
where customer_id is null;

create index if not exists idx_tickets_customer_bucket_created
  on public.tickets (customer_id, bucket, created_at desc);
