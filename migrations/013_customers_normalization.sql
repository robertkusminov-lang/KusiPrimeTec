create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_type text null,
  name text not null,
  company text null,
  email text null,
  phone text null,
  contact_person text null,
  source text null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.customers
  add column if not exists customer_type text null,
  add column if not exists name text,
  add column if not exists company text null,
  add column if not exists email text null,
  add column if not exists phone text null,
  add column if not exists contact_person text null,
  add column if not exists source text null default 'manual',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.customers
set name = coalesce(nullif(btrim(name), ''), 'Unbekannt')
where name is null or btrim(name) = '';

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
      and c.conname = 'customers_customer_type_check'
  ) then
    alter table public.customers
      add constraint customers_customer_type_check
      check (customer_type is null or customer_type in ('privat', 'gewerblich'));
  end if;
end
$$;

create unique index if not exists uq_customers_email_norm
  on public.customers ((lower(btrim(email))))
  where email is not null and btrim(email) <> '';

create unique index if not exists uq_customers_phone_name_norm
  on public.customers ((regexp_replace(phone, '[^0-9+]', '', 'g')), (lower(btrim(name))))
  where phone is not null and btrim(phone) <> ''
    and name is not null and btrim(name) <> '';

create index if not exists idx_customers_name on public.customers(name);
create index if not exists idx_customers_company on public.customers(company);
create index if not exists idx_customers_created_at on public.customers(created_at desc);

