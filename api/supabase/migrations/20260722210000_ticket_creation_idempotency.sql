create table if not exists public.ticket_creation_requests (
  idempotency_key uuid primary key,
  payload_hash text not null,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  processing_token uuid not null,
  ticket_id uuid null references public.tickets(id) on delete set null,
  ticket_number text null,
  error_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ticket_creation_requests_updated
  on public.ticket_creation_requests(updated_at desc);

alter table public.ticket_creation_requests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'ticket_creation_requests'
      and policyname = 'ticket_creation_requests_admin_read'
  ) then
    create policy ticket_creation_requests_admin_read
      on public.ticket_creation_requests
      for select to authenticated
      using (public.is_admin_email());
  end if;
end
$$;
