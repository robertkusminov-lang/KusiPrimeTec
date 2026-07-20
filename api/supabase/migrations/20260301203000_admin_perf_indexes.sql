do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tickets'
      and column_name = 'bucket'
  ) then
    create index if not exists idx_tickets_bucket_created
      on public.tickets(bucket, created_at desc);

    create index if not exists idx_tickets_bucket_status_created
      on public.tickets(bucket, status, created_at desc);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'tickets'
      and column_name = 'customer_id'
  ) then
    create index if not exists idx_tickets_customer_created
      on public.tickets(customer_id, created_at desc);
  end if;
end
$$;
