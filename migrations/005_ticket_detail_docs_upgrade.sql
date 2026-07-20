create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'tickets'
  ) then
    execute $sql$
      create table if not exists public.ticket_events (
        id uuid primary key default gen_random_uuid(),
        ticket_id uuid not null references public.tickets(id) on delete cascade,
        event_typ text not null,
        detail text not null,
        actor text not null,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      )
    $sql$;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'ticket_events'
  ) then
    alter table public.ticket_events add column if not exists event_typ text;
    alter table public.ticket_events add column if not exists detail text;
    alter table public.ticket_events add column if not exists actor text;
    alter table public.ticket_events add column if not exists metadata jsonb default '{}'::jsonb;
    alter table public.ticket_events add column if not exists created_at timestamptz default now();
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'tickets'
  ) then
    alter table public.tickets add column if not exists internal_note text null;
    alter table public.tickets add column if not exists customer_type text null;
    alter table public.tickets add column if not exists ansprechpartner text null;
    alter table public.tickets add column if not exists objekt_strasse text null;
    alter table public.tickets add column if not exists objekt_plz text null;
    alter table public.tickets add column if not exists objekt_ort text null;
    alter table public.tickets add column if not exists access_notes text null;
    alter table public.tickets add column if not exists distanz_km numeric(8,2) null;
    alter table public.tickets add column if not exists outside_service_area boolean not null default false;

    update public.tickets
    set customer_type = case
      when customer_type is null then null
      when btrim(customer_type) = '' then null
      when lower(btrim(customer_type)) in ('gewerblich', 'gewerbe', 'firma', 'unternehmen', 'business', 'company', 'b2b') then 'gewerblich'
      when lower(btrim(customer_type)) in ('privat', 'privatkunde', 'privatperson', 'private', 'b2c') then 'privat'
      else null
    end;

    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where c.conname = 'tickets_customer_type_check'
        and n.nspname = 'public'
        and t.relname = 'tickets'
    ) then
      alter table public.tickets
        add constraint tickets_customer_type_check
        check (customer_type is null or customer_type in ('privat', 'gewerblich'));
    end if;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'ticket_attachments'
  ) then
    alter table public.ticket_attachments add column if not exists storage_url text null;
  end if;
end
$$;