do $$
declare
  has_tickets boolean;
  col_id text;
  col_customer_type text;
  col_name text;
  col_company text;
  col_email text;
  col_phone text;
  col_contact text;
  customers_email_required boolean;
  expr_customer_type text;
  expr_name text;
  expr_company text;
  expr_email text;
  expr_email_or_placeholder text;
  expr_phone text;
  expr_contact text;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'tickets'
  ) into has_tickets;

  if not has_tickets then
    return;
  end if;

  select c.column_name into col_id
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'tickets' and c.column_name in ('id', 'ticket_id')
  order by case c.column_name when 'id' then 1 else 2 end
  limit 1;

  select c.column_name into col_customer_type
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'tickets' and c.column_name in ('customer_type', 'kunde_typ')
  order by case c.column_name when 'customer_type' then 1 else 2 end
  limit 1;

  select c.column_name into col_name
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'tickets' and c.column_name in ('kunde_name', 'customer_name', 'contact_name', 'name')
  order by case c.column_name when 'kunde_name' then 1 when 'customer_name' then 2 when 'contact_name' then 3 else 4 end
  limit 1;

  select c.column_name into col_company
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'tickets' and c.column_name in ('kunde_firma', 'company_name', 'customer_company', 'firma')
  order by case c.column_name when 'kunde_firma' then 1 when 'company_name' then 2 when 'customer_company' then 3 else 4 end
  limit 1;

  select c.column_name into col_email
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'tickets' and c.column_name in ('kunde_email', 'customer_email', 'email')
  order by case c.column_name when 'kunde_email' then 1 when 'customer_email' then 2 else 3 end
  limit 1;

  select c.column_name into col_phone
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'tickets' and c.column_name in ('kunde_telefon', 'customer_phone', 'telefon', 'phone')
  order by case c.column_name when 'kunde_telefon' then 1 when 'customer_phone' then 2 when 'telefon' then 3 else 4 end
  limit 1;

  select c.column_name into col_contact
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'tickets' and c.column_name in ('ansprechpartner', 'contact_person', 'contact_name')
  order by case c.column_name when 'ansprechpartner' then 1 when 'contact_person' then 2 else 3 end
  limit 1;

  select (coalesce(c.is_nullable, 'YES') = 'NO')
  into customers_email_required
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'customers'
    and c.column_name = 'email';

  execute 'alter table public.tickets add column if not exists customer_id uuid null';

  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'tickets'
      and c.conname = 'tickets_customer_id_fkey'
  ) then
    execute 'alter table public.tickets add constraint tickets_customer_id_fkey foreign key (customer_id) references public.customers(id) on delete set null';
  end if;

  execute 'create index if not exists idx_tickets_customer_id on public.tickets(customer_id)';
  execute 'create index if not exists idx_tickets_customer_id_created on public.tickets(customer_id, created_at desc)';

  execute 'comment on column public.tickets.customer_id is ''Referenz auf normalisierte Stammdaten in public.customers.''';
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tickets' and column_name = 'kunde_name') then
    execute 'comment on column public.tickets.kunde_name is ''Snapshot zum Ticketzeitpunkt (fuer Verlauf/Dokumente).''';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tickets' and column_name = 'kunde_firma') then
    execute 'comment on column public.tickets.kunde_firma is ''Snapshot zum Ticketzeitpunkt (fuer Verlauf/Dokumente).''';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tickets' and column_name = 'kunde_email') then
    execute 'comment on column public.tickets.kunde_email is ''Snapshot zum Ticketzeitpunkt (fuer Verlauf/Dokumente).''';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tickets' and column_name = 'kunde_telefon') then
    execute 'comment on column public.tickets.kunde_telefon is ''Snapshot zum Ticketzeitpunkt (fuer Verlauf/Dokumente).''';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tickets' and column_name = 'customer_type') then
    execute 'comment on column public.tickets.customer_type is ''Snapshot zum Ticketzeitpunkt (fuer Verlauf/Dokumente).''';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tickets' and column_name = 'ansprechpartner') then
    execute 'comment on column public.tickets.ansprechpartner is ''Snapshot zum Ticketzeitpunkt (fuer Verlauf/Dokumente).''';
  end if;

  expr_customer_type := case
    when col_customer_type is null then 'null::text'
    else format('nullif(btrim(t.%I), '''')', col_customer_type)
  end;
  expr_name := case
    when col_name is null then '''Unbekannt''::text'
    else format('coalesce(nullif(btrim(t.%I), ''''), ''Unbekannt'')', col_name)
  end;
  expr_company := case
    when col_company is null then 'null::text'
    else format('nullif(btrim(t.%I), '''')', col_company)
  end;
  expr_email := case
    when col_email is null then 'null::text'
    else format('nullif(lower(btrim(t.%I)), '''')', col_email)
  end;
  expr_email_or_placeholder := case
    when customers_email_required = true and col_id is not null and col_email is not null then
      format('coalesce(nullif(lower(btrim(t.%I)), ''''), ''ticket+'' || t.%I::text || ''@placeholder.local'')', col_email, col_id)
    when customers_email_required = true and col_id is not null then
      format('''ticket+'' || t.%I::text || ''@placeholder.local''', col_id)
    when customers_email_required = true then
      '''ticket+'' || gen_random_uuid()::text || ''@placeholder.local'''
    else
      expr_email
  end;
  expr_phone := case
    when col_phone is null then 'null::text'
    else format('nullif(regexp_replace(t.%I, ''[^0-9+]'', '''', ''g''), '''')', col_phone)
  end;
  expr_contact := case
    when col_contact is null then 'null::text'
    else format('nullif(btrim(t.%I), '''')', col_contact)
  end;

  if col_email is not null then
    begin
      execute format(
        $sql$
        insert into public.customers (customer_type, name, company, email, phone, contact_person, source)
        select
          %1$s as customer_type,
          %2$s as name,
          %3$s as company,
          nullif(lower(btrim(t.%4$I)), '') as email,
          %5$s as phone,
          %6$s as contact_person,
          'ticket_backfill_email' as source
        from public.tickets t
        where coalesce(btrim(t.%4$I), '') <> ''
          and not exists (
            select 1
            from public.customers c
            where coalesce(btrim(c.email), '') <> ''
              and lower(btrim(c.email)) = lower(btrim(t.%4$I))
          )
        $sql$,
        expr_customer_type,
        expr_name,
        expr_company,
        col_email,
        expr_phone,
        expr_contact
      );
    exception when others then
      null;
    end;
  end if;

  if col_phone is not null and col_name is not null then
    begin
      execute format(
        $sql$
        insert into public.customers (customer_type, name, company, email, phone, contact_person, source)
        select
          %1$s as customer_type,
          %2$s as name,
          %3$s as company,
          %4$s as email,
          %5$s as phone,
          %6$s as contact_person,
          'ticket_backfill_phone_name' as source
        from public.tickets t
        where coalesce(btrim(t.%7$I), '') <> ''
          and coalesce(btrim(t.%8$I), '') <> ''
          and not exists (
            select 1
            from public.customers c
            where coalesce(btrim(c.phone), '') <> ''
              and coalesce(btrim(c.name), '') <> ''
              and regexp_replace(c.phone, '[^0-9+]', '', 'g') = regexp_replace(t.%7$I, '[^0-9+]', '', 'g')
              and lower(btrim(c.name)) = lower(btrim(t.%8$I))
          )
        $sql$,
        expr_customer_type,
        expr_name,
        expr_company,
        expr_email_or_placeholder,
        expr_phone,
        expr_contact,
        col_phone,
        col_name
      );
    exception when others then
      null;
    end;
  end if;

  if col_email is not null then
    begin
      execute format(
        $sql$
        update public.tickets t
        set customer_id = c.id
        from public.customers c
        where t.customer_id is null
          and coalesce(btrim(t.%1$I), '') <> ''
          and coalesce(btrim(c.email), '') <> ''
          and lower(btrim(c.email)) = lower(btrim(t.%1$I))
        $sql$,
        col_email
      );
    exception when others then
      null;
    end;
  end if;

  if col_phone is not null and col_name is not null then
    begin
      execute format(
        $sql$
        update public.tickets t
        set customer_id = c.id
        from public.customers c
        where t.customer_id is null
          and coalesce(btrim(t.%1$I), '') <> ''
          and coalesce(btrim(t.%2$I), '') <> ''
          and coalesce(btrim(c.phone), '') <> ''
          and coalesce(btrim(c.name), '') <> ''
          and regexp_replace(c.phone, '[^0-9+]', '', 'g') = regexp_replace(t.%1$I, '[^0-9+]', '', 'g')
          and lower(btrim(c.name)) = lower(btrim(t.%2$I))
        $sql$,
        col_phone,
        col_name
      );
    exception when others then
      null;
    end;
  end if;

  if col_id is not null then
    begin
      execute format(
        $sql$
        insert into public.customers (customer_type, name, company, email, phone, contact_person, source)
        select
          %1$s as customer_type,
          %2$s as name,
          %3$s as company,
          %4$s as email,
          %5$s as phone,
          %6$s as contact_person,
          'ticket_fallback:' || t.%7$I::text as source
        from public.tickets t
        where t.customer_id is null
          and not exists (
            select 1
            from public.customers c
            where c.source = 'ticket_fallback:' || t.%7$I::text
          )
        $sql$,
        expr_customer_type,
        expr_name,
        expr_company,
        expr_email_or_placeholder,
        expr_phone,
        expr_contact,
        col_id
      );
    exception when others then
      null;
    end;

    begin
      execute format(
        $sql$
        update public.tickets t
        set customer_id = c.id
        from public.customers c
        where t.customer_id is null
          and c.source = 'ticket_fallback:' || t.%1$I::text
        $sql$,
        col_id
      );
    exception when others then
      null;
    end;
  end if;
end
$$;

alter table public.customers enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'customers'
      and policyname = 'customers_admin_all'
  ) then
    create policy customers_admin_all on public.customers
    for all to authenticated
    using (public.is_admin_email())
    with check (public.is_admin_email());
  end if;
end
$$;
