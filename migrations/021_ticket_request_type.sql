alter table if exists public.tickets
  add column if not exists request_type text null;

do $$
declare
  has_anfrageart boolean;
  has_source boolean;
begin
  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tickets' and column_name = 'anfrageart'
  ) into has_anfrageart;

  select exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tickets' and column_name = 'source'
  ) into has_source;

  if has_anfrageart and has_source then
    execute $sql$
      update public.tickets
      set request_type = case
        when lower(coalesce(request_type, '')) in ('offer', 'direct') then lower(request_type)
        when lower(coalesce(anfrageart, '')) in ('angebot', 'offer') then 'offer'
        when lower(coalesce(anfrageart, '')) in ('direkt_einsatz', 'direct', 'direkt') then 'direct'
        when lower(coalesce(source, '')) in ('angebot', 'offer') then 'offer'
        when lower(coalesce(source, '')) in ('direkt_einsatz', 'direct', 'direkt', 'einsatz') then 'direct'
        else request_type
      end
      where request_type is null
         or lower(coalesce(request_type, '')) not in ('offer', 'direct')
    $sql$;
  elsif has_anfrageart then
    execute $sql$
      update public.tickets
      set request_type = case
        when lower(coalesce(request_type, '')) in ('offer', 'direct') then lower(request_type)
        when lower(coalesce(anfrageart, '')) in ('angebot', 'offer') then 'offer'
        when lower(coalesce(anfrageart, '')) in ('direkt_einsatz', 'direct', 'direkt') then 'direct'
        else request_type
      end
      where request_type is null
         or lower(coalesce(request_type, '')) not in ('offer', 'direct')
    $sql$;
  elsif has_source then
    execute $sql$
      update public.tickets
      set request_type = case
        when lower(coalesce(request_type, '')) in ('offer', 'direct') then lower(request_type)
        when lower(coalesce(source, '')) in ('angebot', 'offer') then 'offer'
        when lower(coalesce(source, '')) in ('direkt_einsatz', 'direct', 'direkt', 'einsatz') then 'direct'
        else request_type
      end
      where request_type is null
         or lower(coalesce(request_type, '')) not in ('offer', 'direct')
    $sql$;
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
      and t.relname = 'tickets'
      and c.conname = 'tickets_request_type_check'
  ) then
    alter table public.tickets
      add constraint tickets_request_type_check
      check (request_type is null or request_type in ('offer', 'direct'));
  end if;
end
$$;

create index if not exists idx_tickets_request_type_created
  on public.tickets(request_type, created_at desc);