do $$
declare
  has_ticket_id boolean;
  has_id boolean;
  has_doc_type boolean;
  has_created_at boolean;
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'ticket_documents'
  ) then
    alter table public.ticket_documents add column if not exists status text not null default 'entwurf';
    alter table public.ticket_documents add column if not exists data jsonb not null default '{}'::jsonb;
    alter table public.ticket_documents add column if not exists html_snapshot text null;
    alter table public.ticket_documents add column if not exists updated_at timestamptz not null default now();
    alter table public.ticket_documents add column if not exists dokument_typ text null;
    alter table public.ticket_documents add column if not exists dokument_nummer text null;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'ticket_documents' and column_name = 'document_type'
    ) then
      execute 'update public.ticket_documents set dokument_typ = coalesce(dokument_typ, document_type)';
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'ticket_documents' and column_name = 'doc_type'
    ) then
      execute 'update public.ticket_documents set dokument_typ = coalesce(dokument_typ, doc_type)';
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'ticket_documents' and column_name = 'type'
    ) then
      execute 'update public.ticket_documents set dokument_typ = coalesce(dokument_typ, type)';
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'ticket_documents' and column_name = 'typ'
    ) then
      execute 'update public.ticket_documents set dokument_typ = coalesce(dokument_typ, typ)';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'ticket_documents' and column_name = 'document_number'
    ) then
      execute 'update public.ticket_documents set dokument_nummer = coalesce(dokument_nummer, document_number)';
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'ticket_documents' and column_name = 'number'
    ) then
      execute 'update public.ticket_documents set dokument_nummer = coalesce(dokument_nummer, number)';
    elsif exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'ticket_documents' and column_name = 'nummer'
    ) then
      execute 'update public.ticket_documents set dokument_nummer = coalesce(dokument_nummer, nummer)';
    end if;

    update public.ticket_documents
    set dokument_typ = case
      when lower(coalesce(dokument_typ, '')) in ('angebot', 'offer', 'ang') then 'angebot'
      when lower(coalesce(dokument_typ, '')) in ('rapport', 'report', 'rap') then 'rapport'
      when lower(coalesce(dokument_typ, '')) in ('rechnung', 'invoice', 'inv', 're') then 'rechnung'
      when coalesce(dokument_nummer, '') ilike 'ANG-%' then 'angebot'
      when coalesce(dokument_nummer, '') ilike 'RAP-%' then 'rapport'
      when coalesce(dokument_nummer, '') ilike 'RE-%' then 'rechnung'
      else dokument_typ
    end;

    update public.ticket_documents
    set status = coalesce(nullif(status, ''), 'entwurf')
    where status is null or status = '';

    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'ticket_documents' and column_name = 'ticket_id'
    ) into has_ticket_id;
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'ticket_documents' and column_name = 'id'
    ) into has_id;
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'ticket_documents' and column_name = 'dokument_typ'
    ) into has_doc_type;
    select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'ticket_documents' and column_name = 'created_at'
    ) into has_created_at;

    if has_ticket_id and has_doc_type then
      if has_id and has_created_at then
        execute $sql$
          with ranked as (
            select id, row_number() over (
              partition by ticket_id, coalesce(dokument_typ, 'unbekannt')
              order by created_at desc nulls last, id desc
            ) as rn
            from public.ticket_documents
          )
          delete from public.ticket_documents d
          using ranked r
          where d.id = r.id and r.rn > 1
        $sql$;
      elsif has_id then
        execute $sql$
          with ranked as (
            select id, row_number() over (
              partition by ticket_id, coalesce(dokument_typ, 'unbekannt')
              order by id desc
            ) as rn
            from public.ticket_documents
          )
          delete from public.ticket_documents d
          using ranked r
          where d.id = r.id and r.rn > 1
        $sql$;
      elsif has_created_at then
        execute $sql$
          with ranked as (
            select ctid, row_number() over (
              partition by ticket_id, coalesce(dokument_typ, 'unbekannt')
              order by created_at desc nulls last, ctid desc
            ) as rn
            from public.ticket_documents
          )
          delete from public.ticket_documents d
          using ranked r
          where d.ctid = r.ctid and r.rn > 1
        $sql$;
      else
        execute $sql$
          with ranked as (
            select ctid, row_number() over (
              partition by ticket_id, coalesce(dokument_typ, 'unbekannt')
              order by ctid desc
            ) as rn
            from public.ticket_documents
          )
          delete from public.ticket_documents d
          using ranked r
          where d.ctid = r.ctid and r.rn > 1
        $sql$;
      end if;
    end if;
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'ticket_documents'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'ticket_documents' and column_name = 'ticket_id'
    ) and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'ticket_documents' and column_name = 'dokument_typ'
    ) then
      execute 'create unique index if not exists uq_ticket_documents_ticket_type on public.ticket_documents(ticket_id, dokument_typ)';
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'ticket_documents' and column_name = 'ticket_id'
    ) and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public' and table_name = 'ticket_documents' and column_name = 'created_at'
    ) then
      execute 'create index if not exists idx_ticket_documents_ticket on public.ticket_documents(ticket_id, created_at desc)';
    end if;

    drop trigger if exists trg_ticket_documents_touch on public.ticket_documents;
    create trigger trg_ticket_documents_touch
    before update on public.ticket_documents
    for each row execute procedure public.touch_updated_at();
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'ticket_events'
  ) then
    execute 'create index if not exists idx_ticket_events_ticket_created on public.ticket_events(ticket_id, created_at desc)';
  end if;
end
$$;
