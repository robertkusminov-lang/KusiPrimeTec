create table if not exists public.objectbetreuung_inquiry_sequences (
  day date primary key,
  next_value integer not null default 1,
  updated_at timestamptz not null default now()
);

create or replace function public.next_objectbetreuung_inquiry_number()
returns text
language plpgsql
as $$
declare
  d date := now()::date;
  v integer;
begin
  insert into public.objectbetreuung_inquiry_sequences(day, next_value)
  values (d, 1)
  on conflict (day) do nothing;

  update public.objectbetreuung_inquiry_sequences
  set next_value = next_value + 1,
      updated_at = now()
  where day = d
  returning next_value - 1 into v;

  return format('OBJ-%s-%s', to_char(d, 'YYYYMMDD'), lpad(v::text, 4, '0'));
end;
$$;

create table if not exists public.objectbetreuung_inquiries (
  id uuid primary key default gen_random_uuid(),
  inquiry_number text not null unique default public.next_objectbetreuung_inquiry_number(),
  company_name text not null,
  contact_name text not null,
  phone text null,
  email text not null,
  address_line text null,
  industry text null,
  property_type text null,
  property_size text null,
  desired_support text null,
  message text not null,
  source text not null default 'Website',
  status text not null default 'neue ObjektBetreuungs-Anfrage',
  follow_up_at date null,
  notes text null,
  assigned_to text null default 'Robert Kusminov',
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint objectbetreuung_inquiries_status_check check (
    status in (
      'neue ObjektBetreuungs-Anfrage',
      'Rückruf erforderlich',
      'Beratungsgespräch geplant',
      'ObjektCheck vorgeschlagen',
      'ObjektCheck geplant',
      'Angebot in Vorbereitung',
      'Angebot versendet',
      'gewonnen',
      'abgelehnt / nicht passend',
      'später erneut kontaktieren'
    )
  )
);

create index if not exists idx_objectbetreuung_inquiries_status_requested
  on public.objectbetreuung_inquiries(status, requested_at desc);

create index if not exists idx_objectbetreuung_inquiries_follow_up
  on public.objectbetreuung_inquiries(follow_up_at asc nulls last);

drop trigger if exists trg_objectbetreuung_inquiries_touch on public.objectbetreuung_inquiries;
create trigger trg_objectbetreuung_inquiries_touch
before update on public.objectbetreuung_inquiries
for each row execute procedure public.touch_updated_at();

alter table public.objectbetreuung_inquiries enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'objectbetreuung_inquiries'
      and policyname = 'objectbetreuung_inquiries_admin_all'
  ) then
    create policy objectbetreuung_inquiries_admin_all on public.objectbetreuung_inquiries
      for all to authenticated
      using (public.is_admin_email())
      with check (public.is_admin_email());
  end if;
end
$$;

create table if not exists public.ticket_number_sequences (
  day date primary key,
  next_value integer not null default 1,
  updated_at timestamptz not null default now()
);

create or replace function public.next_ticket_number()
returns text
language plpgsql
as $$
declare
  d date := now()::date;
  v integer;
begin
  insert into public.ticket_number_sequences(day, next_value)
  values (d, 1)
  on conflict (day) do nothing;

  update public.ticket_number_sequences
  set next_value = next_value + 1,
      updated_at = now()
  where day = d
  returning next_value - 1 into v;

  return format('KPT-%s-%s', to_char(d, 'YYYYMMDD'), lpad(v::text, 4, '0'));
end;
$$;

do $$
declare
  has_tickets boolean;
  has_kategorie boolean;
  has_category boolean;
  r record;
begin
  select exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'tickets'
  ) into has_tickets;

  if not has_tickets then
    return;
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'tickets' and column_name = 'kategorie'
  ) into has_kategorie;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'tickets' and column_name = 'category'
  ) into has_category;

  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'tickets'
      and c.contype = 'c'
      and (
        c.conname in ('tickets_category_check', 'check_category', 'tickets_kategorie_check')
        or pg_get_constraintdef(c.oid) ilike '%kategorie%'
        or pg_get_constraintdef(c.oid) ilike '%category%'
      )
  loop
    execute format('alter table public.tickets drop constraint if exists %I', r.conname);
  end loop;

  if has_kategorie then
    alter table public.tickets
      add constraint tickets_category_check
      check (
        kategorie in (
          'Elektro',
          'Heizung',
          'Sanitaer',
          'Sanitär',
          'Objekttechnik',
          'Koordination',
          'ObjektBetreuung',
          'ObjektCheck',
          'Kleinreparatur',
          'Mängelaufnahme',
          'Instandhaltung',
          'Sichtkontrolle',
          'Wartung im Bestand',
          'Handwerklich-technischer Allround-Service',
          'Fachfirma erforderlich',
          'Material benötigt',
          'Rückfrage Kunde',
          'Terminplanung',
          'Dokumentation',
          'Einzelauftrag',
          'Sonstiges'
        )
      );
  elsif has_category then
    alter table public.tickets
      add constraint tickets_category_check
      check (
        category in (
          'Elektro',
          'Heizung',
          'Sanitaer',
          'Sanitär',
          'Objekttechnik',
          'Koordination',
          'ObjektBetreuung',
          'ObjektCheck',
          'Kleinreparatur',
          'Mängelaufnahme',
          'Instandhaltung',
          'Sichtkontrolle',
          'Wartung im Bestand',
          'Handwerklich-technischer Allround-Service',
          'Fachfirma erforderlich',
          'Material benötigt',
          'Rückfrage Kunde',
          'Terminplanung',
          'Dokumentation',
          'Einzelauftrag',
          'Sonstiges'
        )
      );
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'objects'
      and policyname = 'objects_customer_insert_own'
  ) then
    drop policy objects_customer_insert_own on public.objects;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'objects'
      and policyname = 'objects_customer_update_own'
  ) then
    drop policy objects_customer_update_own on public.objects;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'object_notes'
      and policyname = 'object_notes_customer_insert_own'
  ) then
    drop policy object_notes_customer_insert_own on public.object_notes;
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tickets'
      and policyname = 'tickets_customer_read_own'
  ) then
    drop policy tickets_customer_read_own on public.tickets;
  end if;

  create policy tickets_customer_read_own on public.tickets
    for select
    to authenticated
    using (
      requester_user_id = auth.uid()
      or exists (
        select 1
        from public.objects o
        where o.id = tickets.object_id
          and o.requester_user_id = auth.uid()
      )
    );
end
$$;
