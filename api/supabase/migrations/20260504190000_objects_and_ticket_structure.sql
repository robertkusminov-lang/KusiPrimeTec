create table if not exists public.objects (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid null references public.customers(id) on delete set null,
  requester_user_id uuid null references auth.users(id) on delete set null,
  name text not null,
  street text null,
  zip text null,
  city text null,
  access_notes text null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tickets
  add column if not exists object_id uuid null references public.objects(id) on delete set null;

create index if not exists idx_objects_requester_user_id on public.objects(requester_user_id, created_at desc);
create index if not exists idx_tickets_object_id on public.tickets(object_id, created_at desc);

create table if not exists public.object_notes (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects(id) on delete cascade,
  ticket_id uuid null references public.tickets(id) on delete set null,
  author_role text not null default 'customer',
  note text not null,
  created_by_user_id uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_object_notes_object_created on public.object_notes(object_id, created_at desc);

alter table public.objects enable row level security;
alter table public.object_notes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='objects' and policyname='objects_customer_read_own'
  ) then
    create policy objects_customer_read_own on public.objects
      for select to authenticated
      using (requester_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='objects' and policyname='objects_customer_insert_own'
  ) then
    create policy objects_customer_insert_own on public.objects
      for insert to authenticated
      with check (requester_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='objects' and policyname='objects_customer_update_own'
  ) then
    create policy objects_customer_update_own on public.objects
      for update to authenticated
      using (requester_user_id = auth.uid())
      with check (requester_user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='objects' and policyname='objects_admin_all'
  ) then
    create policy objects_admin_all on public.objects
      for all to authenticated
      using (public.is_admin_email())
      with check (public.is_admin_email());
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='object_notes' and policyname='object_notes_customer_read_own'
  ) then
    create policy object_notes_customer_read_own on public.object_notes
      for select to authenticated
      using (
        exists (
          select 1 from public.objects o
          where o.id = object_notes.object_id
            and o.requester_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='object_notes' and policyname='object_notes_customer_insert_own'
  ) then
    create policy object_notes_customer_insert_own on public.object_notes
      for insert to authenticated
      with check (
        exists (
          select 1 from public.objects o
          where o.id = object_notes.object_id
            and o.requester_user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='object_notes' and policyname='object_notes_admin_all'
  ) then
    create policy object_notes_admin_all on public.object_notes
      for all to authenticated
      using (public.is_admin_email())
      with check (public.is_admin_email());
  end if;
end
$$;

