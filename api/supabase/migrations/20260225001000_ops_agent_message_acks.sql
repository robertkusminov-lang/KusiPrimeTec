create extension if not exists pgcrypto;

create table if not exists public.ops_agent_message_acks (
  run_id uuid not null references public.ops_agent_runs(id) on delete cascade,
  admin_email text not null,
  acknowledged_at timestamptz not null default now(),
  primary key (run_id, admin_email)
);

create index if not exists idx_ops_agent_message_acks_admin_time
  on public.ops_agent_message_acks(admin_email, acknowledged_at desc);

alter table public.ops_agent_message_acks enable row level security;

do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'is_admin_email'
  ) then
    if not exists (
      select 1
      from pg_policies
      where schemaname = 'public'
        and tablename = 'ops_agent_message_acks'
        and policyname = 'ops_agent_message_acks_admin_all'
    ) then
      create policy ops_agent_message_acks_admin_all on public.ops_agent_message_acks
      for all to authenticated
      using (public.is_admin_email())
      with check (public.is_admin_email());
    end if;
  end if;
end
$$;

