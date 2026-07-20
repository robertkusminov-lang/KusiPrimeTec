create index if not exists idx_tickets_status on public.tickets(status);
create index if not exists idx_tickets_created_at_desc on public.tickets(created_at desc);
create index if not exists idx_tickets_terminwunsch on public.tickets(terminwunsch);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tickets'
      and column_name = 'bucket'
  ) then
    execute 'create index if not exists idx_tickets_bucket on public.tickets(bucket)';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tickets'
      and column_name = 'scheduled_at'
  ) then
    execute 'create index if not exists idx_tickets_scheduled_at on public.tickets(scheduled_at)';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tickets'
      and column_name = 'termin_geplant_at'
  ) then
    execute 'create index if not exists idx_tickets_termin_geplant_at on public.tickets(termin_geplant_at)';
  end if;
end
$$;
