do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'request_type_enum'
  ) then
    create type public.request_type_enum as enum ('offer', 'direct');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'tickets'
  ) then
    return;
  end if;

  alter table public.tickets
    add column if not exists request_type text;
end
$$;

update public.tickets
set request_type = case
  when lower(btrim(coalesce(request_type, anfrageart, source, ''))) in ('offer', 'angebot') then 'offer'
  else 'direct'
end
where request_type is null
   or lower(btrim(request_type)) not in ('offer', 'direct');

do $$
declare
  current_udt text;
begin
  select c.udt_name
    into current_udt
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'tickets'
    and c.column_name = 'request_type';

  if current_udt is distinct from 'request_type_enum' then
    begin
      execute $sql$
        alter table public.tickets
        alter column request_type type public.request_type_enum
        using (
          case
            when lower(btrim(coalesce(request_type::text, anfrageart, source, ''))) in ('offer', 'angebot')
              then 'offer'::public.request_type_enum
            else 'direct'::public.request_type_enum
          end
        )
      $sql$;
    exception
      when others then
        null;
    end;
  end if;
end
$$;

update public.tickets
set request_type = case
  when lower(btrim(coalesce(request_type::text, anfrageart, source, ''))) in ('offer', 'angebot') then 'offer'
  else 'direct'
end
where request_type is null
   or lower(btrim(request_type::text)) not in ('offer', 'direct');

alter table public.tickets
  alter column request_type set default 'direct',
  alter column request_type set not null;

update public.tickets
set anfrageart = case
  when request_type::text = 'offer' then 'angebot'
  else 'direkt_einsatz'
end
where anfrageart is null
   or lower(btrim(anfrageart)) not in ('angebot', 'direkt_einsatz')
   or (request_type::text = 'offer' and lower(btrim(anfrageart)) <> 'angebot')
   or (request_type::text = 'direct' and lower(btrim(anfrageart)) <> 'direkt_einsatz');

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'tickets'
      and c.conname = 'tickets_request_type_check'
  ) then
    alter table public.tickets
      add constraint tickets_request_type_check
      check (request_type::text in ('offer', 'direct'));
  end if;
end
$$;

create index if not exists idx_tickets_request_type on public.tickets(request_type);

create or replace function public.sync_ticket_request_type_fields()
returns trigger
language plpgsql
as $$
declare
  normalized text;
begin
  normalized := case
    when lower(btrim(coalesce(new.request_type::text, new.anfrageart, ''))) in ('offer', 'angebot') then 'offer'
    else 'direct'
  end;

  new.request_type := normalized;
  new.anfrageart := case when normalized = 'offer' then 'angebot' else 'direkt_einsatz' end;
  return new;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_tickets_sync_request_type_fields'
  ) then
    create trigger trg_tickets_sync_request_type_fields
    before insert or update of request_type, anfrageart
    on public.tickets
    for each row
    execute function public.sync_ticket_request_type_fields();
  end if;
end
$$;

comment on column public.tickets.request_type is 'Kanonische Anfrageart: offer|direct (UI: Angebot|Direkt Einsatz).';
